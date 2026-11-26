import type { FlowInput } from "../src/pages/prep-flow/model";

// Inputs that match the three approved screens. They exist for tests and the development preview only;
// the page never uses them. PKBX0041 is the documented reference run, PO4 the ambiguous sample order.
export const NORMAL: FlowInput = { state: "normal", lotId: "PKBX0041", lotNote: "1,300 boxes, reference run", at: 7, changeCount: 3, candidateCount: 8640 };
export const HELD: FlowInput = { state: "held", lotId: "PO4", lotNote: "Ambiguous sample, not confirmed", at: 2 };
export const PARTIAL: FlowInput = { state: "partial", lotId: "PKBX0041", lotNote: "1,300 boxes, reference run", at: 6, candidateCount: 8640 };
