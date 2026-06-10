import './App.css'
import FormulatedProduct from './classes/Formulated_product'
import getReagents from './util/getReagents'
import unitConversionEngine from './classes/UnitConversionEngine'

import type { IFormulatedProductFormula, IFormulatedProductRecipe} from '../types/FormulatedProduct.interface'
import type { Recipe } from '../types/FormulationData.interface'
import type Reagent from './classes/Reagent'
import type { Ingredient } from '../types/Ingredient'
import type { FormulationData }  from '../types/FormulationData.interface'
import { useState, useRef, useEffect} from 'react'

//////////////////////////////////////////////////////
/* Settings */

const decimals = 5
const localCurrency = '$';
const reagents = getReagents();
var formulations: FormulatedProduct[] = [];

//////////////////////////////////////////////////////
/* RAW DATA */

const formulationsDataBase: FormulationData[] = [
    {
    parameters: {
      id: "F-0001",
      name: "Solvent mixture 1",
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
          role: "active", 
          amount: 50,
          unit: 'mL'
        },
        {
          id: "R-003",
          role: "active", 
          amount: 1,
          unit: 'moles'
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
          role: "active", 
          amount: 50,
          unit: 'mL'
        },
        {
          id: "R-003",
          role: "active", 
          amount: 0.13,
          unit: 'l'
        },
        {
          id: "F-0002",
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
  }
]
//////////////////////////////////////////////////////
/* RUNTIME FUNCTIONS */

/* Build raw data into formulation object */
function formulationObjectFactory(data: FormulationData, dataRegistry: Record<string, FormulationData>, unitConverter: unitConversionEngine): FormulatedProduct{
  
  var formula = buildFormula(data.recipe.formula, reagents, dataRegistry)
  var recipe: IFormulatedProductRecipe = {
    formula: formula,
    process: {
        id: "placeholder",
        process_steps: []
    }
  }
  var fp = new FormulatedProduct({
    id: data.parameters.id,
    type: "formulatedProduct",
    name: data.parameters.name ?? `New Formulation-${formulations.length + 1}`,
    created: new Date(), 
    density: data.parameters.density, 
    alias: data.parameters.alias ?? data.parameters.name, 
    costPerGram: data.parameters.costPerGram, 
    costUnit: localCurrency, 
    state: data.parameters.state, 
    description: data.parameters.description ?? `A new formulation comprising of ${formula.map(m => `${m.name} (${m.id}): ${m.amount} ${m.unit}`).join(", ")}`,
    hazards: data.parameters.hazards,
    status: data.parameters.status,
    mixture: data.parameters.mixture,
    massAmount: data.parameters.massAmount,
    massUnit: data.parameters.massUnit,
    volAmount: data.parameters.volAmount,
    volUnit: data.parameters.volUnit,
    recipe: recipe
  }, unitConverter)
  return fp
}

/* Build ingredients data into formula structure */
function buildFormula(ingredients: Recipe, reagents: Reagent[], dataRegistry: Record<string, FormulationData>): IFormulatedProductFormula{
  var newRecipe = ingredients.map(ingredient => {
    var component: Ingredient = reagents.filter(r => r.id == ingredient.id)[0]??null
    return  {
      id: ingredient.id,
      name: component?component.name:dataRegistry[ingredient.id].parameters.name, // Fetch name 
      role: ingredient.role, 
      amount: ingredient.amount,
      unit: ingredient.unit,
      componentObject: component
    }
  })
  return newRecipe
}

/* Index persisted formulation definitions by ID to enable order-independent graph reconstruction. */
function buildFormulationDataRegistry(persist: FormulationData[]): Record<string, FormulationData> {
  return Object.fromEntries(
    persist.map(formulation => [formulation.parameters.id, formulation])
  );
}

/* Instantiate runtime formulation shells with identity and base properties, deferring relationship wiring and derived calculations. */
function buildFormulationShellRegistry(dataRegistry: Record<string, FormulationData>, unitConverter: unitConversionEngine): Record<string, FormulatedProduct> {
  return Object.fromEntries(
    Object.entries(dataRegistry).map(([id, data]) => [id, formulationObjectFactory(data, dataRegistry, unitConverter)])
  );
}

/* Wire the formulation graph by resolving each formula formulation item’s id to a runtime object and setting componentObject. */
function wireFormulationGraph(registry: Record<string, FormulatedProduct>): void {
  for (const formulation of Object.values(registry)) {
    const { formula } = formulation.recipe;
    for (const ingredient of formula) {
      
      if (!ingredient.componentObject){
        const component = registry[ingredient.id];
        ingredient.componentObject = component      
        if (!component) {
          throw new Error(
            `Ingredient ${ingredient.id} not found in registry.`
          );
        }
      }
    }
  }
}

/* Performs bottom-up recalculation of derived formulation values, computing dependencies on demand and caching results. */
function applyCalcsToGraph(registry: Record<string, FormulatedProduct>): void {
  for (const formulation of Object.values(registry)) {
    formulation.ensureComputed();
  }
}

function App() {
  const [formulations, setFormulations] = useState<Record<string, FormulatedProduct>>() 
  const [dataRegistry, setDataRegistry] = useState<Record<string, FormulationData>>() 
  const formulationsRef = useRef(formulations)
  const dataRegistryRef = useRef(dataRegistry)
  const unitConverter = new unitConversionEngine(decimals, false)

  function runUpdate(){
    var f1 = formulations!['F-0001']
    var updatedData: FormulationData =   {
      parameters: {
        id: 'F-0001',
        name: "Formulation 2",
        density: 0.9, 
        alias: "F2-b", 
        costPerGram: 0.0001,
        state: "liquid", 
        hazards: ["H225"],
        status: "In Planning",
        mixture: true,
        massAmount: 360,
        massUnit: 'g',
        volAmount: 400,
        volUnit: 'mL',
      }, 
      recipe: {
        formula :[
          {
            id: "R-001",
            //name: "water",
            role: "solvent", 
            amount: 200,
            unit: 'mL'
          },
          {
            id: "R-002",
            //name: "ethanol",
            role: "solvent", 
            amount: 200,
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
    }

    f1.updateFromJson(updatedData)

  }

  useEffect(() => {
    formulationsRef.current = formulations;
    console.log(formulations);
  }, [formulations]);

  useEffect(() => {
    dataRegistryRef.current = dataRegistry;
  }, [dataRegistry]);

  useEffect(() => {
    unitConverter.init().then(_=> {
      var formulationDataRegistry = buildFormulationDataRegistry(formulationsDataBase);
      var formulationRegistry = buildFormulationShellRegistry(formulationDataRegistry, unitConverter);
      wireFormulationGraph(formulationRegistry);
      applyCalcsToGraph(formulationRegistry);
      setFormulations(formulationRegistry);
      setDataRegistry(formulationDataRegistry);
      console.log(formulationRegistry);
    });
  }, []);

  return (
    <>
      <button onClick={runUpdate}> Click to update</button>
    </>
  )
}

export default App