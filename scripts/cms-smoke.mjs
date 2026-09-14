const baseUrl = process.argv[2] ?? "http://127.0.0.1:8787";
const sessionToken = process.argv[3];

if (!sessionToken) {
  throw new Error("Usage: node scripts/cms-smoke.mjs <base-url> <session-token>");
}

const cookie = `tetomester_session=${sessionToken}`;
const request = async (path, init = {}) => {
  const response = await fetch(`${baseUrl}${path}`, init);
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  return { response, payload };
};

const original = await request("/api/admin/state", { headers: { Cookie: cookie } });
if (original.response.status !== 200 || !Array.isArray(original.payload?.cms)) {
  throw new Error(`Authenticated CMS read failed: ${original.response.status}`);
}

const marker = `CMS smoke ${Date.now()}`;
const changed = structuredClone(original.payload);
const header = changed.cms.find((section) => section.id === "global.header");
if (!header) throw new Error("Global header CMS section is missing");
header.values["nav.home"] = marker;

const saved = await request("/api/admin/state", {
  method: "PUT",
  headers: { Cookie: cookie, "Content-Type": "application/json" },
  body: JSON.stringify(changed),
});
if (saved.response.status !== 200) throw new Error(`CMS save failed: ${saved.response.status}`);

const publicState = await request("/api/public-state");
const publicHeader = publicState.payload?.cms?.find((section) => section.id === "global.header");
if (publicHeader?.values?.["nav.home"] !== marker) {
  throw new Error("Saved CMS value is not visible through the public API");
}

const restored = await request("/api/admin/state", {
  method: "PUT",
  headers: { Cookie: cookie, "Content-Type": "application/json" },
  body: JSON.stringify(original.payload),
});
if (restored.response.status !== 200) throw new Error("CMS fixture restore failed");

console.log(JSON.stringify({ ok: true, cmsRead: true, cmsSave: true, publicSync: true }));
