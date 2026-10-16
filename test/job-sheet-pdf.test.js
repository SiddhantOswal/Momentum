import assert from "node:assert/strict";
import test from "node:test";
import { PdfFontUnavailableError, renderJobSheetPdf } from "../src/job-sheet-pdf.js";
import { jobSheetFixture } from "./fixtures/job-sheet.js";

function extractBuiltInFontText(pdf) {
  return [...pdf.toString("latin1").matchAll(/<([0-9a-f]{2,})>/gi)]
    .map((match) => Buffer.from(match[1], "hex").toString("latin1"))
    .join("");
}

test("JobSheet renderer creates a valid PDF containing supplied order and production data", async () => {
  const pdf = await renderJobSheetPdf(jobSheetFixture);
  const content = pdf.toString("latin1");
  const renderedText = extractBuiltInFontText(pdf);

  assert.equal(pdf.subarray(0, 8).toString("ascii"), "%PDF-1.3");
  assert.ok(content.includes("%%EOF"));
  assert.match(content, /Production Job Sheet JOB-TEST-42/);
  assert.match(renderedText, /Job ID: JOB-TEST-42/);
  assert.match(renderedText, /Order ID: PO-TEST-42/);
  assert.doesNotMatch(renderedText, /Source PO line/);
  assert.match(renderedText, /Customer ID: CUSTOMER-TEST-42/);
  assert.match(renderedText, /quantity: 100 boxes/);
  assert.match(renderedText, /Dimensions: 520 x 360 x 260 mm/);
  assert.match(renderedText, /Baseline production settings/);
  assert.match(renderedText, /Single facer speed: 40 m\/min/);
  assert.match(renderedText, /Recommended production settings/);
  assert.match(renderedText, /rollTempC: 160 C -> 165 C/);
  assert.match(renderedText, /Primary defect: WARP/);
  assert.match(renderedText, /Ambient humidity: 50% RH; temperature: 28 C; paper moisture: 9%/);
  // D4 acceptance condition 3: crack is flagged low confidence on both baseline and recommended rates.
  assert.equal(renderedText.match(/CRACK [\d.]+% \(low confidence in monsoon\)/g)?.length, 2);
  assert.doesNotMatch(renderedText, /(WARP|DELAM|STRENGTH|PRINT) [\d.]+% \(low confidence/);
  const stages = [
    "1. Printing (flexo, top liner)",
    "2. Single facer",
    "3. Sheet cutting",
    "4. Pasting",
    "5. Drying / conditioning",
    "6. Cutting and creasing",
    "7. Slotting",
    "8. Stitching / gluing",
    "9. QC and bundling",
  ].map((stage) => renderedText.indexOf(stage));
  assert.ok(stages.every((position) => position >= 0));
  assert.deepEqual(stages, [...stages].sort((left, right) => left - right));
  assert.match(renderedText, /Savings estimate \(not observed\)/);
  assert.match(renderedText, /0 kg; INR 0/);
  assert.match(renderedText, /Status: DRAFT/);
  assert.match(renderedText, /Explanation text supplied by the renderer test fixture\./);
  assert.doesNotMatch(renderedText, /Status: APPROVED/);
});

test("JobSheet renderer prints the selected PO source line using the operator-facing one-based number", async () => {
  const pdf = await renderJobSheetPdf({
    ...jobSheetFixture,
    order: {
      ...jobSheetFixture.order,
      purchaseOrderLineIndex: 2,
      purchaseOrderSourcePage: 3,
    },
  });
  const renderedText = extractBuiltInFontText(pdf);

  assert.match(renderedText, /Source PO line \(1-based\): 3/);
  assert.match(renderedText, /Source PO page \(1-based\): 3/);
});

test("JobSheet renderer omits absent optional plant and evidence without inventing values", async () => {
  const pdf = await renderJobSheetPdf({ ...jobSheetFixture, changes: [] });
  const content = extractBuiltInFontText(pdf);

  assert.doesNotMatch(content, /Plant ID:/);
  assert.doesNotMatch(content, /Historical evidence supplied/);
  assert.match(content, /No recommended changes were supplied\./);
});

test("JobSheet renderer uses bundled Noto fonts for required scripts", async (t) => {
  const cases = [
    ["Devanagari", "hi", "हिंदी उत्पादन पत्र \u2014 test fixture", "NotoSansDevanagari"],
    ["Japanese", "ja", "日本語の製造指示", "NotoSansJP"],
    ["Korean", "ko", "한국어 생산 지시", "NotoSansKR"],
    ["Simplified Chinese", "zh-CN", "简体中文生产说明", "NotoSansSC"],
  ];

  for (const [script, locale, text, fontName] of cases) {
    await t.test(script, async () => {
      const pdf = await renderJobSheetPdf({
        ...jobSheetFixture,
        explanation: text,
      }, { locale });
      const content = pdf.toString("latin1");

      assert.equal(pdf.subarray(0, 8).toString("ascii"), "%PDF-1.3");
      assert.ok(content.includes("%%EOF"));
      assert.match(content, /\/FontFile2\b/);
      assert.match(content, /\/ToUnicode\b/);
      assert.ok(content.includes(fontName));
    });
  }
});

test("JobSheet renderer fails explicitly when a requested font override is unavailable", async () => {
  await assert.rejects(
    renderJobSheetPdf({
      ...jobSheetFixture,
      explanation: "हिंदी पाठ",
    }, { fontPaths: { devanagari: "/unavailable/NotoSansDevanagari-Regular.ttf" } }),
    (error) => error instanceof PdfFontUnavailableError &&
      error.code === "PDF_FONT_UNAVAILABLE" &&
      error.environmentVariable === "USTAAD_PDF_FONT_DEVANAGARI"
  );

  await assert.rejects(
    renderJobSheetPdf({
      ...jobSheetFixture,
      explanation: "日本語のテスト",
    }, { locale: "ja", fontPaths: { japanese: "/unavailable/NotoSansJP-Regular.ttf" } }),
    (error) => error instanceof PdfFontUnavailableError &&
      error.code === "PDF_FONT_UNAVAILABLE" &&
      error.environmentVariable === "USTAAD_PDF_FONT_JAPANESE"
  );
});

test("JobSheet renderer paginates long explanation text without dropping its ending", async () => {
  const ending = "END-OF-LONG-EXPLANATION";
  const pdf = await renderJobSheetPdf({
    ...jobSheetFixture,
    explanation: `Long explanation supplied for layout verification. ${"Additional supplied text. ".repeat(1_500)}${ending}`,
  });
  const content = pdf.toString("latin1");
  const renderedText = extractBuiltInFontText(pdf);
  const pageCount = [...content.matchAll(/\/Type \/Page\b/g)].length;

  assert.ok(pageCount > 1);
  assert.ok(renderedText.includes(ending));
});

test("JobSheet renderer rejects invalid input instead of producing a success-shaped document", async () => {
  await assert.rejects(
    renderJobSheetPdf({ ...jobSheetFixture, status: "PENDING" }),
    { name: "ZodError" }
  );
});

test("JobSheet renderer reports approval only when the supplied status says APPROVED", async () => {
  const pdf = await renderJobSheetPdf({ ...jobSheetFixture, status: "APPROVED" });
  const renderedText = extractBuiltInFontText(pdf);

  assert.match(renderedText, /Status: APPROVED/);
});

test("session-scoped hackathon cards carry the exact demonstration approval disclaimer", async () => {
  const { HACKATHON_APPROVAL_NOTE } = await import("../src/hackathon-demo-auth.js");
  const jobId = `JOB-HACK-${"a".repeat(32)}-${"b".repeat(40)}`;
  const pdf = await renderJobSheetPdf({ ...jobSheetFixture, jobId, status: "APPROVED" });
  const text = extractBuiltInFontText(pdf);
  assert.ok(text.includes(HACKATHON_APPROVAL_NOTE));
  assert.match(text, /Status: APPROVED/);
});

test("local synthetic cards disclose mock approval before the job identity; default cloud rendering does not opt in", async () => {
 const text=extractBuiltInFontText(await renderJobSheetPdf(jobSheetFixture,{localSyntheticDemo:true}));
 assert.ok(text.includes("LOCAL MOCK BACKUP"));
 assert.ok(text.indexOf("LOCAL MOCK BACKUP")<text.indexOf("Job ID:"));
 const normal=extractBuiltInFontText(await renderJobSheetPdf(jobSheetFixture));
 assert.doesNotMatch(normal,/LOCAL MOCK BACKUP/);
});
