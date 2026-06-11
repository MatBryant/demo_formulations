import type unitConversionEngine from "../classes/UnitConversionEngine";
import {
  DEFAULT_DISPLAY_DECIMALS,
  formatValue,
  roundValue,
} from "./displayDecimals";

/** Absolute units — direct conversion of the canonical amount via UnitConversionEngine. */
export type CompositionAbsoluteUnit =
  | "g"
  | "kg"
  | "mg"
  | "mL"
  | "L"
  | "moles";

/** Percent modes derived from formulation batch totals. */
export type CompositionPercentUnit = "mass%" | "vol%";

/** Concentration modes: component mass ÷ batch volume (not a direct unit conversion). */
export type CompositionConcentrationUnit = "g/L" | "g/mL";

export type CompositionDerivedUnit =
  | CompositionPercentUnit
  | CompositionConcentrationUnit;

export type CompositionDisplayUnit =
  | CompositionAbsoluteUnit
  | CompositionDerivedUnit;

export const COMPOSITION_ABSOLUTE_UNITS: CompositionAbsoluteUnit[] = [
  "g",
  "kg",
  "mg",
  "mL",
  "L",
  "moles",
];

export const COMPOSITION_PERCENT_UNITS: CompositionPercentUnit[] = [
  "mass%",
  "vol%",
];

export const COMPOSITION_CONCENTRATION_UNITS: CompositionConcentrationUnit[] = [
  "g/L",
  "g/mL",
];

export const COMPOSITION_DISPLAY_UNITS: CompositionDisplayUnit[] = [
  ...COMPOSITION_ABSOLUTE_UNITS,
  ...COMPOSITION_CONCENTRATION_UNITS,
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

export function isConcentrationDisplayUnit(
  unit: CompositionDisplayUnit
): unit is CompositionConcentrationUnit {
  return unit === "g/L" || unit === "g/mL";
}

export function isDerivedDisplayUnit(
  unit: CompositionDisplayUnit
): unit is CompositionDerivedUnit {
  return isPercentDisplayUnit(unit) || isConcentrationDisplayUnit(unit);
}

const CANONICAL_UNIT_ALIASES: Record<string, CompositionAbsoluteUnit> = {
  g: "g",
  kg: "kg",
  mg: "mg",
  ml: "mL",
  l: "L",
  moles: "moles",
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
  amount: CompositionDisplayAmount | null | undefined,
  dp: number = DEFAULT_DISPLAY_DECIMALS
): string {
  if (!amount || isZeroDisplayValue(amount.value)) return "";
  return `${formatValue(amount.value, dp)} ${amount.unit}`;
}

function roundedDisplayAmount(
  value: number,
  unit: CompositionDisplayUnit,
  dp: number
): CompositionDisplayAmount {
  return { value: roundValue(value, dp), unit };
}

/** Cross-dimensional conversions (e.g. mL → g) need ingredient metadata. */
function conversionNeedsMaterial(
  fromUnit: string,
  toUnit: string,
  unitConverter: unitConversionEngine
): boolean {
  const u1 = unitConverter.getUnit(fromUnit);
  const u2 = unitConverter.getUnit(toUnit);
  if (!u1 || !u2) return true;
  return !(
    u1.group.toLowerCase() === u2.group.toLowerCase() &&
    u1.base.toLowerCase() === u2.base.toLowerCase()
  );
}

function safeConversion(
  fromUnit: string,
  toUnit: string,
  amount: number,
  material: Record<string, unknown> | undefined,
  unitConverter: unitConversionEngine
): number | null {
  if (conversionNeedsMaterial(fromUnit, toUnit, unitConverter) && !material) {
    return null;
  }
  return unitConverter.conversion(fromUnit, toUnit, amount, material);
}

function massPercent(
  item: CompositionCanonicalItem,
  ctx: FormulationCompositionContext,
  resolveMaterial: MaterialResolver,
  unitConverter: unitConversionEngine
): number | null {
  if (ctx.massAmount == null || !ctx.massUnit) return null;

  const totalG = safeConversion(
    ctx.massUnit,
    "g",
    ctx.massAmount,
    ctx.formulationMaterial,
    unitConverter
  );
  const componentG = safeConversion(
    item.unit,
    "g",
    item.amount,
    resolveMaterial(item.id),
    unitConverter
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

  const totalMl = safeConversion(
    ctx.volUnit,
    "ml",
    ctx.volAmount,
    ctx.formulationMaterial,
    unitConverter
  );
  const componentMl = safeConversion(
    item.unit,
    "ml",
    item.amount,
    resolveMaterial(item.id),
    unitConverter
  );

  if (totalMl == null || componentMl == null || totalMl === 0) return null;
  return (componentMl / totalMl) * 100;
}

/** Mass concentration relative to formulation batch volume (same basis as getComponentConc). */
function massConcentration(
  item: CompositionCanonicalItem,
  volumeUnit: "L" | "mL",
  ctx: FormulationCompositionContext,
  resolveMaterial: MaterialResolver,
  unitConverter: unitConversionEngine
): number | null {
  if (ctx.volAmount == null || !ctx.volUnit) return null;

  const componentG = safeConversion(
    item.unit,
    "g",
    item.amount,
    resolveMaterial(item.id),
    unitConverter
  );
  const totalVol = safeConversion(
    ctx.volUnit,
    volumeUnit,
    ctx.volAmount,
    ctx.formulationMaterial,
    unitConverter
  );

  if (componentG == null || totalVol == null || totalVol === 0) return null;
  return componentG / totalVol;
}

/**
 * Convert one composition row from its canonical amount/unit into a viewer display
 * amount. Derived modes use formulation totals; absolute modes use UnitConversionEngine.
 */
export function convertCompositionForDisplay(
  item: CompositionCanonicalItem,
  displayUnit: CompositionDisplayUnit,
  ctx: FormulationCompositionContext,
  resolveMaterial: MaterialResolver,
  unitConverter: unitConversionEngine,
  dp: number = DEFAULT_DISPLAY_DECIMALS
): CompositionDisplayAmount | null {
  if (displayUnit === "mass%") {
    const value = massPercent(item, ctx, resolveMaterial, unitConverter);
    return value != null ? roundedDisplayAmount(value, "mass%", dp) : null;
  }

  if (displayUnit === "vol%") {
    const value = volPercent(item, ctx, resolveMaterial, unitConverter);
    return value != null ? roundedDisplayAmount(value, "vol%", dp) : null;
  }

  if (displayUnit === "g/L") {
    const value = massConcentration(
      item,
      "L",
      ctx,
      resolveMaterial,
      unitConverter
    );
    return value != null ? roundedDisplayAmount(value, "g/L", dp) : null;
  }

  if (displayUnit === "g/mL") {
    const value = massConcentration(
      item,
      "mL",
      ctx,
      resolveMaterial,
      unitConverter
    );
    return value != null ? roundedDisplayAmount(value, "g/mL", dp) : null;
  }

  const converted = safeConversion(
    item.unit,
    displayUnit,
    item.amount,
    resolveMaterial(item.id),
    unitConverter
  );

  if (converted == null) return null;
  return roundedDisplayAmount(converted, displayUnit, dp);
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
  unitConverter: unitConversionEngine,
  dp: number = DEFAULT_DISPLAY_DECIMALS
): CompositionDisplayAmount | null {
  return convertCompositionForDisplay(
    canonical,
    newDisplayUnit,
    ctx,
    resolveMaterial,
    unitConverter,
    dp
  );
}
