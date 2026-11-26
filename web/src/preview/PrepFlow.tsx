import { FlowView } from "../pages/prep-flow/PreparationFlow";
import { HELD, NORMAL, PARTIAL } from "../../test/prep-flow-fixtures";

// Development-only: draws the three designed states from fixtures so they can be compared with the design.
const STATES = { normal: NORMAL, held: HELD, partial: PARTIAL };

export default function PrepFlowPreview() {
  const key = new URLSearchParams(location.hash.split("?")[1] ?? "").get("state") ?? "normal";
  const input = STATES[key as keyof typeof STATES] ?? NORMAL;
  return <FlowView key={key} input={input} />;
}
