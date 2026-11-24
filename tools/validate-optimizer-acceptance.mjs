import { readFileSync } from "node:fs";

const DEFECTS = ["WARP", "DELAM", "STRENGTH", "PRINT", "CRACK"];

function readActiveConfig() {
  return JSON.parse(readFileSync(new URL("../config/model-acceptance.json", import.meta.url), "utf8"));
}

export function validateM2Acceptance(record = readActiveConfig()) {
  const models = Array.isArray(record?.models) ? record.models : [];
  const byDefect = new Map(models.map((model) => [model?.defect, model]));
  const comparison = [];

  for (const defect of DEFECTS) {
    const model = byDefect.get(defect);
    const passResource = typeof model?.resource === "string" &&
      model.resource === `prepagent.m2_${defect.toLowerCase()}`;
    const passR2 = typeof model?.r2 === "number" && Number.isFinite(model.r2);
    comparison.push({ defect, field: "resource", expected: `prepagent.m2_${defect.toLowerCase()}`, actual: model?.resource, pass: passResource });
    comparison.push({ defect, field: "r2", expected: model?.r2, actual: model?.r2, pass: passR2 });
  }

  const differences = comparison.filter(({ pass }) => !pass);
  return {
    ok: models.length === DEFECTS.length && differences.length === 0,
    models: DEFECTS.map((defect) => {
      const model = byDefect.get(defect);
      return { defect, resource: model?.resource, r2: model?.r2 };
    }),
    comparison,
    differences,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = validateM2Acceptance();
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exitCode = result.ok ? 0 : 1;
}
