// Shared guard for the raster-image upload endpoints (field-quote photos and
// the public quote-request wizard). Three layers, each cheap:
//   1. the declared Content-Type must be one of four raster formats — no SVG
//      (script carrier), no HTML, nothing exotic;
//   2. the declared size must be present and within the limit, so an obviously
//      oversize upload is refused before a byte is read;
//   3. the bytes themselves must start with that format's magic number. A
//      client can write any Content-Type it likes, but it can't make an HTML
//      page or an executable start like a PNG and still be rejected here — and
//      the stored object is labelled with what the bytes ARE, not what the
//      request claimed.
// Buffering (rather than streaming straight into R2) is what makes layer 3
// possible; the limits keep that at a few MB per request.

export const RASTER_IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export interface ImageUploadError {
  status: number;
  message: string;
}

export interface ValidatedImage {
  bytes: Uint8Array;
  mime: string;
  extension: string;
}

const UNSUPPORTED_TYPE = "Csak JPEG, PNG, WebP vagy AVIF kép tölthető fel.";

function ascii(bytes: Uint8Array, start: number, end: number): string {
  let text = "";
  for (let i = start; i < end && i < bytes.length; i++) text += String.fromCharCode(bytes[i] ?? 0);
  return text;
}

/** The raster format the leading bytes actually are, or null. */
export function sniffRasterImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    ascii(bytes, 1, 4) === "PNG" &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
    return "image/webp";
  }
  if (bytes.length >= 16 && ascii(bytes, 4, 8) === "ftyp") {
    // An ISO-BMFF container; AVIF announces itself as the major or a
    // compatible brand somewhere in the first few boxes.
    const brands = ascii(bytes, 8, Math.min(bytes.length, 32));
    if (brands.includes("avif") || brands.includes("avis")) return "image/avif";
  }
  return null;
}

/**
 * A structurally complete PNG: signature, a sane IHDR, and the IEND trailer.
 * Used for the signature image of a signed quote, where "starts like a PNG" is
 * not enough — a run of zero bytes with a data-URL prefix must not be
 * accepted as a customer's signature.
 */
export function readCompletePng(bytes: Uint8Array): { width: number; height: number } | null {
  if (sniffRasterImageType(bytes) !== "image/png") return null;
  // 8 signature + 25 IHDR chunk + 12 IEND chunk
  if (bytes.length < 45) return null;
  if (ascii(bytes, 12, 16) !== "IHDR") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width < 1 || height < 1 || width > 5_000 || height > 5_000) return null;
  if (ascii(bytes, bytes.length - 8, bytes.length - 4) !== "IEND") return null;
  return { width, height };
}

/** Layers 1 and 2: header-only checks, before any body is read. */
export function checkImageUploadHeaders(
  request: Request,
  maxBytes: number,
): { mime: string } | { error: ImageUploadError } {
  const mime =
    (request.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (!RASTER_IMAGE_EXTENSIONS[mime]) return { error: { status: 415, message: UNSUPPORTED_TYPE } };
  const size = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(size) || size <= 0) {
    return { error: { status: 411, message: "A fájlméret megadása szükséges." } };
  }
  if (size > maxBytes) {
    return {
      error: {
        status: 413,
        message: `A kép legfeljebb ${Math.floor(maxBytes / 1024 / 1024)} MB lehet.`,
      },
    };
  }
  if (!request.body) return { error: { status: 400, message: "Üres fájl." } };
  return { mime };
}

/** Layer 3: read the body and make sure it really is a raster image. */
export async function readImageUploadBody(
  request: Request,
  maxBytes: number,
): Promise<{ image: ValidatedImage } | { error: ImageUploadError }> {
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0) return { error: { status: 400, message: "Üres fájl." } };
  // The declared Content-Length was checked up front; this is the authority.
  if (bytes.byteLength > maxBytes) {
    return {
      error: {
        status: 413,
        message: `A kép legfeljebb ${Math.floor(maxBytes / 1024 / 1024)} MB lehet.`,
      },
    };
  }
  const mime = sniffRasterImageType(bytes);
  const extension = mime ? RASTER_IMAGE_EXTENSIONS[mime] : undefined;
  if (!mime || !extension) {
    return {
      error: {
        status: 415,
        message: "A fájl tartalma nem érvényes JPEG, PNG, WebP vagy AVIF kép.",
      },
    };
  }
  return { image: { bytes, mime, extension } };
}
