import type { FormulationStatus, FormulationKind } from "./ddcTypes";
import type { IngredientRole } from "./ddcTypes";
import type { ProcessSteps } from "./FormulationData.interface";

/** How a nested pre-mix constituent was apportioned into a parent composition. */
export type CompositionScalingMethod = "mass" | "volume-fallback";

/**
 * Runtime warning surfaced in the UI when composition used an approximate
 * volume-based path because mass/density metadata was insufficient.
 */
export interface CompositionWarning {
  code: "VOLUME_NON_ADDITIVE_FALLBACK";
  parentFormulationId: string;
  parentFormulationName: string;
  childFormulationId: string;
  childFormulationName: string;
  message: string;
}

export interface IFormulatedProductCompositionItem{
  parentMaterials: {'id': string, 'name': string, 'amountFrom': number, 'unit': string, 'addedDirectly': boolean}[], // If this material was added as part of any mixture/formulations list their IDs and the % of the total of this component they contribute 
  id: string, // Material Sample ID for quick reference
  name: string, // Material name for quick reference
  role: IngredientRole, // Role in this formulation as added
  amount: number, // Quantity present in this formulation
  unit: string // Quantity unit

}
export type IFormulatedProductComposition = IFormulatedProductCompositionItem[] 

export interface IFormulatedProductFormulaItem {
  id: string, // Material Sample ID for quick reference
  name: string, // Material name for quick reference
  role: IngredientRole, // Role in this formulation as added
  amount?: number, // Quantity Added when making this formulation
  unit: string // Quantity unit
  resolvedAmount?: number // Quantity resolved from percentage
  resolvedUnit?: string // Quantity unit resolved from percentage
  /** User pinned a fixed diluent amount in the formula grid; skip auto recalculation. */
  manualDiluentAmount?: boolean
}

export type IFormulatedProductFormula = IFormulatedProductFormulaItem[] 

export interface IFormulatedProductRecipe {
  formula: IFormulatedProductFormula,
  process: {
    id: string,
    editable: null | {process_steps: boolean},
    process_steps: ProcessSteps
  }
}

export interface IFormulatedProductInputs {
  formulationType: FormulationKind;
  /* Physical properties */
  massAmount?: number;
  massUnit?: string;
  volAmount?: number;
  volUnit?: string;
  density?: number;
  residualMass?: number;
  residualVolume?: number;
  status: FormulationStatus; // What is the status of this material 
  processId?: string // Reference ID to the process execution that generated them
  mixture: boolean; // Can this formulated product be treated as a pure mixture of it's components (e.g. saltwater) or not (e.g. a cake)
  /* Recipe - Materials as added to the formulation - included other formulations  */
  recipe: IFormulatedProductRecipe;
  /* dictionaries of material proportions */
}

export interface IFormulatedProduct {
  /* Runtime flags */
  isDirty: boolean;
  isComputing: boolean;
  formulationType: FormulationKind;
  /* Physical properties */
  massAmount?: number;
  massUnit?: string;
  volAmount?: number;
  volUnit?: string;
  density?: number;
  residualMass?: number;
  residualVolume?: number;
  status: FormulationStatus; // What is the status of this material 
  processId?: string // Reference ID to the process execution that generated them
  mixture: boolean; // Can this formulated product be treated as a pure mixture of it's components (e.g. saltwater) or not (e.g. a cake)
  /* Recipe - Materials as added to the formulation - included other formulations  */
  recipe: IFormulatedProductRecipe;
  /* dictionaries of material proportions */
  concentrations: {[key:number]:{value: number, unit: string}}
  molFractions: {[key:number]:{value: number, unit: string}}
  massPercs: Record<string,{value:number, unit:string}>//{[key:number]:{value: number, unit: string}}
  volPercs: {[key:number]:{value: number, unit: string}}
  /** Ephemeral warnings from the latest recalculate(); not persisted. */
  compositionWarnings?: CompositionWarning[];
}
