import { createHash } from "node:crypto";
import { mapFeedbackToBigQuery } from "../bigquery-mapper.js";
import { BigQueryWriteError } from "./bigquery-write-client.js";

function unavailable() {
  return { ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "Feedback persistence is temporarily unavailable." } };
}

function photoFeedbackUnavailable() {
  return {
    ok: false,
    error: {
      code: "SERVICE_UNAVAILABLE",
      message: "Photo feedback is disabled until consent capture and provenance-safe storage are configured.",
    },
  };
}

export function createFeedbackService({ writer, now = () => new Date() } = {}) {
  if (!writer || typeof writer.insertRow !== "function") {
    throw new TypeError("A bounded BigQuery write client is required.");
  }
  return async function saveFeedback(input = {}) {
    const { signal, testOrderId, ...feedbackInput } = input;
    if ([feedbackInput.photoUri, feedbackInput.photoDefect, feedbackInput.photoConfidence]
      .some((value) => value !== undefined)) {
      return photoFeedbackUnavailable();
    }
    const createdAt = now().toISOString();
    const row = mapFeedbackToBigQuery(feedbackInput, createdAt);
    const retryIdentity = { ...row };
    delete retryIdentity.created_at;
    const insertId = `feedback-${createHash("sha256").update(JSON.stringify(retryIdentity)).digest("hex")}`;
    try {
      await writer.insertRow({ table: "feedback", insertId, row, testOrderId, signal });
      return { ok: true, agent: "saveFeedback", status: "stored", createdAt };
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      if (error instanceof BigQueryWriteError) return unavailable();
      return unavailable();
    }
  };
}
