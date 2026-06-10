import type { FormulationKind } from "../../types/ddcTypes";

export type FormulationKey = `F-${string}`;
export type FormulationTypeMap = Partial<Record<FormulationKey, FormulationKind>>;

export function ingredientRowCellClass(
  rowId: string | undefined,
  premixIds: ReadonlySet<string>,
  reagentIds: ReadonlySet<string>
): string {
  if (!rowId) return "first-column";
  if (premixIds.has(rowId)) return "ingredient-cell-premix";
  if (reagentIds.has(rowId)) return "ingredient-cell-reagent";
  return "first-column";
}

export function isPremixFormulation(
  formulationId: FormulationKey,
  types: FormulationTypeMap
): boolean {
  return types[formulationId] === "pre-mix";
}

const sortByFormulationId = (a: FormulationKey, b: FormulationKey) =>
  a.localeCompare(b, undefined, { numeric: true });

/** Registry ids plus any F-* keys on row data (empty recipes still get columns). */
export function collectFormulationKeys(
  formulationTypes: FormulationTypeMap,
  rows: ReadonlyArray<Record<string, unknown>>
): FormulationKey[] {
  const keys = new Set<FormulationKey>(
    Object.keys(formulationTypes) as FormulationKey[]
  );
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (k.startsWith("F-")) keys.add(k as FormulationKey);
    }
  }
  return sortFormulationKeys(keys, formulationTypes);
}

export function sortFormulationKeys(
  keys: Iterable<FormulationKey>,
  types: FormulationTypeMap
): FormulationKey[] {
  const premix: FormulationKey[] = [];
  const other: FormulationKey[] = [];
  for (const key of keys) {
    if (types[key] === "pre-mix") premix.push(key);
    else other.push(key);
  }
  premix.sort(sortByFormulationId);
  other.sort(sortByFormulationId);
  return [...premix, ...other];
}

export function shouldHidePremixColumn(
  formulationId: FormulationKey,
  types: FormulationTypeMap,
  showPremixColumns: boolean
): boolean {
  return !showPremixColumns && isPremixFormulation(formulationId, types);
}

export function formulationColumnClasses(
  formulationId: FormulationKey,
  types: FormulationTypeMap
): { cellClass: string; headerClass: string } {
  if (types[formulationId] === "pre-mix") {
    return {
      cellClass: "formulation-column-premix",
      headerClass: "formulation-column-premix-header",
    };
  }
  return {
    cellClass: "formulation-column-fp",
    headerClass: "formulation-column-fp-header",
  };
}
