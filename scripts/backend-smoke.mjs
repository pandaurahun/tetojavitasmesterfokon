const baseUrl = process.argv[2] ?? "http://127.0.0.1:8787";
const bootstrapSecret = process.argv[3];

if (!bootstrapSecret) {
  throw new Error("Usage: node scripts/backend-smoke.mjs <base-url> <bootstrap-secret>");
}

const email = "owner@local.test";
const password = "Local-test-password-2026!";

const request = async (path, init = {}) => {
  const response = await fetch(`${baseUrl}${path}`, init);
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  return { response, payload };
};

const unauthorized = await request("/api/admin/state");
if (unauthorized.response.status !== 401) throw new Error("Admin API is not protected");

const bootstrap = await request("/api/admin/bootstrap", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${bootstrapSecret}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ email, password }),
});
if (![201, 409].includes(bootstrap.response.status)) {
  throw new Error(
    `Bootstrap failed: ${bootstrap.response.status} ${JSON.stringify(bootstrap.payload)}`,
  );
}

const login = await request("/api/admin/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
if (login.response.status !== 200) {
  throw new Error(`Login failed: ${login.response.status} ${JSON.stringify(login.payload)}`);
}
const cookie = (login.response.headers.get("set-cookie") ?? "").split(";", 1)[0];
if (!cookie) throw new Error("Login did not set a session cookie");

const adminState = await request("/api/admin/state", { headers: { Cookie: cookie } });
if (
  adminState.response.status !== 200 ||
  !Array.isArray(adminState.payload?.services) ||
  !Array.isArray(adminState.payload?.cms)
) {
  throw new Error("Authenticated state read failed");
}

const leadId = `smoke-${Date.now()}`;
const lead = {
  id: leadId,
  createdAt: new Date().toISOString(),
  name: "Teszt Érdeklődő",
  phone: "+36 30 123 4567",
  email: "teszt@example.test",
  city: "Szolnok",
  service: "Tetőjavítás",
  urgency: "napokon-belul",
  status: "uj",
  source: "reszletes-ajanlatkero",
  files: [],
  owner: "Tulajdonos",
  notes: [],
  timeline: [],
};
const createdLead = await request("/api/leads", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(lead),
});
if (createdLead.response.status !== 201) throw new Error("Lead creation failed");

const refreshedState = await request("/api/admin/state", { headers: { Cookie: cookie } });
if (!refreshedState.payload?.leads?.some((item) => item.id === leadId)) {
  throw new Error("Created lead is not persisted in D1");
}

const saved = await request("/api/admin/state", {
  method: "PUT",
  headers: { Cookie: cookie, "Content-Type": "application/json" },
  body: JSON.stringify(refreshedState.payload),
});
if (saved.response.status !== 200) throw new Error("Admin state save failed");

const pixel = Uint8Array.from([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0,
  0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 8, 215, 99, 248, 207, 192, 240, 31, 0, 5, 0, 1,
  255, 137, 153, 61, 29, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
]);
const uploaded = await request("/api/admin/media", {
  method: "POST",
  headers: { Cookie: cookie, "Content-Type": "image/png", "Content-Length": String(pixel.length) },
  body: pixel,
});
if (uploaded.response.status !== 201 || !uploaded.payload?.url) {
  throw new Error(`Media upload failed: ${uploaded.response.status}`);
}
const media = await fetch(`${baseUrl}${uploaded.payload.url}`);
if (!media.ok || media.headers.get("content-type") !== "image/png") {
  throw new Error("Uploaded media cannot be read back");
}

const publicState = await request("/api/public-state");
if (publicState.payload?.leads?.length || publicState.payload?.quotes?.length) {
  throw new Error("Private records leaked through public state");
}
if (!Array.isArray(publicState.payload?.cms) || publicState.payload.cms.length === 0) {
  throw new Error("CMS state is missing from public state");
}

console.log(
  JSON.stringify({
    ok: true,
    protectedAdmin: true,
    sessionCookie: true,
    leadPersistence: true,
    statePersistence: true,
    mediaPersistence: true,
    publicPrivacy: true,
    cmsPersistence: true,
  }),
);
