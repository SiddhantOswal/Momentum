import { useState } from "react";
import { Icon } from "../../components/m";
import type { Defect } from "../../lib/api";
import { DEFECT_NAME, DEFECT_ORDER } from "../home/data";

/** The design's warning toast for each model the server marks low confidence. */
export function LowConfidenceNotice({ defects }: { defects: Set<Defect> }) {
  const [dismissed, setDismissed] = useState<Set<Defect>>(new Set());
  const shown = DEFECT_ORDER.filter((defect) => defects.has(defect) && !dismissed.has(defect));
  if (shown.length === 0) return null;
  return (
    <div className="in-tsts" aria-live="polite">
      {shown.map((defect) => (
        <div key={defect} className="in-tst" role="status">
          <Icon name="warn" />
          <div><b>{DEFECT_NAME[defect]} model: low confidence</b><span>Supervised use only.</span></div>
          <button type="button" aria-label={`Dismiss ${DEFECT_NAME[defect]} notice`} onClick={() => setDismissed((set) => new Set(set).add(defect))}><Icon name="close" /></button>
        </div>
      ))}
    </div>
  );
}
