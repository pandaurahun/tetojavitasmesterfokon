import type { Lead, ProjectRef } from "@/demo/types";

// AI_API_KEY / AI_PROVIDER / AI_MODEL are optional Worker secrets — not
// declared in wrangler.jsonc's required list, since the app must work fully
// without them. Extends the generated Env type without touching that file.
declare global {
  interface Env {
    AI_API_KEY?: string;
    AI_PROVIDER?: string;
    AI_MODEL?: string;
  }
}

export interface AIProvider {
  generateJSON<T>(params: { system: string; user: string }): Promise<T>;
}

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5";
// gemini-2.5-flash is closed to new API keys as of this writing; Google's
// own API error points new callers to gemini-3.6-flash instead.
const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

// Default provider — has a free API tier, so the AI features don't require
// a paid key to try out. Switch to Anthropic any time by setting the
// AI_PROVIDER secret/var to "anthropic" (see getAIProvider below).
class GeminiProvider implements AIProvider {
  constructor(
    private apiKey: string,
    private model: string,
  ) {}

  async generateJSON<T>({ system, user }: { system: string; user: string }): Promise<T> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      },
    );
    if (!response.ok) {
      throw new Error(`Az AI szolgáltató hibát adott vissza (${response.status}).`);
    }
    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return parseJsonFromText<T>(text);
  }
}

class AnthropicProvider implements AIProvider {
  constructor(
    private apiKey: string,
    private model: string,
  ) {}

  async generateJSON<T>({ system, user }: { system: string; user: string }): Promise<T> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 2048,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!response.ok) {
      throw new Error(`Az AI szolgáltató hibát adott vissza (${response.status}).`);
    }
    const data = (await response.json()) as { content?: { type: string; text?: string }[] };
    const text = data.content?.find((block) => block.type === "text")?.text ?? "";
    return parseJsonFromText<T>(text);
  }
}

function parseJsonFromText<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Az AI válasza nem tartalmazott feldolgozható JSON-t.");
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    throw new Error("Az AI válasza nem érvényes JSON.");
  }
}

// Provider selection lives here so callers never touch provider specifics.
// Adding a second provider means one more case here — nothing else changes.
export function getAIProvider(env: Env): AIProvider | null {
  const apiKey = env.AI_API_KEY;
  if (!apiKey) return null;
  const providerName = env.AI_PROVIDER || "gemini";
  switch (providerName) {
    case "anthropic":
      return new AnthropicProvider(apiKey, env.AI_MODEL || DEFAULT_ANTHROPIC_MODEL);
    case "gemini":
    default:
      return new GeminiProvider(apiKey, env.AI_MODEL || DEFAULT_GEMINI_MODEL);
  }
}

export interface QuoteDraftSuggestedItem {
  name: string;
  description?: string | undefined;
  qty: number | null;
  unit: string;
  confidence: "high" | "low";
  priceSource: "catalog" | "manual_needed";
  unitPrice?: number | undefined;
}

export interface QuoteDraftResult {
  summary: string;
  suggestedItems: QuoteDraftSuggestedItem[];
  uncertainties: string[];
  siteSurveyCheckpoints: string[];
  customerText: string;
  internalWarnings: string[];
}

interface RawQuoteDraftItem {
  name?: string;
  description?: string;
  qty?: number | null;
  unit?: string;
  confidence?: string;
}

interface RawQuoteDraftResponse {
  summary?: string;
  suggestedItems?: RawQuoteDraftItem[];
  uncertainties?: string[];
  siteSurveyCheckpoints?: string[];
  customerText?: string;
  internalWarnings?: string[];
}

export async function generateQuoteDraft(
  provider: AIProvider,
  input: {
    lead: Lead;
    priceBook: { name: string; unit: string; unitPrice: number }[];
    companyName: string;
    priorNotes: string[];
  },
): Promise<QuoteDraftResult> {
  const system = `Egy magyarországi tetőfedő vállalkozás (${input.companyName}) admin-asszisztense vagy.
Feladatod: egy érdeklődő (lead) adataiból árajánlat-VÁZLATOT javasolni. A vázlatot mindig egy ember ellenőrzi
és hagyja jóvá — te sosem küldesz ki semmit közvetlenül, és a kimeneted automatikusan piszkozat állapotba kerül.

SZIGORÚ SZABÁLYOK — ezek megszegése súlyos hiba:
1. Soha ne találj ki műszaki adatot (pl. tetőfelület, anyagminőség, állapot), ha az nincs megadva. Ha egy
   tételhez szükséges adat hiányzik vagy bizonytalan, írd az "uncertainties" listába, és annál a tételnél a
   confidence legyen "low".
2. Soha ne adj meg vagy találj ki egységárat. Az ár kizárólag a rendszer tételkatalógusából vagy az adminból
   jöhet — te csak nevet, mennyiséget és mértékegységet javasolsz, árat soha.
3. Mennyiséget csak akkor adj meg, ha az input adatból megbízhatóan következik (pl. konkrét m²-érték szerepel
   az üzenetben). Egyébként qty legyen null, és a hiányzó mérés kerüljön be a "siteSurveyCheckpoints" közé.
4. Válaszolj KIZÁRÓLAG egyetlen JSON objektummal, más szöveg, magyarázat vagy markdown code fence nélkül.`;

  const catalogText = input.priceBook.map((p) => `- ${p.name} (${p.unit})`).join("\n");
  const notesText = input.priorNotes.length
    ? input.priorNotes.join("\n")
    : "(nincs korábbi jegyzet)";
  const roofText = input.lead.roof
    ? Object.entries(input.lead.roof)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ")
    : "(nincs megadva)";

  const user = `LEAD ADATOK:
Szolgáltatás: ${input.lead.service}
Helyszín: ${[input.lead.zip, input.lead.city, input.lead.street].filter(Boolean).join(" ") || "(nincs megadva)"}
Sürgősség: ${input.lead.urgency}
Épülettípus: ${input.lead.buildingType ?? "(nincs megadva)"}
Ügyfél üzenete: ${input.lead.message ?? "(nincs üzenet)"}
Tetőadatok: ${roofText}
Feltöltött fájlok: ${input.lead.files.length ? input.lead.files.map((f) => `${f.name} (${f.kind})`).join(", ") : "(nincs)"}

KORÁBBI ADMIN JEGYZETEK:
${notesText}

ELÉRHETŐ TÉTELKATALÓGUS (csak ezekhez a nevekhez rendelj mennyiséget — az árat majd a rendszer illeszti hozzá):
${catalogText}

Add vissza a választ pontosan ezzel a JSON sémával:
{
  "summary": string,
  "suggestedItems": [{ "name": string, "description": string, "qty": number, "unit": string, "confidence": "high"|"low" }],
  "uncertainties": string[],
  "siteSurveyCheckpoints": string[],
  "customerText": string,
  "internalWarnings": string[]
}`;

  const raw = await provider.generateJSON<RawQuoteDraftResponse>({ system, user });

  // Price enforcement happens here, in code, regardless of what the model
  // returned: only items whose name matches the real catalog get a price.
  // Everything else is explicitly flagged for the admin to price by hand.
  const suggestedItems: QuoteDraftSuggestedItem[] = (raw.suggestedItems ?? []).map((item) => {
    const catalogMatch = input.priceBook.find(
      (p) => p.name.trim().toLowerCase() === (item.name ?? "").trim().toLowerCase(),
    );
    return {
      name: item.name || "Megnevezés nélküli tétel",
      description: item.description || undefined,
      qty: typeof item.qty === "number" && Number.isFinite(item.qty) ? item.qty : null,
      unit: catalogMatch?.unit || item.unit || "db",
      confidence: item.confidence === "high" ? "high" : "low",
      priceSource: catalogMatch ? "catalog" : "manual_needed",
      unitPrice: catalogMatch?.unitPrice,
    };
  });

  return {
    summary: raw.summary || "",
    suggestedItems,
    uncertainties: Array.isArray(raw.uncertainties) ? raw.uncertainties : [],
    siteSurveyCheckpoints: Array.isArray(raw.siteSurveyCheckpoints) ? raw.siteSurveyCheckpoints : [],
    customerText: raw.customerText || "",
    internalWarnings: Array.isArray(raw.internalWarnings) ? raw.internalWarnings : [],
  };
}

export interface SocialPostDraft {
  facebook: string;
  instagram: string;
  instagramCaption: string;
  googleBusinessProfile: string;
  ctaVariants: string[];
  hashtags: string[];
}

export async function generateSocialPost(
  provider: AIProvider,
  input: { project: ProjectRef; companyName: string },
): Promise<SocialPostDraft> {
  const system = `Egy magyarországi tetőfedő vállalkozás (${input.companyName}) social media szövegírója vagy.
Kizárólag DRAFT (vázlat) tartalmat készítesz, amit egy ember ellenőriz és tesz közzé — te magad soha nem
publikálsz semmilyen platformra. Válaszolj KIZÁRÓLAG egyetlen JSON objektummal, más szöveg nélkül.`;

  const user = `REFERENCIA PROJEKT:
Cím: ${input.project.title}
Helyszín: ${input.project.location}
Kiindulási probléma: ${input.project.problem}
Elvégzett munkák: ${input.project.works.join("; ") || "(nincs megadva)"}
Kivitelezési idő: ${input.project.duration}

Készíts social media tartalom-vázlatot pontosan ezzel a JSON sémával:
{
  "facebook": string,
  "instagram": string,
  "instagramCaption": string,
  "googleBusinessProfile": string,
  "ctaVariants": string[],
  "hashtags": string[]
}
A ctaVariants 3-5 rövid, különböző call-to-action mondat legyen. A hashtags magyar és releváns legyen.`;

  const raw = await provider.generateJSON<Partial<SocialPostDraft>>({ system, user });
  return {
    facebook: raw.facebook || "",
    instagram: raw.instagram || "",
    instagramCaption: raw.instagramCaption || "",
    googleBusinessProfile: raw.googleBusinessProfile || "",
    ctaVariants: Array.isArray(raw.ctaVariants) ? raw.ctaVariants : [],
    hashtags: Array.isArray(raw.hashtags) ? raw.hashtags : [],
  };
}
