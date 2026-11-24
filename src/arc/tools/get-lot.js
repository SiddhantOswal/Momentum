import { getLot } from "../../commands/get-lot.js";
import { needLot, noArgs } from "./policy.js";

export const getLotTool = {
  name: "get_lot",
  description: "Read the current lot and its revision.",
  schema: () => noArgs,
  precondition: needLot,
  execute: (_args, { deps, lot }) => getLot({ lotId: lot.lotId }, deps),
};
