import assert from "node:assert/strict";
import test from "node:test";
import { checkWriterText } from "../src/arc/answer-checks.js";

const scores = [{ tool: "get_status", label: "Modeled, tested on 219 lots", rows: [{ defect: "PRINT", r2: 0.6404, sampleCount: 219 }] }];

test("written text may have up to three sentences and no more", () => {
  const sentence = "Print scores 0.64.";
  assert.equal(checkWriterText([sentence, sentence, sentence].join(" "), scores), null);
  assert.equal(checkWriterText([sentence, sentence, sentence, sentence].join(" "), scores), "ANSWER_SHAPE");
});

test("written text with markup, a list or a line break is rejected", () => {
  assert.equal(checkWriterText("Print scores 0.64.", scores), null);
  for (const written of ["**Print** scores 0.64.", "- Print scores 0.64.", "Print scores 0.64.\nIt is modeled.", "Print | 0.64", "[Print](x) scores 0.64."]) {
    assert.equal(checkWriterText(written, scores), "ANSWER_SHAPE", written);
  }
});
