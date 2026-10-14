import { randomUUID } from "node:crypto";
import { createCloudRunAccessTokenProvider } from "./bigquery-read-client.js";

const STORAGE_UPLOAD_API = "https://storage.googleapis.com/upload/storage/v1";
const STORAGE_API = "https://storage.googleapis.com/storage/v1";
const DEFAULT_MAX_OBJECT_BYTES = 10 * 1024 * 1024;

export class CloudStorageError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CloudStorageError";
    this.code = code;
  }
}

function validateObjectName(name) {
  if (typeof name !== "string" || name.length === 0 || name.length > 1024 ||
      name.startsWith("/") || name.split("/").some((part) => part === "..")) {
    throw new CloudStorageError("INVALID_OBJECT_NAME", "Cloud Storage object name is invalid.");
  }
}

export function createCloudStorageClient({
  bucket,
  tokenProvider,
  fetchImpl = fetch,
  maxObjectBytes = DEFAULT_MAX_OBJECT_BYTES,
} = {}) {
  if (typeof bucket !== "string" || !/^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/.test(bucket)) {
    throw new TypeError("A valid Cloud Storage bucket name is required.");
  }
  if (tokenProvider !== undefined && typeof tokenProvider !== "function") {
    throw new TypeError("Token provider must be a function.");
  }
  if (typeof fetchImpl !== "function") {
    throw new TypeError("Fetch provider must be a function.");
  }
  if (!Number.isSafeInteger(maxObjectBytes) || maxObjectBytes < 1 || maxObjectBytes > 10 * 1024 * 1024) {
    throw new TypeError("maxObjectBytes must be between 1 byte and 10 MiB.");
  }

  const provideToken = tokenProvider ?? createCloudRunAccessTokenProvider({ fetchImpl });

  return Object.freeze({
    async upload({ name, contentType, bytes, signal } = {}) {
      validateObjectName(name);
      if (typeof contentType !== "string" || !/^[\w.+-]+\/[\w.+-]+$/.test(contentType)) {
        throw new CloudStorageError("INVALID_CONTENT_TYPE", "Cloud Storage content type is invalid.");
      }
      const body = bytes instanceof Uint8Array ? bytes
        : bytes instanceof ArrayBuffer ? new Uint8Array(bytes)
          : undefined;
      if (!body || body.byteLength === 0 || body.byteLength > maxObjectBytes) {
        throw new CloudStorageError("OBJECT_SIZE_INVALID", "Cloud Storage object size is invalid.");
      }

      const accessToken = await provideToken({ signal });
      if (typeof accessToken !== "string" || accessToken.length === 0) {
        throw new CloudStorageError("CLOUD_IDENTITY_UNAVAILABLE", "No cloud access token was provided.");
      }

      const url = new URL(
        `${STORAGE_UPLOAD_API}/b/${encodeURIComponent(bucket)}/o`
      );
      url.searchParams.set("uploadType", "media");
      url.searchParams.set("name", name);
      url.searchParams.set("ifGenerationMatch", "0");

      let response;
      try {
        response = await fetchImpl(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": contentType,
          },
          body,
          signal,
        });
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        throw new CloudStorageError("CLOUD_STORAGE_UNAVAILABLE", "Cloud Storage could not be reached.");
      }

      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new CloudStorageError("CLOUD_STORAGE_INVALID_RESPONSE", "Cloud Storage returned an invalid response.");
      }
      if (!response.ok || payload?.error || payload?.name !== name) {
        throw new CloudStorageError("CLOUD_STORAGE_UPLOAD_FAILED", "The Cloud Storage upload failed.");
      }

      return Object.freeze({
        bucket,
        name,
        generation: typeof payload.generation === "string" ? payload.generation : undefined,
        gcsUri: `gs://${bucket}/${name}`,
      });
    },
    async download({ name, signal } = {}) {
      validateObjectName(name);
      const accessToken = await provideToken({ signal });
      if (typeof accessToken !== "string" || accessToken.length === 0) {
        throw new CloudStorageError("CLOUD_IDENTITY_UNAVAILABLE", "No cloud access token was provided.");
      }
      let response;
      try {
        const url = new URL(`${STORAGE_API}/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(name)}`);
        url.searchParams.set("alt", "media");
        response = await fetchImpl(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal,
        });
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        throw new CloudStorageError("CLOUD_STORAGE_UNAVAILABLE", "Cloud Storage could not be reached.");
      }
      if (!response.ok) {
        throw new CloudStorageError("CLOUD_STORAGE_DOWNLOAD_FAILED", "The stored Cloud Storage object could not be read.");
      }
      const contentType = response.headers.get("content-type") ?? "application/octet-stream";
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength === 0 || bytes.byteLength > maxObjectBytes) {
        throw new CloudStorageError("CLOUD_STORAGE_OBJECT_INVALID", "The stored object has an invalid size.");
      }
      return Object.freeze({ name, contentType, bytes });
    },
    async delete({ name, generation, signal } = {}) {
      validateObjectName(name);
      const accessToken = await provideToken({ signal });
      if (typeof accessToken !== "string" || accessToken.length === 0) {
        throw new CloudStorageError("CLOUD_IDENTITY_UNAVAILABLE", "No cloud access token was provided.");
      }
      const url = new URL(`${STORAGE_API}/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(name)}`);
      if (generation !== undefined) url.searchParams.set("ifGenerationMatch", generation);
      let response;
      try {
        response = await fetchImpl(url, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
          signal,
        });
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        throw new CloudStorageError("CLOUD_STORAGE_UNAVAILABLE", "Cloud Storage could not be reached.");
      }
      if (!response.ok && response.status !== 404) {
        throw new CloudStorageError("CLOUD_STORAGE_DELETE_FAILED", "The temporary Cloud Storage object could not be removed.");
      }
      return Object.freeze({ deleted: response.ok });
    },
    createObjectName(prefix, extension = "") {
      if (typeof prefix !== "string" || !/^[a-z][a-z0-9_-]*$/.test(prefix)) {
        throw new CloudStorageError("INVALID_OBJECT_NAME", "Cloud Storage object prefix is invalid.");
      }
      if (typeof extension !== "string" || (extension !== "" && !/^\.[a-z0-9]{1,8}$/.test(extension))) {
        throw new CloudStorageError("INVALID_OBJECT_NAME", "Cloud Storage object extension is invalid.");
      }
      return `${prefix}/${randomUUID()}${extension}`;
    },
  });
}
