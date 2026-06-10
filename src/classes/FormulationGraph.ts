type MaterialId = string;
import type Reagent from "./Reagent";
import type FormulatedProduct from "./Formulated_product";
import type { Ingredient } from "../../types/Ingredient";
import type { FormulationDataPop } from "../../types/FormulationData.interface";

export interface Resolver {
  resolve(id: MaterialId): Ingredient;
}


export class FormulationGraph implements Resolver {
  /**
   * Runtime graph for formulated products, responsible for dependency resolution,
   * change propagation, and calculation ordering.
  */
  private formulationsById = new Map<MaterialId, FormulatedProduct>();
  private reagentsById = new Map<MaterialId, Reagent>();
  /* maps which products contain this Ingredient - needed for propagation of changes */
  private usedInById = new Map<MaterialId, Set<MaterialId>>(); 

  constructor(args: {
    formulations: Iterable<FormulatedProduct>;
    reagents: Iterable<Reagent>;
  }) {
    for (const f of args.formulations) this.formulationsById.set(f.id, f);
    for (const r of args.reagents) this.reagentsById.set(r.id, r);
  }

  /** Lookup a material by id (formulation first, then reagent) */
  resolve(id: MaterialId): Ingredient {
    const f = this.formulationsById.get(id);
    if (f) return f;
    const r = this.reagentsById.get(id);
    if (r) return r;
    throw new Error(`Unknown material id: ${id}`);
  }

  /** Build/refresh reverse edges from current formulation recipes */
  rebuildUsedInIndex(): void {
    this.usedInById.clear();

    for (const f of this.formulationsById.values()) {
      for (const item of f.recipe.formula) {
        const depId = item.id; // the thing being used
        let set = this.usedInById.get(depId);
        if (!set) this.usedInById.set(depId, (set = new Set()));
        set.add(f.id); // f uses depId
      }
    }
  }

  /** Mark a formulation dirty and propagate to all formulations that use it */
  markDirty(formulationId: MaterialId): void {
    const start = this.formulationsById.get(formulationId);
    if (!start) return; // skip for reagents

    const queue: MaterialId[] = [formulationId];
    const seen = new Set<MaterialId>();

    while (queue.length) {
      const id = queue.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);

      const f = this.formulationsById.get(id);
      if (f) f.isDirty = true;

      const users = this.usedInById.get(id);
      if (users) for (const u of users) queue.push(u);
    }
  }

  /** Ensure computed bottom-up */
  ensureComputed(formulationId: MaterialId): void {
    const f = this.formulationsById.get(formulationId);
    if (!f) return;

    if (!f.isDirty) return;
    if (f.isComputing) throw new Error(`Unexpected cycle or re-entrancy at ${f.id}`);

    f.isComputing = true;

    // ensure dependent sub-formulations are computed
    for (const item of f.recipe.formula) {
      const dep = this.resolve(item.id);
      if (dep.type === "formulatedProduct") {
        this.ensureComputed(dep.id);
      }
    }

    // compute this formulation using resolver access (no componentObject stored)
    f.recalculate(this); // <-- this is where your calculation methods use resolve()
    f.isDirty = false;
    f.isComputing = false;
  }

  /** Recompute everything (order doesn’t matter) */
  ensureAllComputed(): void {
    for (const f of this.formulationsById.values()) {
      this.ensureComputed(f.id);
    }
  }

  /** Update a formulation's recipe and propagate invalidation (no recompute here). */
  updateFormulation(formulationId: MaterialId, newFormulationData: FormulationDataPop): void {
    const formulation = this.formulationsById.get(formulationId);
    if (!formulation) throw new Error(`Unknown formulation: ${formulationId}`);

    const { type, ...parameters } = newFormulationData.parameters
    Object.assign(formulation, parameters)
    formulation.formulationType = type

    const newRecipe = newFormulationData.recipe 
    // Detect whether dependency structure changed (ingredient ids added/removed/reordered)
    const oldIds = new Set(formulation.recipe.formula.map(x => x.id));
    const newIds = new Set(newRecipe.formula.map(x => x.id));
  
    let structureChanged = oldIds.size !== newIds.size;
    if (!structureChanged) {
      for (const id of oldIds) {
        if (!newIds.has(id)) { structureChanged = true; break; }
      }
    }
  
    // Apply the change to the formulation
    formulation.recipe = newRecipe;
  
    // If structure changed, rebuild reverse index
    // (amount/unit/role changes don't affect usedInById)
    if (structureChanged) {
      this.rebuildUsedInIndex();
    }
  
    // Invalidate self + all consumers
    this.markDirty(formulationId);
  }
}
  
