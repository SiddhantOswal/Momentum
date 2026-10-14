const SUPPORTED_TYPES = Object.freeze({
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
});

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
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    ? mimeType
    : undefined;
}
