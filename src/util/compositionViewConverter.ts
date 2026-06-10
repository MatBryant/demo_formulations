import type unitConversionEngine from "../classes/UnitConversionEngine";

/** Absolute units shown via UnitConversionEngine. */
export type CompositionAbsoluteUnit =
  | "g"
  | "kg"
  | "mg"
  | "mL"
  | "L"
  | "moles"
  | "g/mL"
  | "g/L";

/** Percent modes derived from formulation totals — no unit converter path. */
export type CompositionPercentUnit = "mass%" | "vol%";

export type CompositionDisplayUnit =
  | CompositionAbsoluteUnit
  | CompositionPercentUnit;

export const COMPOSITION_ABSOLUTE_UNITS: CompositionAbsoluteUnit[] = [
  "g",
  "kg",
  "mg",
  "mL",
  "L",
  "moles",
  "g/mL",
  "g/L",
];

export const COMPOSITION_PERCENT_UNITS: CompositionPercentUnit[] = [
  "mass%",
  "vol%",
];

export const COMPOSITION_DISPLAY_UNITS: CompositionDisplayUnit[] = [
  ...COMPOSITION_ABSOLUTE_UNITS,
  ...COMPOSITION_PERCENT_UNITS,
];

export type CompositionCanonicalItem = {
  id: string;
  amount: number;
  unit: string;
};

/** Formulation-level context for % calculations and material resolution. */
export type FormulationCompositionContext = {
  /** Formulation object (density, etc.) for converting batch totals. */
  formulationMaterial: Record<string, unknown>;
  massAmount?: number | null;
  massUnit?: string | null;
  volAmount?: number | null;
  volUnit?: string | null;
  items: CompositionCanonicalItem[];
};

export type MaterialResolver = (
  id: string
) => Record<string, unknown> | undefined;

export type CompositionDisplayAmount = {
  value: number;
  unit: CompositionDisplayUnit;
};

export function compositionDisplayKey(
  formulationId: string,
  ingredientId: string
): string {
  return `${formulationId}__${ingredientId}`;
}

export function isPercentDisplayUnit(
  unit: CompositionDisplayUnit
): unit is CompositionPercentUnit {
  return unit === "mass%" || unit === "vol%";
}

const CANONICAL_UNIT_ALIASES: Record<string, CompositionAbsoluteUnit> = {
  g: "g",
  kg: "kg",
  mg: "mg",
  ml: "mL",
  l: "L",
  moles: "moles",
  "g/ml": "g/mL",
  "g/l": "g/L",
};

/** Map a stored composition unit to a supported absolute display unit. */
export function defaultDisplayUnit(canonicalUnit: string): CompositionDisplayUnit {
  const mapped = CANONICAL_UNIT_ALIASES[canonicalUnit.toLowerCase()];
  return mapped ?? "g";
}

export function isZeroDisplayValue(value: number | undefined | null): boolean {
  return value != null && Number(value) === 0;
}

export function formatCompositionDisplay(
  amount: CompositionDisplayAmount | null | undefined
): string {
  if (!amount || isZeroDisplayValue(amount.value)) return "";
  return `${amount.value} ${amount.unit}`;
}

function massPercent(
  item: CompositionCanonicalItem,
  ctx: FormulationCompositionContext,
  resolveMaterial: MaterialResolver,
  unitConverter: unitConversionEngine
): number | null {
  if (ctx.massAmount == null || !ctx.massUnit) return null;

  const totalG = unitConverter.conversion(
    ctx.massUnit,
    "g",
    ctx.massAmount,
    ctx.formulationMaterial
  );
  const componentG = unitConverter.conversion(
    item.unit,
    "g",
    item.amount,
    resolveMaterial(item.id)
  );

  if (totalG == null || componentG == null || totalG === 0) return null;
  return (componentG / totalG) * 100;
}

function volPercent(
  item: CompositionCanonicalItem,
  ctx: FormulationCompositionContext,
  resolveMaterial: MaterialResolver,
  unitConverter: unitConversionEngine
): number | null {
  if (ctx.volAmount == null || !ctx.volUnit) return null;

  const totalMl = unitConverter.conversion(
    ctx.volUnit,
    "ml",
    ctx.volAmount,
    ctx.formulationMaterial
  );
  const componentMl = unitConverter.conversion(
    item.unit,
    "ml",
    item.amount,
    resolveMaterial(item.id)
  );

  if (totalMl == null || componentMl == null || totalMl === 0) return null;
  return (componentMl / totalMl) * 100;
}

/**
 * Convert one composition row from its canonical amount/unit into a viewer display
 * amount. Percent modes use formulation totals; absolute modes use UnitConversionEngine.
 */
export function convertCompositionForDisplay(
  item: CompositionCanonicalItem,
  displayUnit: CompositionDisplayUnit,
  ctx: FormulationCompositionContext,
  resolveMaterial: MaterialResolver,
  unitConverter: unitConversionEngine
): CompositionDisplayAmount | null {
  if (displayUnit === "mass%") {
    const value = massPercent(item, ctx, resolveMaterial, unitConverter);
    return value != null ? { value, unit: "mass%" } : null;
  }

  if (displayUnit === "vol%") {
    const value = volPercent(item, ctx, resolveMaterial, unitConverter);
    return value != null ? { value, unit: "vol%" } : null;
  }

  const converted = unitConverter.conversion(
    item.unit,
    displayUnit,
    item.amount,
    resolveMaterial(item.id)
  );

  if (converted == null) return null;
  return { value: converted, unit: displayUnit };
}

/**
 * When the user changes only the display unit, recompute the shown value from
 * canonical storage (never from the previously displayed number).
 */
export function convertCompositionDisplayUnit(
  canonical: CompositionCanonicalItem,
  newDisplayUnit: CompositionDisplayUnit,
  ctx: FormulationCompositionContext,
  resolveMaterial: MaterialResolver,
  unitConverter: unitConversionEngine
): CompositionDisplayAmount | null {
  return convertCompositionForDisplay(
    canonical,
    newDisplayUnit,
    ctx,
    resolveMaterial,
    unitConverter
  );
}
