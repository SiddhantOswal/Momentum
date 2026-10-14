export const DEFAULT_PORT = 8080;

export function readServerPort(value) {
  if (value === undefined || value === "") return DEFAULT_PORT;
  if (typeof value !== "string" || !/^\d{1,5}$/.test(value)) {
    throw new TypeError("PORT must be an integer from 1 to 65535.");
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new RangeError("PORT must be an integer from 1 to 65535.");
  }
  return port;
}
