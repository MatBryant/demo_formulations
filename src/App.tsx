import './App.css'
import FormulatedProduct from './classes/Formulated_product'
import getReagents from './util/getReagents'
import unitConversionEngine from './classes/UnitConversionEngine'
import FormulaGrid from './components/formulaGrid'
import CompositionGrid from './components/compositionGrid'
import MetadataTable from './components/metadataTable'
import { useState, useRef, useEffect, useMemo } from 'react'
import { FormulationGraph } from './classes/FormulationGraph'
import type {
  IFormulatedProductRecipe,
  CompositionWarning,
} from '../types/FormulatedProduct.interface'
import type Reagent from './classes/Reagent'
import type { FormulationData, FormulationDataPop }  from '../types/FormulationData.interface'
import type {
  Row,
  Amount,
  DiluentCellValue,
  ReagentSelectPayload,
  RoleChangePayload,
  IngredientChangePayload,
  FormulationCellValue,
} from './components/formulaGrid'
import type {
  Row as CompositionRow,
  CompositionDisplayUnitChange,
} from './components/compositionGrid'
import {
  compositionDisplayKey,
  convertCompositionForDisplay,
  defaultDisplayUnit,
  type CompositionDisplayUnit,
  type FormulationCompositionContext,
} from './util/compositionViewConverter'
import type { FormulationKind, IngredientRole } from '../types/ddcTypes'
import type { FormulationTypeMap } from './util/formulationColumnStyles'
import { nextFormulationId } from './util/formulationIds'
import { useAlignedFormulationGrids } from './hooks/useAlignedFormulationGrids'
import type { IFormulatedProduct } from '../types/FormulatedProduct.interface'

//////////////////////////////////////////////////////
/* RAW DATA */

var formulationsDataBase: FormulationData[] = [
    {
    parameters: {
      id: "F-0001",
      name: "Solvent mixture 1",
      type: "pre-mix",
      density: 0.93, 
      alias: "Solvent mixture 1", 
      costPerGram: 0.0001,
      state: "liquid", 
      hazards: ["H225"],
      status: "In Planning",
      mixture: true,
      massAmount: 178.9,
      massUnit: 'g',
      volAmount: 193,
      volUnit: 'mL',
    },
    recipe: {
      formula: [
        {
          id: "R-001",
          //name: "water",
          role: "solvent", 
          amount: 100,
          unit: 'mL'
        },
        {
          id: "R-002",
          //name: "ethanol",
          role: "solvent", 
          amount: 100,
          unit: 'mL'
        },
      ],
      process: {
        id: "P_0001",
        editable: {
          process_steps: true
        },
        process_steps: []
      }
    }
  },
  {
    parameters: {
      id: "F-0002",
      name: "Formulation 1",
      type: "formulated product",
      density: 0.9, 
      alias: "F1", 
      costPerGram: 0.0001,
      state: "liquid", 
      hazards: ["H225"],
      status: "In Planning",
      mixture: true,
      massAmount: 180,
      massUnit: 'g',
      volAmount: 200,
      volUnit: 'mL',
    },
    recipe: {
      formula: [
        {
          id: "R-001",
          role: "solvent", 
          amount: 50,
          unit: 'mL'
        },
        {
          id: "R-003",
          role: "active", 
          amount: 1,
          unit: 'mL'
        },
        {
          id: "F-0001",
          role: "diluent", 
          amount: undefined,
          unit: 'g'
        },
      ],
      process: {
        id: "P_0001",
        editable: {
          process_steps: true
        },
        process_steps: []
      }
    }
  },
{
    parameters: {
      id: "F-0003",
      name: "Formulation 2",
      type: "formulated product",
      density: 0.9, 
      alias: "F1", 
      costPerGram: 0.0001,
      state: "liquid", 
      hazards: ["H225"],
      status: "In Planning",
      mixture: true,
      massAmount: 180,
      massUnit: 'g',
      volAmount: 200,
      volUnit: 'mL',
    },
    recipe: {
      formula: [
        {
          id: "R-001",
          role: "solvent", 
          amount: 50,
          unit: 'mL'
        },
        {
          id: "R-003",
          role: "active", 
          amount: 5,
          unit: 'mL'
        },
        {
          id: "F-0001",
          role: "diluent", 
          amount: undefined,
          unit: 'g'
        },
      ],
      process: {
        id: "P_0001",
        editable: {
          process_steps: true
        },
        process_steps: []
      }
    }
  },
  {
    parameters: {
      id: "F-0004",
      name: "Formulation 3",
      type: "formulated product",
      density: 0.9, 
      alias: "F1", 
      costPerGram: 0.0001,
      state: "liquid", 
      hazards: ["H225"],
      status: "In Planning",
      mixture: true,
      massAmount: 180,
      massUnit: 'g',
      volAmount: 200,
      volUnit: 'mL',
    },
    recipe: {
      formula: [
        {
          id: "R-001",
          role: "solvent", 
          amount: 50,
          unit: 'mL'
        },
        {
          id: "R-003",
          role: "active", 
          amount: 10,
          unit: 'mL'
        },
        {
          id: "F-0001",
          role: "diluent", 
          amount: undefined,
          unit: 'g'
        },
      ],
      process: {
        id: "P_0001",
        editable: {
          process_steps: true
        },
        process_steps: []
      }
    }
  },
]
//////////////////////////////////////////////////////
/* RUNTIME FUNCTIONS */
formulationsDataBase = []
function normaliseUnitValue(unit: unknown, fallback: string): string {
  if (typeof unit !== "string") return fallback;
  const trimmed = unit.trim();
  return trimmed || fallback;
}

function normaliseFormulaIngredient(
  item: FormulationData["recipe"]["formula"][number]
): FormulationData["recipe"]["formula"][number] {
  if (item.role === "diluent") {
    return { id: item.id, role: item.role, amount: undefined, unit: "g" };
  }
  return {
    id: item.id,
    role: item.role,
    amount: item.amount,
    unit: normaliseUnitValue(item.unit, "mL"),
  };
}

/* Build raw data into formulation object */
function formulationObjectFactory(data: FormulationData, formulationsRegistry: Record<string, FormulationData>, 
  reagentRegistry: Record<string, Reagent>, unitConverter: unitConversionEngine): FormulatedProduct{
  const formula = data.recipe.formula.map((f) => {
    const ingredient = normaliseFormulaIngredient(f);
    return {
      ...ingredient,
      name: reagentRegistry[f.id]
        ? reagentRegistry[f.id].name
        : formulationsRegistry[f.id].parameters.name,
    };
  });
  var recipe: IFormulatedProductRecipe = {
    formula: formula,
    process: {
        id: "placeholder",
        editable: null,
        process_steps: []
    }
  }
  var fp = new FormulatedProduct({
    id: data.parameters.id,
    type: "formulatedProduct",
    name: data.parameters.name ?? `New Formulation-${Object.keys(formulationsRegistry).length + 1}`,
    created: new Date(), 
    density: data.parameters.density, 
    alias: data.parameters.alias ?? data.parameters.name, 
    costPerGram: data.parameters.costPerGram, 
    costUnit: localCurrency, 
    state: data.parameters.state, 
    description: data.parameters.description ?? `A new formulation comprising of ${formula.map(m => `${m.name} (${m.id}): ${m.amount} ${m.unit}`).join(", ")}`,
    hazards: data.parameters.hazards,
    formulationType: data.parameters.type,
    status: data.parameters.status,
    mixture: data.parameters.mixture,
    massAmount: data.parameters.massAmount,
    massUnit: normaliseUnitValue(data.parameters.massUnit, "g"),
    volAmount: data.parameters.volAmount,
    volUnit: normaliseUnitValue(data.parameters.volUnit, "mL"),
    residualMass: data.parameters.residualMass,
    residualVolume: data.parameters.residualVolume,
    recipe: recipe
  }, unitConverter)
  return fp
}


/* Index persisted formulation definitions by ID to enable order-independent graph reconstruction. */
function buildFormulationDataRegistry(persist: FormulationData[]): Record<string, FormulationData> {
  return Object.fromEntries(
    persist.map(formulation => [formulation.parameters.id, formulation])
  );
}

/* Index persisted reagent definitions by ID to enable order-independent graph reconstruction. */
function buildReagentRegistry(persist: Reagent[]): Record<string, Reagent> {
  return Object.fromEntries(
    persist.map(r => [r.id, r])
  );
}
/* Instantiate runtime formulation shells with identity and base properties, deferring relationship wiring and derived calculations. */
function buildFormulationShellRegistry(formulationsRegistry: Record<string, FormulationData>,
  reagentRegistry: Record<string, Reagent>,
  unitConverter: unitConversionEngine): Record<string, FormulatedProduct> {
  return Object.fromEntries(
    Object.entries(formulationsRegistry).map(([id, data]) => [id, formulationObjectFactory(data, formulationsRegistry, reagentRegistry, unitConverter)])
  );
}

function cloneFormulationsDataBase(): FormulationData[] {
  return structuredClone(formulationsDataBase);
}

/** Normalise runtime/exported data back to the persist shape used in formulationsDataBase. */
function toPersistFormulationData(source: FormulationData): FormulationData {
  return {
    parameters: {
      ...source.parameters,
      massUnit: normaliseUnitValue(source.parameters.massUnit, "g"),
      volUnit: normaliseUnitValue(source.parameters.volUnit, "mL"),
      hazards: [...source.parameters.hazards],
    },
    recipe: {
      formula: source.recipe.formula.map((item) => normaliseFormulaIngredient(item)),
      process: structuredClone(source.recipe.process),
    },
  };
}

function createDefaultPremixData(newId: string): FormulationData {
  return {
    parameters: {
      id: newId,
      name: "New pre-mix",
      type: "pre-mix",
      density: 1,
      alias: "New pre-mix",
      costPerGram: 0,
      state: "liquid",
      hazards: [],
      status: "In Planning",
      mixture: true,
      massAmount: 0,
      massUnit: "g",
      volAmount: 0,
      volUnit: "mL",
    },
    recipe: {
      formula: [],
      process: {
        id: "P_0001",
        editable: { process_steps: true },
        process_steps: [],
      },
    },
  };
}

function createDefaultFormulationData(newId: string): FormulationData {
  return {
    parameters: {
      id: newId,
      name: "New formulation",
      type: "formulated product",
      density: 1,
      alias: "New formulation",
      costPerGram: 0,
      state: "liquid",
      hazards: [],
      status: "In Planning",
      mixture: true,
      massAmount: 0,
      massUnit: "g",
      volAmount: 0,
      volUnit: "mL",
    },
    recipe: {
      formula: [],
      process: {
        id: "P_0001",
        editable: { process_steps: true },
        process_steps: [],
      },
    },
  };
}

function cloneFormulationData(source: FormulationData, newId: string): FormulationData {
  const clone = structuredClone(source);
  return {
    parameters: {
      ...clone.parameters,
      id: newId,
      massUnit: normaliseUnitValue(clone.parameters.massUnit, "g"),
      volUnit: normaliseUnitValue(clone.parameters.volUnit, "mL"),
      hazards: [...clone.parameters.hazards],
    },
    recipe: {
      formula: clone.recipe.formula.map((item) => normaliseFormulaIngredient(item)),
      process: structuredClone(clone.recipe.process),
    },
  };
}
  //////////////////////////////////////////////////////
  /* Settings */

  const decimals = 5
  const localCurrency = '$';



type FormulationKey = `F-${string}`;

type MetadataValue = string | number | boolean | undefined ;

type ParamKey = Exclude<
  keyof IFormulatedProduct,
  | "id"
  | "name"
  | "created"
  | "type"
  | "unitConverter"
  // exclude complex/nested structures you don't want edited as scalar cells:
  | "recipe"
  | "composition"
  | "concentrations"
  | "molFractions"
  | "massPercs"
  | "volPercs"
> | "type";

export type MetadataRow = {
  parameter: ParamKey;
  [key: string]: any;
} & Partial<Record<FormulationKey, MetadataValue>>;

type UnPivotedMeta = Record<
  string,                    // outer key – any string
  { name: ParamKey; value: MetadataValue }   // inner shape
>;

  
type InputRow = {
  id: string;
  ingredient: string;
  role: string;
  [key: string]: any; // dynamic F-000X keys
};

function App() {
  const reagents = getReagents();
  const [formulaData, setFormulaData] = useState<Row[]>([]); 
  const [compositionData, setCompositionData] = useState<CompositionRow[]>([]);
  const [compositionWarnings, setCompositionWarnings] = useState<
    CompositionWarning[]
  >([]);
  const [compositionDisplayUnits, setCompositionDisplayUnits] = useState<
    Record<string, CompositionDisplayUnit>
  >({});
  const compositionDisplayUnitsRef = useRef(compositionDisplayUnits);
  const [paramsData, setParamsData] = useState<MetadataRow []>([]);
  const [formulationsReg, setFormulationsReg] = useState<Record<string, FormulatedProduct>>({}); 
  const [formulationsDataPersist, setFormulationsDataPersist] = useState<FormulationData[]>([]);
  const [showPremixColumns, setShowPremixColumns] = useState(true);
  const formulationsRegRef = useRef(formulationsReg);
  const formulationGraphRef = useRef<FormulationGraph | undefined>(undefined);
  const [reagentsReg, setReagentsReg] = useState<Record<string, Reagent>>(); 
  const reagentsRegRef = useRef(reagentsReg);
  const formulaRowOrderRef = useRef<string[]>([]);
  const formulaDataRef = useRef<Row[]>([]);
  const unitConverter = useMemo(
    () => new unitConversionEngine(decimals, false),
    []
  );

  function formulaRowKey(row: Pick<Row, "id" | "role">): string {
    return `${row.id}__${row.role}`;
  }

  function applyRoleChangeToFormulaRefs(
    id: string,
    oldRole: string,
    newRole: string
  ) {
    const oldKey = formulaRowKey({ id, role: oldRole });
    const newKey = formulaRowKey({ id, role: newRole });
    formulaRowOrderRef.current = [
      ...new Set(
        formulaRowOrderRef.current.map((key) => (key === oldKey ? newKey : key))
      ),
    ];
    formulaDataRef.current = formulaDataRef.current.map((row) =>
      row.id === id && row.role === oldRole ? { ...row, role: newRole } : row
    );
  }

  function combineFormulations(data: InputRow[][]): InputRow[] {
    const result: Record<string, InputRow> = {};
    const order: string[] = [];

    data.flat().forEach((item) => {
      const { id, ingredient, role, ...formulations } = item;
      const key = formulaRowKey({ id, role });

      if (!result[key]) {
        result[key] = {
          id,
          ingredient,
          role,
        };
        order.push(key);
      } else {
        result[key].ingredient = ingredient;
      }

      Object.entries(formulations).forEach(([formKey, value]) => {
        result[key][formKey] = value;
      });
    });

    return order.map((key) => result[key]);
  }

  function applyFormulaRowOrder(rows: Row[]): Row[] {
    const byKey = new Map(rows.map((row) => [formulaRowKey(row), row]));
    const nextOrder: string[] = [];

    for (const key of formulaRowOrderRef.current) {
      if (byKey.has(key)) {
        nextOrder.push(key);
      }
    }

    for (const key of byKey.keys()) {
      if (!nextOrder.includes(key)) {
        nextOrder.push(key);
      }
    }

    formulaRowOrderRef.current = nextOrder;
    return nextOrder.map((key) => byKey.get(key)!);
  }

  /** Aggregate volume-fallback warnings from all formulations after recalculate. */
  function resolveMaterial(id: string): Record<string, unknown> | undefined {
    const formulation = formulationsRegRef.current?.[id];
    if (formulation) {
      return formulation as unknown as Record<string, unknown>;
    }
    const reagent = reagentsRegRef.current?.[id];
    if (reagent) {
      return reagent as unknown as Record<string, unknown>;
    }
    return undefined;
  }

  function buildFormulationCompositionContext(
    f: FormulatedProduct
  ): FormulationCompositionContext {
    return {
      formulationMaterial: f as unknown as Record<string, unknown>,
      massAmount: f.massAmount,
      massUnit: f.massUnit,
      volAmount: f.volAmount,
      volUnit: f.volUnit,
      items: f.composition.map((c) => ({
        id: c.id,
        amount: c.amount,
        unit: c.unit,
      })),
    };
  }

  function buildCompositionGridData(): CompositionRow[] {
    const registry = formulationsRegRef.current;
    if (!registry) return [];

    const displayUnits = compositionDisplayUnitsRef.current;

    return combineFormulations(
      Object.values(registry)
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
        .map((f) => {
          const ctx = buildFormulationCompositionContext(f);
          return f.composition.map((comp) => {
            const prefKey = compositionDisplayKey(f.id, comp.id);
            const displayUnit =
              displayUnits[prefKey] ?? defaultDisplayUnit(comp.unit);
            const displayed = convertCompositionForDisplay(
              { id: comp.id, amount: comp.amount, unit: comp.unit },
              displayUnit,
              ctx,
              resolveMaterial,
              unitConverter
            );
            const canonical = { amount: comp.amount, unit: comp.unit };

            return {
              id: comp.id,
              ingredient: comp.name,
              role: comp.role,
              [f.id]: displayed
                ? {
                    value: displayed.value,
                    unit: displayed.unit,
                    canonical,
                  }
                : {
                    value: comp.amount,
                    unit: defaultDisplayUnit(comp.unit),
                    canonical,
                  },
            };
          });
        })
    );
  }

  function handleCompositionDisplayUnitChange({
    formulationId,
    ingredientId,
    displayUnit,
  }: CompositionDisplayUnitChange) {
    const key = compositionDisplayKey(formulationId, ingredientId);
    const next = {
      ...compositionDisplayUnitsRef.current,
      [key]: displayUnit,
    };
    compositionDisplayUnitsRef.current = next;
    setCompositionDisplayUnits(next);
    setCompositionData(buildCompositionGridData());
  }

  function collectCompositionWarnings(
    registry: Record<string, FormulatedProduct>
  ): CompositionWarning[] {
    const seen = new Set<string>();
    const warnings: CompositionWarning[] = [];

    for (const f of Object.values(registry)) {
      for (const w of f.compositionWarnings ?? []) {
        const key = `${w.code}:${w.parentFormulationId}:${w.childFormulationId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        warnings.push(w);
      }
    }
    return warnings;
  }

  function buildFormulaData(): Row[] {
    const rows = combineFormulations(
      Object.values(formulationsReg!)
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
        .map((f) =>
          f.recipe.formula.map((form) => mapFormulaToInputRow(f.id, form))
        )
    );
    const recipeRows = applyFormulaRowOrder(rows);
    const recipeKeys = new Set(recipeRows.map((row) => formulaRowKey(row)));
    const retained = formulaDataRef.current.filter((row) => {
      if (!row.id || !row.role) return false;
      const key = formulaRowKey(row);
      if (recipeKeys.has(key)) return false;
      // Drop stale row when the same ingredient was re-keyed under a new role.
      if (recipeRows.some((r) => r.id === row.id && r.role !== row.role)) {
        return false;
      }
      return true;
    });
    const merged = applyFormulaRowOrder([...recipeRows, ...retained]);
    formulaDataRef.current = merged;
    return merged;
  }

  function combineFormulationParams(data: MetadataRow[][]): MetadataRow[] {
    const result: Record<string, MetadataRow> = {};

    data.flat().forEach((item) => {
      const { parameter, ...formulations } = item;

      // 🔑 group by ingredient + role
      const key = `${parameter}`;

      if (!result[key]) {
        result[key] = {
          parameter
        };
      }

      // Merge F-000X keys
      Object.entries(formulations).forEach(([formKey, value]) => {
        result[key][formKey] = value;
      });
    });

    return Object.values(result);
  }

  const isFormulationKey = (k: string): k is FormulationKey => k.startsWith("F-");

  function toFormulaCell(form: {
    role: string;
    amount?: number;
    unit: string;
    resolvedAmount?: number;
    resolvedUnit?: string;
    manualDiluentAmount?: boolean;
  }): FormulationCellValue | undefined {
    if (form.role === "diluent") {
      const cell: DiluentCellValue = { diluent: true };
      // Auto diluent: display resolved* from calculateDiluent. Manual override uses recipe.amount.
      const displayAmount = form.manualDiluentAmount
        ? form.amount
        : form.resolvedAmount;
      const displayUnit = form.manualDiluentAmount
        ? form.unit
        : (form.resolvedUnit ?? form.unit);
      if (displayAmount != null) {
        cell.value = displayAmount;
        cell.unit = displayUnit as Amount["unit"];
      }
      return cell;
    }
    // mass%/vol%: editable % in the cell; resolved absolute qty shown read-only beside it.
    if (form.unit === "mass%" || form.unit === "vol%") {
      if (form.amount == null) return undefined;
      const cell = {
        percent: true as const,
        value: form.amount,
        unit: form.unit as "mass%" | "vol%",
        ...(form.resolvedAmount != null && form.resolvedUnit
          ? {
              resolvedValue: form.resolvedAmount,
              resolvedUnit: form.resolvedUnit,
            }
          : {}),
      };
      return cell;
    }
    if (form.amount == null) return undefined;
    return { value: form.amount, unit: form.unit as Amount["unit"] };
  }

  function mapFormulaToInputRow(
    formulationId: string,
    form: {
      id: string;
      name: string;
      role: string;
      amount?: number;
      unit: string;
      resolvedAmount?: number;
      resolvedUnit?: string;
      manualDiluentAmount?: boolean;
    }
  ): InputRow {
    const entry: InputRow = {
      id: form.id,
      ingredient: form.name,
      role: form.role,
    };
    const cell = toFormulaCell(form);
    entry[formulationId] = cell ?? { empty: true };
    return entry;
  }

  function unpivotMetadata(row: MetadataRow): UnPivotedMeta {
    const { parameter, ...rest } = row;
    const out: UnPivotedMeta = {};
  
    for (const [k, v] of Object.entries(rest)) {
      if (!isFormulationKey(k)) continue;
      if (v === undefined) continue;
    
      out[k] = { name: parameter, value: v };
    }
  
    return out;
  }

  function setValue<T, K extends keyof T>(
    instance: T,
    key: K,
    value: T[K]
  ): void {
    instance[key] = value;
  }

  function propagateParamChanges(rows: MetadataRow[]) {
    const registry = formulationsReg;
    if (!registry) return;

    // Apply all parameter edits first, then recalculate once per touched formulation.
    // Previously each metadata row called runUpdate for every column — unit changes
    // could be followed by another row's runUpdate before all params were applied.
    const touched = new Set<string>();

    for (const row of rows) {
      const unpivotedRow = unpivotMetadata(row) as UnPivotedMeta;
      for (const [formulationId, cell] of Object.entries(unpivotedRow)) {
        if (!isFormulationKey(formulationId)) continue;

        const rawParam = cell.name as ParamKey;
        const param = rawParam === "type" ? "formulationType" : rawParam;
        let value = cell.value;

        if (param === "mixture" && typeof value === "string") {
          value = value?.toLowerCase() === "true";
        }
        if (param === "massUnit") {
          value = normaliseUnitValue(value, "g");
        }
        if (param === "volUnit") {
          value = normaliseUnitValue(value, "mL");
        }

        const formulation = registry[formulationId];
        if (!formulation || !param) continue;

        // Computed on recalculate from entered recipe ingredients.
        if (param === "residualMass" || param === "residualVolume") continue;

        setValue(formulation, param as keyof IFormulatedProduct, value);
        touched.add(formulationId);
      }
    }

    for (const formulationId of touched) {
      runUpdate(registry[formulationId]);
    }

    setFormulationsReg({ ...registry });
  }

  function propagateIngredientChange({
    formulationId,
    id,
    name,
    role,
    amount,
    unit,
    isDiluent,
    matchId,
    matchRole,
  }: IngredientChangePayload) {
    if (id === formulationId) return

    const newRegistry = formulationsReg
    const formulation = newRegistry[formulationId]
    if (!formulation) return

    const lookupId = matchId ?? id
    const lookupRole = matchRole ?? role
    if (matchId && matchRole && matchRole !== role) {
      applyRoleChangeToFormulaRefs(matchId, matchRole, role);
    }
    const existingIndex = formulation.recipe.formula.findIndex(
      (item) => item.id === lookupId && item.role === lookupRole
    )

    if (isDiluent) {
      if (!id || !role) return

      formulation.recipe.formula = formulation.recipe.formula.filter(
        (item) => item.role !== "diluent"
      )

      formulation.recipe.formula.push({
        id,
        name,
        role: role as IngredientRole,
        amount: undefined,
        unit: "g",
        manualDiluentAmount: false,
      })

      runUpdate(formulation);
      setFormulationsReg({ ...newRegistry });
      return;
    }

    if (amount === undefined) {
      if (!id || !role) return

      if (role === "diluent") {
        if (existingIndex >= 0) {
          formulation.recipe.formula.splice(existingIndex, 1)
          runUpdate(formulation);
          setFormulationsReg({ ...newRegistry });
        }
        return;
      }

      if (existingIndex >= 0) {
        formulation.recipe.formula[existingIndex].amount = undefined;
      } else {
        formulation.recipe.formula.push({
          id,
          name,
          role: role as IngredientRole,
          amount: undefined,
          unit: "g",
        });
      }

      runUpdate(formulation);
      setFormulationsReg({ ...newRegistry });
      return;
    }

    if (!id || !role || !unit) return;

    const item = {
      id,
      name,
      role: role as IngredientRole,
      amount,
      unit:
        role === "diluent"
          ? "g"
          : normaliseUnitValue(unit, "mL"),
      // Pinned diluent quantity in the grid — do not overwrite on later recalculates.
      ...(role === "diluent" ? { manualDiluentAmount: true } : {}),
    }

    if (existingIndex >= 0) {
      const existing = formulation.recipe.formula[existingIndex];
      formulation.recipe.formula[existingIndex] = {
        ...existing,
        ...item,
        manualDiluentAmount: role === "diluent" ? true : existing.manualDiluentAmount,
      }
    } else {
      formulation.recipe.formula.push(item)
    }

    runUpdate(formulation);
    setFormulationsReg({ ...newRegistry });
  }

  function propagateReagentSelect({ oldId, oldRole, ingredient }: ReagentSelectPayload) {
    const newRegistry = formulationsReg
    Object.values(newRegistry).forEach((formulation) => {
      if (ingredient.id === formulation.id) return

      let changed = false
      formulation.recipe.formula.forEach((item) => {
        if (item.id === oldId && item.role === oldRole) {
          item.id = ingredient.id
          item.name = ingredient.name
          changed = true
        }
      })
      if (changed) {
        runUpdate(formulation)
      }
    })
    setFormulationsReg({ ...newRegistry });
  }

  function propagateRoleChange({ id, oldRole, newRole }: RoleChangePayload) {
    applyRoleChangeToFormulaRefs(id, oldRole, newRole);
    const newRegistry = formulationsReg
    Object.values(newRegistry).forEach((formulation) => {
      if (id === formulation.id) return

      const hasMatch = formulation.recipe.formula.some(
        (item) => item.id === id && item.role === oldRole
      )
      if (!hasMatch) return

      if (newRole === "diluent") {
        formulation.recipe.formula = formulation.recipe.formula.filter(
          (item) => item.role !== "diluent"
        )
      }

      let changed = false
      formulation.recipe.formula.forEach((item) => {
        if (item.id === id && item.role === oldRole) {
          item.role = newRole as IngredientRole
          if (newRole === "diluent") {
            item.amount = undefined
            item.manualDiluentAmount = false
          }
          changed = true
        }
      })
      if (changed) {
        runUpdate(formulation)
      }
    })
    setFormulationsReg({ ...newRegistry });
  }

  function syncPersistEntry(formulation: FormulatedProduct) {
    setFormulationsDataPersist((prev) =>
      prev.map((entry) =>
        entry.parameters.id === formulation.id
          ? toPersistFormulationData(formulation.exportData())
          : entry
      )
    );
  }

  function runUpdate(formulation: FormulatedProduct) {
    const graph = formulationGraphRef.current;
    if (!graph) return;

    const updatedData: FormulationData = formulation.exportData();
    console.log(`update to Formulation ${formulation.name}`);
    graph.updateFormulation(formulation.id, updatedData as FormulationDataPop);
    // Mark self + consumers dirty so unit/parameter edits trigger full downstream recalc.
    graph.markDirty(formulation.id);
    syncPersistEntry(formulation);
    graph.ensureAllComputed();
    updateTableData();
  }

  function addFormulationOfKind(kind: FormulationKind) {
    if (!reagentsReg) return;

    const sortedPersist = [...formulationsDataPersist].sort((a, b) =>
      a.parameters.id.localeCompare(b.parameters.id, undefined, { numeric: true })
    );
    const newId = nextFormulationId(
      sortedPersist.map((entry) => entry.parameters.id)
    );

    const sameKind = sortedPersist.filter((entry) => entry.parameters.type === kind);
    const clonedData =
      sameKind.length > 0
        ? (() => {
            const clone = cloneFormulationData(sameKind[sameKind.length - 1], newId);
            clone.parameters.type = kind;
            return clone;
          })()
        : kind === "pre-mix"
          ? createDefaultPremixData(newId)
          : createDefaultFormulationData(newId);

    const nextPersist = [...sortedPersist, clonedData];

    const dataRegistry = buildFormulationDataRegistry(nextPersist);
    const newFormulation = formulationObjectFactory(
      clonedData,
      dataRegistry,
      reagentsReg,
      unitConverter
    );

    setFormulationsDataPersist(nextPersist);
    setFormulationsReg({
      ...formulationsReg,
      [newId]: newFormulation,
    });

    if (kind === "pre-mix") {
      setShowPremixColumns(true);
    }
  }

  function addFormulation() {
    addFormulationOfKind("formulated product");
  }

  function addPremix() {
    addFormulationOfKind("pre-mix");
  }

  function updateTableData(){
      setFormulaData(buildFormulaData())
        
      setCompositionData(buildCompositionGridData())
      // Surface warnings when nested pre-mix expansion fell back to volume apportionment.
      setCompositionWarnings(collectCompositionWarnings(formulationsReg!));

      var paramsData = combineFormulationParams(Object.values(formulationsReg!).map(f =>
        Object.entries((f.exportData().parameters)).map(e=>
         ({'parameter':e[0] as ParamKey,[f.id]: e[1]  })
        )
      )) 
      setParamsData(paramsData)
  }

  useEffect(() => {
    formulationsRegRef.current = formulationsReg;
    if (formulationsReg){
      /* build the formulations graph to track relationships at runtime */
      const formGraph = new FormulationGraph({formulations: Object.values(formulationsReg), reagents:reagents} )
      formGraph.rebuildUsedInIndex();
      formGraph.ensureAllComputed();
      formulationGraphRef.current = formGraph;
      updateTableData();
    }
    if (formulationsReg){
      Object.keys(formulationsReg!).forEach(element => {
        console.log(formulationsReg![element].toJSON())
      });
    }
  }, [formulationsReg]);

    useEffect(() => {
    reagentsRegRef.current = reagentsReg;
  }, [reagentsReg]);

  useEffect(() => {
    compositionDisplayUnitsRef.current = compositionDisplayUnits;
  }, [compositionDisplayUnits]);



  useEffect(() => {
    unitConverter.init().then(_=> {
      var reagentRegistry = buildReagentRegistry(reagents);
      setReagentsReg(reagentRegistry)
      const persist = cloneFormulationsDataBase();
      setFormulationsDataPersist(persist);
      var formulationDataRegistry = buildFormulationDataRegistry(persist);
      var formulationRegistry = buildFormulationShellRegistry(formulationDataRegistry, reagentRegistry, unitConverter);
      setFormulationsReg(formulationRegistry);
      console.log(unitConverter)
    });

    
  }, []);

  const formulationTypes = useMemo<FormulationTypeMap>(() => {
    if (!formulationsReg) return {};
    return Object.fromEntries(
      Object.values(formulationsReg).map((f) => [f.id, f.formulationType])
    ) as FormulationTypeMap;
  }, [formulationsReg]);

  const premixes = useMemo(
    () =>
      Object.values(formulationsReg ?? {})
        .filter((f) => f.formulationType === "pre-mix")
        .map((f) => ({ id: f.id, name: f.name })),
    [formulationsReg]
  );

  const compositionFormulationContexts = useMemo(
    () =>
      Object.fromEntries(
        Object.values(formulationsReg ?? {}).map((f) => [
          f.id,
          buildFormulationCompositionContext(f),
        ])
      ),
    [formulationsReg]
  );

  const { metadataBinding, formulaBinding, compositionBinding } =
    useAlignedFormulationGrids();

  return (
    <>
      <div style={{ width: "1200px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              style={{ backgroundColor: "#059669", color: "white" }}
              onClick={addPremix}
              title="Add pre-mix (clone rightmost pre-mix)"
            >
              + pre-mix
            </button>
            <button
              type="button"
              style={{ backgroundColor: "#4b5563", color: "white" }}
              onClick={() => setShowPremixColumns((visible) => !visible)}
            >
              {showPremixColumns ? "Hide pre-mix columns" : "Show pre-mix columns"}
            </button>
          </div>
          <button
            type="button"
            style={{ backgroundColor: "#2563eb", color: "white" }}
            onClick={addFormulation}
            title="Add formulated product (clone rightmost)"
          >
            + formulation
          </button>
        </div>
        <MetadataTable
          data={paramsData}
          formulationTypes={formulationTypes}
          showPremixColumns={showPremixColumns}
          commit={propagateParamChanges}
          gridBinding={metadataBinding}
        />
        <br/><br/>
        <FormulaGrid
          data={formulaData}
          reagents={reagents}
          premixes={premixes}
          formulationTypes={formulationTypes}
          showPremixColumns={showPremixColumns}
          gridBinding={formulaBinding}
          onIngredientChange={propagateIngredientChange}
          onReagentSelect={propagateReagentSelect}
          onRoleChange={propagateRoleChange}
        />
        <br/><br/>
        <span style={{fontSize: '1.5em', fontWeight: 'bold'}}>Formulation Composition</span>
        <CompositionGrid
          data={compositionData}
          formulationTypes={formulationTypes}
          formulationContexts={compositionFormulationContexts}
          resolveMaterial={resolveMaterial}
          unitConverter={unitConverter}
          showPremixColumns={showPremixColumns}
          gridBinding={compositionBinding}
          warnings={compositionWarnings}
          onDisplayUnitChange={handleCompositionDisplayUnitChange}
        />
      </div>
      
    </>
  )
}

export default App