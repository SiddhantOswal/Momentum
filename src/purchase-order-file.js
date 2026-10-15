const SUPPORTED_TYPES = Object.freeze({
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
});
export const MAX_DECODED_JPEG_PIXELS = 40_000_000;
export const MAX_PURCHASE_ORDER_BYTES = 10 * 1024 * 1024;

const JPEG_START_OF_FRAME = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function jpegPixelCount(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;
  let offset = 2;
  while (offset < bytes.length) {
    while (offset < bytes.length && bytes[offset] !== 0xff) offset += 1;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) return undefined;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return undefined;
    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return undefined;
    if (JPEG_START_OF_FRAME.has(marker)) {
      if (segmentLength < 7) return undefined;
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      if (width < 1 || height < 1) return undefined;
      return width * height;
    }
    offset += segmentLength;
  }
  return undefined;
}

export function identifyPurchaseOrderMimeType(file, bytes) {
  if (!file || !(bytes instanceof Uint8Array)) return undefined;
  const name = typeof file.name === "string" ? file.name.toLowerCase() : "";
  const extension = Object.keys(SUPPORTED_TYPES).find((suffix) => name.endsWith(suffix));
  const declaredType = file.type;
  const mimeType = Object.values(SUPPORTED_TYPES).includes(declaredType)
    ? declaredType
    : (declaredType === undefined || declaredType === "" || declaredType === "application/octet-stream")
      ? SUPPORTED_TYPES[extension] ??
        (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
          ? "image/jpeg"
          : "application/pdf")
      : undefined;
  if (!mimeType || (extension && SUPPORTED_TYPES[extension] !== mimeType)) return undefined;

  if (mimeType === "application/pdf") {
    return Buffer.from(bytes.subarray(0, 1024)).includes(Buffer.from("%PDF-"))
      ? mimeType
      : undefined;
  }
  const pixels = jpegPixelCount(bytes);
  return Number.isSafeInteger(pixels) && pixels <= MAX_DECODED_JPEG_PIXELS
    ? mimeType
    : undefined;
}
