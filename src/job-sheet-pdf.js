import { HACKATHON_APPROVAL_NOTE } from "./hackathon-demo-auth.js";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import { JobSheetSchema } from "./schemas.js";

const scriptFontNames = {
  devanagari: "NotoSansDevanagari",
  japanese: "NotoSansJP",
  korean: "NotoSansKR",
  chinese: "NotoSansSC",
  cjk: "NotoSansCJK",
  unicode: "NotoSans",
};

const scriptFontEnvironment = {
  devanagari: "USTAAD_PDF_FONT_DEVANAGARI",
  japanese: "USTAAD_PDF_FONT_JAPANESE",
  korean: "USTAAD_PDF_FONT_KOREAN",
  chinese: "USTAAD_PDF_FONT_CHINESE",
  cjk: "USTAAD_PDF_FONT_CJK",
  unicode: "USTAAD_PDF_FONT_UNICODE",
};

const bundledFontPaths = {
  devanagari: fileURLToPath(new URL("../assets/fonts/devanagari/NotoSansDevanagari[wdth,wght].ttf", import.meta.url)),
  japanese: fileURLToPath(new URL("../assets/fonts/japanese/NotoSansJP[wght].ttf", import.meta.url)),
  korean: fileURLToPath(new URL("../assets/fonts/korean/NotoSansKR[wght].ttf", import.meta.url)),
  chinese: fileURLToPath(new URL("../assets/fonts/chinese/NotoSansSC[wght].ttf", import.meta.url)),
};

const leverUnits = {
  sfSpeedMpm: "m/min",
  rollTempC: "C",
  gumViscositySec: "sec",
  dryingHours: "hours",
  printSpeedSpm: "spm",
};

const winAnsiCodePoints = new Set([
  0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2026, 0x20ac, 0x2122,
]);

export class PdfFontUnavailableError extends Error {
  constructor(script, environmentVariable) {
    super(
      `A Noto Sans font for ${script} text is not configured. ` +
      `Provide a licensed TTF file through ${environmentVariable}.`
    );
    this.name = "PdfFontUnavailableError";
    this.code = "PDF_FONT_UNAVAILABLE";
    this.script = script;
    this.environmentVariable = environmentVariable;
  }
}

function scriptForCharacter(character, locale) {
  const codePoint = character.codePointAt(0);
  if ((codePoint >= 0x0900 && codePoint <= 0x097f) ||
      (codePoint >= 0xa8e0 && codePoint <= 0xa8ff)) {
    return "devanagari";
  }
  if ((codePoint >= 0x3040 && codePoint <= 0x30ff) ||
      (codePoint >= 0x31f0 && codePoint <= 0x31ff) ||
      (codePoint >= 0xff66 && codePoint <= 0xff9f)) {
    return "japanese";
  }
  if ((codePoint >= 0xac00 && codePoint <= 0xd7af) ||
      (codePoint >= 0x1100 && codePoint <= 0x11ff) ||
      (codePoint >= 0x3130 && codePoint <= 0x318f)) {
    return "korean";
  }
  if ((codePoint >= 0x3000 && codePoint <= 0x303f) ||
      (codePoint >= 0xff00 && codePoint <= 0xff65) ||
      (codePoint >= 0xff9e && codePoint <= 0xffef)) {
    if (locale === "ja" || locale === "ko" || locale === "zh-CN") {
      return { ja: "japanese", ko: "korean", "zh-CN": "chinese" }[locale];
    }
    return "cjk";
  }
  if ((codePoint >= 0x3400 && codePoint <= 0x4dbf) ||
      (codePoint >= 0x4e00 && codePoint <= 0x9fff) ||
      (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
      (codePoint >= 0x20000 && codePoint <= 0x323af)) {
    if (locale === "ja" || locale === "ko" || locale === "zh-CN") {
      return { ja: "japanese", ko: "korean", "zh-CN": "chinese" }[locale];
    }
    return "cjk";
  }
  if (winAnsiCodePoints.has(codePoint)) {
    return "Helvetica";
  }
  if (codePoint > 0x00ff) {
    return "unicode";
  }
  return "Helvetica";
}

function collectText(jobSheet) {
  const lines = [
    ["title", "Production Job Sheet"],
    ["line", `Job ID: ${jobSheet.jobId}`],
    ["line", `Status: ${jobSheet.status}`],
  ];

  if (jobSheet.plantId) {
    lines.push(["line", `Plant ID: ${jobSheet.plantId}`]);
  }

  lines.push(
    ["heading", "Order"],
    ["line", `Order ID: ${jobSheet.order.orderId}`],
    ...(jobSheet.order.sourcePoNumber ? [["line", `Original PO number: ${jobSheet.order.sourcePoNumber}`]] : []),
    ...(jobSheet.order.purchaseOrderLineIndex === undefined
      ? []
      : [["line", `Source PO line (1-based): ${jobSheet.order.purchaseOrderLineIndex + 1}`]]),
    ...(jobSheet.order.purchaseOrderSourcePage === undefined
      ? []
      : [["line", `Source PO page (1-based): ${jobSheet.order.purchaseOrderSourcePage}`]]),
    ["line", `Customer ID: ${jobSheet.order.customerId}`],
    ["line", `Box style: ${jobSheet.order.boxStyle}; quantity: ${jobSheet.order.quantity.toLocaleString("en-US")} boxes`],
    ["line", `Dimensions: ${jobSheet.order.lengthMm} x ${jobSheet.order.widthMm} x ${jobSheet.order.heightMm} mm`],
    ["line", `Board: ${jobSheet.order.ply}-ply, ${jobSheet.order.fluteProfile} flute; ${jobSheet.order.paperType} paper`],
    ["line", `Paper: top liner ${jobSheet.order.topLinerGsm} gsm, flute ${jobSheet.order.fluteGsm} gsm, inner liner ${jobSheet.order.innerLinerGsm} gsm, liner BF ${jobSheet.order.linerBf}`],
    ["line", `Printing: ${jobSheet.order.inkColors} colors, ${jobSheet.order.inkCoveragePct}% coverage; supplier ${jobSheet.order.paperSupplier}`],
    ["heading", "Production conditions"],
    ["line", `Run date: ${jobSheet.conditions.runDate}; shift: ${jobSheet.conditions.shift}`],
    ["line", `Ambient humidity: ${jobSheet.conditions.ambientRhPct}% RH; temperature: ${jobSheet.conditions.ambientTempC} C; paper moisture: ${jobSheet.conditions.paperMoisturePct}%`],
    ...(jobSheet.conditions.conditionSource
      ? [["line", `Conditions source: ${jobSheet.conditions.conditionSource}; supervisor confirmed: ${jobSheet.conditions.supervisorConfirmed === true ? "yes" : "no"}`]]
      : []),
    ...(jobSheet.conditions.provenance
      ? [["line", `Simulated reading age: ${Math.floor(jobSheet.conditions.provenance.ageSeconds / 3600)} h${jobSheet.conditions.provenance.freshness === "stale" ? " — STALE (over 24 hours)" : ""}`]]
      : []),
    ["heading", "Manufacturing stages — approved prototype order"],
    ...manufacturingStages(jobSheet.recommended.levers),
    ["heading", "Baseline production settings"],
  );
  appendLevers(lines, jobSheet.baseline.levers);
  lines.push(
    ["heading", "Baseline risk"],
    ["line", `Primary defect: ${jobSheet.baseline.risk.primaryDefect}`],
    ["line", `Total scrap: ${jobSheet.baseline.risk.totalScrapKg} kg; scrap cost: ${jobSheet.baseline.risk.currency} ${jobSheet.baseline.risk.scrapCost}`],
    ["line", `Defect rates (%): ${formatRates(jobSheet.baseline.risk.ratesPct)}`],
    ["heading", "Recommended production settings"],
  );
  appendLevers(lines, jobSheet.recommended.levers);
  lines.push(
    ["line", `Primary defect: ${jobSheet.recommended.risk.primaryDefect}`],
    ["line", `Total scrap: ${jobSheet.recommended.risk.totalScrapKg} kg; scrap cost: ${jobSheet.recommended.risk.currency} ${jobSheet.recommended.risk.scrapCost}`],
    ["line", `Defect rates (%): ${formatRates(jobSheet.recommended.risk.ratesPct)}`],
    ["heading", "Recommended changes"],
  );

  if (jobSheet.changes.length === 0) {
    lines.push(["line", "No recommended changes were supplied."]);
  } else {
    for (const change of jobSheet.changes) {
      lines.push([
        "line",
        `${change.lever}: ${formatLeverChangeValue(change.lever, change.from)} -> ${formatLeverChangeValue(change.lever, change.to)} (${change.reason})`,
      ]);
    }
  }

  lines.push(
    ["heading", "Savings estimate (not observed)"],
    ["line", `${jobSheet.savings.kg} kg; INR ${jobSheet.savings.inr}`],
  );

  if (jobSheet.evidence?.length) {
    lines.push(["heading", "Historical evidence supplied"]);
    for (const run of jobSheet.evidence) {
      lines.push(["line", `Lot ${run.lotId}; order ${run.orderId}; ${run.runDate}; primary defect ${run.primaryDefect}`]);
    }
  }

  lines.push(["heading", "Explanation"], ["line", jobSheet.explanation]);
  return lines;
}

function manufacturingStages(levers) {
  return [
    ["line", `1. Printing (flexo, top liner): print speed ${levers.printSpeedSpm} sheets/min`],
    ["line", `2. Single facer: ${levers.sfSpeedMpm} m/min; roll ${levers.rollTempC} C; gum ${levers.gumApplication}; viscosity ${levers.gumViscositySec} sec`],
    ["line", "3. Sheet cutting"],
    ["line", `4. Pasting: gum ${levers.gumApplication}; pasting pressure ${levers.pastingPressure}`],
    ["line", `5. Drying / conditioning: ${levers.dryingHours} hours`],
    ["line", "6. Cutting and creasing"],
    ["line", "7. Slotting"],
    ["line", "8. Stitching / gluing"],
    ["line", "9. QC and bundling"],
  ];
}

function appendLevers(lines, levers) {
  lines.push(
    ["line", `Single facer speed: ${levers.sfSpeedMpm} m/min; roll temperature: ${levers.rollTempC} C`],
    ["line", `Gum: ${levers.gumApplication}; viscosity: ${levers.gumViscositySec} sec; pasting pressure: ${levers.pastingPressure}`],
    ["line", `Drying: ${levers.dryingHours} hours; print speed: ${levers.printSpeedSpm} spm`],
  );
}

function formatRates(rates) {
  // Same caveat as the UI risk card: the crack model has the weakest fit (D4, R² 0.30).
  return ["WARP", "DELAM", "STRENGTH", "PRINT", "CRACK"]
    .map((defect) => `${defect} ${rates[defect]}%${defect === "CRACK" ? " (low confidence in monsoon)" : ""}`)
    .join(", ");
}

function formatLeverChangeValue(lever, value) {
  const formattedValue = typeof value === "number" ? value.toLocaleString("en-US") : value;
  const unit = leverUnits[lever];
  return unit && typeof value === "number" ? `${formattedValue} ${unit}` : formattedValue;
}

function textRuns(text, locale, configuredFonts) {
  const runs = [];
  for (const character of text) {
    const script = scriptForCharacter(character, locale);
    let fontName = "Helvetica";
    if (script !== "Helvetica") {
      const fontPath = configuredFonts[script];
      if (!fontPath || !existsSync(fontPath)) {
        throw new PdfFontUnavailableError(script, scriptFontEnvironment[script]);
      }
      const expectedName = scriptFontNames[script];
      if (!path.basename(fontPath).toLowerCase().startsWith(expectedName.toLowerCase())) {
        throw new PdfFontUnavailableError(script, scriptFontEnvironment[script]);
      }
      fontName = `unicode-${script}`;
    }

    const lastRun = runs.at(-1);
    if (lastRun?.fontName === fontName) {
      lastRun.text += character;
    } else {
      runs.push({ fontName, text: character, fontPath: script === "Helvetica" ? undefined : configuredFonts[script] });
    }
  }
  return runs;
}

export async function renderJobSheetPdf(input, {
  locale = "en",
  fontPaths = {},
  localSyntheticDemo = false,
} = {}) {
  const jobSheet = JobSheetSchema.parse(input);
  const configuredFonts = {
    devanagari: fontPaths.devanagari ?? process.env[scriptFontEnvironment.devanagari] ?? bundledFontPaths.devanagari,
    japanese: fontPaths.japanese ?? process.env[scriptFontEnvironment.japanese] ?? bundledFontPaths.japanese,
    korean: fontPaths.korean ?? process.env[scriptFontEnvironment.korean] ?? bundledFontPaths.korean,
    chinese: fontPaths.chinese ?? process.env[scriptFontEnvironment.chinese] ?? bundledFontPaths.chinese,
    cjk: fontPaths.cjk ?? process.env[scriptFontEnvironment.cjk],
    unicode: fontPaths.unicode ?? process.env[scriptFontEnvironment.unicode],
  };
  const lines = collectText(jobSheet);
  if (localSyntheticDemo) lines.splice(1, 0, ["line", "LOCAL MOCK BACKUP - mock outputs and simulated approval; not cloud persisted."]);
  if (/^JOB-HACK-[a-f0-9]{32}-[a-f0-9]{40}$/.test(jobSheet.jobId)) lines.splice(3, 0, ["line", HACKATHON_APPROVAL_NOTE]);
  const resolvedTextRuns = lines.map(([kind, text]) => ({
    kind,
    text,
    runs: textRuns(text, locale, configuredFonts),
  }));
  const fontsToRegister = new Map();
  for (const { runs } of resolvedTextRuns) {
    for (const run of runs) {
      if (run.fontPath) {
        fontsToRegister.set(run.fontName, run.fontPath);
      }
    }
  }
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 48, bottom: 48, left: 48, right: 48 },
    compress: false,
    subset: true,
    info: {
      Title: `Production Job Sheet ${jobSheet.jobId}`,
      Subject: `Order ${jobSheet.order.orderId}`,
    },
  });
  const chunks = [];
  const result = new Promise((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  for (const [fontName, fontPath] of fontsToRegister) {
    doc.registerFont(fontName, fontPath);
  }

  for (const { kind, text, runs } of resolvedTextRuns) {
    if (kind === "title") {
      doc.font("Helvetica-Bold").fontSize(20).text(text);
      doc.moveDown(0.4);
    } else if (kind === "heading") {
      doc.moveDown(0.5).font("Helvetica-Bold").fontSize(12).text(text);
      doc.moveDown(0.15);
    } else {
      doc.fontSize(9);
      runs.forEach((run, index) => {
        doc.font(run.fontName);
        doc.text(run.text, { continued: index < runs.length - 1, width: 500 });
      });
      doc.moveDown(0.25);
    }
  }

  doc.end();
  return result;
}
