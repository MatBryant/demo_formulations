import type { CompositionDisplayUnit } from "./compositionViewConverter";

/** Units available as the global default for formula and composition tables. */
export const TABLE_DEFAULT_UNITS = [
  "g",
  "kg",
  "mg",
  "mL",
  "L",
  "moles",
  "g/mL",
  "g/L",
  "mass%",
  "vol%",
] as const satisfies readonly CompositionDisplayUnit[];

export type TableDefaultUnit = (typeof TABLE_DEFAULT_UNITS)[number];

export const DEFAULT_TABLE_UNIT: TableDefaultUnit = "g";
