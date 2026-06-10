import type { FormulationStatus, FormulationKind } from './ddcTypes'
import type{ IngredientRole } from './ddcTypes'

/**
 * Editable flags for a single process step.
 */
export interface StepEditable {
  actions: boolean;
  vessel: boolean;
  general_conditions: boolean;
  parent_connections: boolean;
  /** note the hyphen – it must be quoted */
  "child-connections": boolean;
}

/**
 * Editable flags for a general condition.
 */
export interface GeneralConditionEditable {
  value: boolean;
  unit: boolean;
}

/**
 * Value object inside a general condition.
 */
export interface GeneralConditionValue {
  planned: number;
  actual?: number;   // optional – you only had it in the example
  unit: string;
}

/**
 * A general condition (e.g. temperature).
 */
export interface GeneralCondition {
  editable: GeneralConditionEditable;
  id: string;          // e.g. "gc-temp-298k"
  name: string;        // e.g. "temperature"
  value: GeneralConditionValue;
  instrument: string;  // e.g. "mantle-01"
}

/**
 * Vessel information for a step.
 */
export interface ProcessVessel {
  editable: boolean;
  process_vessel_id: string; // e.g. "1"
  type_id: string;           // e.g. "vsl-01"
  nice_name: string;         // e.g. "conical flask"
  max_quantity: string;      // e.g. "1L"
}

/**
 * Editable flags for an ingredient.
 */
export interface IngredientEditable {
  ingredient_id: boolean;
  role: boolean;
  amount: boolean;
  unit: boolean;
}

/**
 * Amount object for an ingredient.
 */
export interface IngredientAmount {
  planned: number; // e.g. 100
  unit: string;    // e.g. "mL"
}

/**
 * An ingredient used in an action.
 */
export interface Ingredient {
  editable: IngredientEditable;
  ingredient_id: string;   // e.g. "mat-0123"
  ingredient_name: string; // e.g. "ethanol"
  role: string;            // e.g. "solvent"
  amount: IngredientAmount;
}

/**
 * A single action inside a step.
 */
export interface Action {
  action_id: string;      // e.g. "act-001"
  action_name: string;    // e.g. "add‑ingredient"
  editable: boolean;
  ingredients: Ingredient[];
  parameters: any[];      // you can replace `any` with a more specific type if known
}

/**
 * Connection to another process step (child).
 */
export interface ChildConnection {
  type: string; // e.g. "process"
  id: string;   // e.g. "stp-002"
}

/**
 * A single process step.
 */
export interface ProcessStep {
  editable: StepEditable;
  step_id: string;        // e.g. "stp-001"
  step_name: string;      // e.g. "Add solvent to vessel"

  general_conditions: GeneralCondition[];
  vessel: ProcessVessel;
  actions: Action[];

  parent_connections: any[];   // unknown shape – replace `any` if you have a definition
  child_connections: ChildConnection[];
}

/**
 * The top‑level array that contains all process steps.
 */
export type ProcessSteps = ProcessStep[];

/**
 * single ingredient in the formula.
 */
export interface FormulaIngredient {
  id: string,
  role: IngredientRole, 
  amount?: number,
  unit: string
}

/**
 * The top‑level array that contains all ingredients.
 */
export type Formula = FormulaIngredient[];

/**
 * Persistant datamodel for a formulated product
 */

export interface Parameters {
    id: string,
    name: string,
    type: FormulationKind,
    density?: number, 
    alias?: string, 
    costPerGram: number,
    state: string, 
    description?: string,
    hazards: string[],
    status: FormulationStatus,
    mixture: boolean,
    massAmount?: number,
    massUnit?: string,
    volAmount?: number,
    volUnit?: string,
    residualMass?: number,
    residualVolume?: number,
  }

export interface Recipe{
    formula: Formula
    process: {
      id: string,
      editable: null | {process_steps: boolean},
      process_steps: ProcessSteps
    }
  }

export interface FormulationData {
  parameters: Parameters,
  recipe: Recipe
}

/**
 * single ingredient in the populated formula.
 */
export interface RecipeIngredientPop {
  id: string,
  name: string
  role: IngredientRole, 
  amount?: number,
  unit: string
}

/**
 * Datamodel for updating a formulation 
 */
export interface FormulationDataPop {
  parameters:{
    id: string,
    name: string,
    type: FormulationKind,
    density?: number, 
    alias?: string, 
    costPerGram: number,
    state: string, 
    description?: string,
    hazards: string[],
    status: FormulationStatus,
    mixture: boolean,
    massAmount: number,
    massUnit: string,
    volAmount: number,
    volUnit: string,
    residualMass?: number,
    residualVolume?: number,
  },
  recipe: {
    formula: RecipeIngredientPop[],
    process: {
      id: string,
      editable: null | {process_steps: boolean},
      process_steps: ProcessSteps
    }
  }
}
