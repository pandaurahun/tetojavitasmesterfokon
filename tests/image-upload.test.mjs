// The upload guard used by field-quote photos, the signature image and the
// public quote-request wizard. A declared Content-Type proves nothing — the
// bytes must actually be what they claim to be.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkImageUploadHeaders,
  readCompletePng,
  readImageUploadBody,
  sniffRasterImageType,
} from "../src/server/image-upload.server.ts";

const PNG_1X1 = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  ),
);
const JPEG = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1,
]);
const bytes = (text) => Uint8Array.from(Buffer.from(text, "latin1"));
const WEBP = bytes("RIFF\u0010\u0000\u0000\u0000WEBPVP8 ....");
const AVIF = bytes("\u0000\u0000\u0000\u001cftypavif\u0000\u0000\u0000\u0000avifmif1miaf");
const HTML = bytes("<html><script>alert(1)</script></html>");

function upload(body, type, { length = body?.length, method = "POST" } = {}) {
  const headers = {};
  if (type) headers["content-type"] = type;
  if (length !== undefined) headers["content-length"] = String(length);
  return new Request("http://localhost/api/upload", {
    method,
    headers,
    body,
    duplex: "half",
  });
}

test("recognises the four raster formats by their magic bytes", () => {
  assert.equal(sniffRasterImageType(PNG_1X1), "image/png");
  assert.equal(sniffRasterImageType(JPEG), "image/jpeg");
  assert.equal(sniffRasterImageType(WEBP), "image/webp");
  assert.equal(sniffRasterImageType(AVIF), "image/avif");
});

test("rejects things that merely claim to be images", () => {
  assert.equal(sniffRasterImageType(HTML), null);
  assert.equal(sniffRasterImageType(new Uint8Array(200)), null); // zeros
  assert.equal(sniffRasterImageType(bytes("<svg xmlns='http://www.w3.org/2000/svg'/>")), null);
  assert.equal(sniffRasterImageType(new Uint8Array(0)), null);
  assert.equal(sniffRasterImageType(Uint8Array.from([0x89, 0x50])), null); // truncated
  assert.equal(sniffRasterImageType(bytes("MZ\u0090\u0000\u0003\u0000\u0000\u0000")), null); // Windows exe
});

test("readCompletePng: a real PNG passes, with its size", () => {
  assert.deepEqual(readCompletePng(PNG_1X1), { width: 1, height: 1 });
});

test("readCompletePng: truncated, zero-filled, wrong-size and non-PNG data fail", () => {
  assert.equal(readCompletePng(PNG_1X1.slice(0, 40)), null); // no IEND
  assert.equal(readCompletePng(new Uint8Array(90)), null);
  assert.equal(readCompletePng(JPEG), null);
  const zeroWidth = PNG_1X1.slice();
  zeroWidth[19] = 0; // IHDR width low byte -> 0
  assert.equal(readCompletePng(zeroWidth), null);
  const huge = PNG_1X1.slice();
  huge[16] = 0x7f; // width ~2 billion
  assert.equal(readCompletePng(huge), null);
});

test("headers: wrong type, missing or oversize length are refused before reading", () => {
  const ok = checkImageUploadHeaders(upload(PNG_1X1, "image/png"), 1024);
  assert.deepEqual(ok, { mime: "image/png" });
  assert.equal(checkImageUploadHeaders(upload(PNG_1X1, "text/html"), 1024).error.status, 415);
  assert.equal(checkImageUploadHeaders(upload(PNG_1X1, "image/svg+xml"), 1024).error.status, 415);
  assert.equal(checkImageUploadHeaders(upload(PNG_1X1, undefined), 1024).error.status, 415);
  assert.equal(
    checkImageUploadHeaders(upload(PNG_1X1, "image/png", { length: 5000 }), 1024).error.status,
    413,
  );
  assert.equal(
    checkImageUploadHeaders(upload(PNG_1X1, "image/png", { length: 0 }), 1024).error.status,
    411,
  );
  // charset parameters and casing are tolerated
  assert.ok("mime" in checkImageUploadHeaders(upload(PNG_1X1, "IMAGE/PNG; charset=binary"), 1024));
});

test("body: stores what the bytes ARE, not what the request claimed", async () => {
  const result = await readImageUploadBody(upload(PNG_1X1, "image/jpeg"), 1024);
  assert.equal(result.image.mime, "image/png");
  assert.equal(result.image.extension, "png");
  assert.equal(result.image.bytes.length, PNG_1X1.length);
});

test("body: HTML or zeros labelled image/png are refused (415)", async () => {
  assert.equal((await readImageUploadBody(upload(HTML, "image/png"), 1024)).error.status, 415);
  assert.equal(
    (await readImageUploadBody(upload(new Uint8Array(100), "image/png"), 1024)).error.status,
    415,
  );
});

test("body: the real size is enforced even if the header lied", async () => {
  const big = new Uint8Array(2048);
  big.set(PNG_1X1);
  const lying = upload(big, "image/png", { length: 100 });
  assert.equal((await readImageUploadBody(lying, 1024)).error.status, 413);
});

test("body: empty upload", async () => {
  assert.equal(
    (await readImageUploadBody(upload(new Uint8Array(0), "image/png"), 1024)).error.status,
    400,
  );
});
