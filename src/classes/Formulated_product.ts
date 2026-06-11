import { Material } from "./Material"
import type { IMaterial } from "../../types/Material.interface";
import type { FormulationData } from "../../types/FormulationData.interface";
import type { 
  IFormulatedProduct,
  IFormulatedProductComposition,
  IFormulatedProductRecipe,
  IFormulatedProductCompositionItem,
  IFormulatedProductInputs, 
  IFormulatedProductFormulaItem,
  CompositionScalingMethod,
  CompositionWarning,
} from "../../types/FormulatedProduct.interface";
import type { FormulationStatus, FormulationKind } from "../../types/ddcTypes";
import type unitConversionEngine from "./UnitConversionEngine";
import type { Ingredient } from "../../types/Ingredient";
import type { Resolver } from "./FormulationGraph";

export class FormulatedProduct extends Material<"formulatedProduct"> implements IFormulatedProduct{
  /**
   * Formulation object
   * Stores live values calculated at runtime, for use in rapid ui calculations
  */
 [key: string]: unknown; // now formulation[anything] is allowed
  public isDirty: boolean;
  public isComputing: boolean;
  public formulationType: FormulationKind;
  public status: FormulationStatus;
  public mixture: boolean;
  public massAmount?: number;
  public massUnit?: string;   
  public volAmount?: number;
  public volUnit?: string;
  public residualMass?: number;
  public residualVolume?: number;
  public processId?: string;
  public composition: IFormulatedProductComposition;
  public recipe: IFormulatedProductRecipe;
  
  public  concentrations: Record<string,{value:number, unit:string}>
  public  molFractions: Record<string,{value:number, unit:string}>
  public  massPercs: Record<string,{value:number, unit:string}>
  public  volPercs: Record<string,{value:number, unit:string}>
  /** Populated during recalculate when volume fallback is used for nested pre-mix expansion. */
  public compositionWarnings: CompositionWarning[] = [];

  public readonly unitConverter: unitConversionEngine;

  constructor({ 
    id,
    name,
    created, 
    density, 
    alias, 
    costPerGram, 
    costUnit, 
    state, 
    description,
    hazards,
    formulationType,
    status,
    mixture,
    massAmount,
    massUnit,
    volAmount,
    volUnit,
    residualMass,
    residualVolume,
    processId,
    recipe
  }: IMaterial & IFormulatedProductInputs,
    unitConverter: unitConversionEngine) {
    super({id, type: "formulatedProduct", name, created, density, alias, costPerGram, costUnit, state, description, hazards})
    this.unitConverter = unitConverter;
    this.isDirty = true;
    this.isComputing = false;
    this.formulationType = formulationType;
    this.status = status;
    this.mixture = mixture;
    this.massAmount = massAmount;
    this.massUnit = massUnit;
    this.volAmount = volAmount;
    this.volUnit = volUnit;
    this.residualMass = residualMass;
    this.residualVolume = residualVolume;
    this.processId = processId;
    this.recipe = recipe;
    this.composition = [];
    this.concentrations = {};
    this.molFractions = {};
    this.massPercs = {};
    this.volPercs = {};
    this.compositionWarnings = [];
  }

  toJSON() {
    const { unitConverter, ...rest } = this;
    return rest;
  }
  
  exportData(): FormulationData{
    return {
      parameters : {          
        id: this.id,
        name: this.name,
        type: this.formulationType,
        density: this.density, 
        alias: this.alias,
        costPerGram: this.costPerGram,
        state: this.state, 
        hazards: this.hazards,
        status: this.status,
        mixture: this.mixture,
        massAmount: this.massAmount,
        massUnit: this.massUnit,
        volAmount: this.volAmount,
        volUnit: this.volUnit,
        residualMass: this.residualMass,
        residualVolume: this.residualVolume,
      },recipe : this.recipe}
  }
  

  /** Runs all the calculations to populate the formulation information */
  recalculate(formulationGraph: Resolver){
    console.log('recalculating all parameters', this.id)
    this.concentrations = {};
    this.molFractions = {};
    this.massPercs = {};
    this.volPercs = {};
    // Warnings are recomputed each pass; do not accumulate stale volume-fallback flags.
    this.compositionWarnings = [];

    this.autoFill();
    /* Calculate recipe quantity for Diluent if present - requires unit conversion*/
    console.log(this)
    //TODO: entered concentrations

    // Clear stale resolved quantities so unit/amount edits always re-resolve from recipe.
    for (const comp of this.recipe.formula) {
      if (!comp) continue;
      delete comp.resolvedAmount;
      delete comp.resolvedUnit;
    }

    // Pass 1: resolve percentages and direct amounts for all non-diluent recipe lines.
    for (const comp of this.recipe.formula) {
      if (!comp) continue;
      //TODO
      if(['Conc w/v'].includes(this.unitConverter.getUnit(comp.unit)?.group ?? '')){
        this.calculateConcentration(comp, formulationGraph);
      }
      else if (comp.unit === "mass%" || comp.unit === "vol%") {
        console.log("calculating percentage", comp);
        this.calculatePercentage(comp, formulationGraph);
      } else if (comp.amount != null && comp.unit) {
        // Direct amounts and manual diluent overrides (auto diluent is pass 2 only).
        comp.resolvedAmount = comp.amount;
        comp.resolvedUnit = comp.unit;
      }
    }

    this.calculateResiduals(formulationGraph);

    // Pass 2: diluents — aggAmount now sees resolvedAmount on every non-diluent line.
    // Auto diluent keeps recipe.amount unset; only resolved* holds the computed value so
    // pass 2 re-runs whenever another row's amount changes.
    for (const comp of this.recipe.formula) {
      if (comp?.role !== "diluent") continue;
      if (comp.manualDiluentAmount) continue;
      // Clear legacy recipe.amount written by older calculateDiluent implementations.
      delete comp.amount;
      this.calculateDiluent(comp, formulationGraph);
    }

    this.calculateComposition(formulationGraph)

    this.composition.forEach(component => {
      if (this.massAmount != null){
        var massPerc = this.getComponentMassPerc(component, formulationGraph);
        if (massPerc != null){
          this.massPercs[component.id] = massPerc;
        }
      } 
      if (this.volAmount != null){
        var volPerc = this.getComponentVolPerc(component, formulationGraph);
        var compConc = this.getComponentConc(component, formulationGraph);
        if (volPerc != null){
          this.volPercs[component.id] = volPerc;
        }
        if (compConc != null){
          this.concentrations[component.id] = compConc;
        }
      } 
      var moleFraction = this.getComponentMolFrac(component, formulationGraph)
      if (moleFraction != null){
        this.molFractions[component.id] = moleFraction
      }
    })   
  }

  /** Calculates missing values for mass, volume and density of possible */
  autoFill(){
    if (!this.density && this.massAmount && this.volAmount) {
      this.density = this.massAmount/this.volAmount;
    } else if (this.density && !this.massAmount && this.volAmount) {
      this.massAmount = this.density * this.volAmount;
    } if (this.density && this.massAmount && !this.volAmount) {
      this.volAmount = this.massAmount/this.density;
    }
  }

  /**
   * Add `amount` (in `sourceUnit`) onto an existing composition row, converting into that
   * row's display unit first. Without conversion, 100 mg added onto a row in g would become
   * 100+existing g — treating every milligram as a gram.
   */
  private mergeAmountIntoCompositionEntry(
    fEntry: IFormulatedProductCompositionItem,
    amount: number,
    sourceUnit: string,
    materialId: string,
    formulationGraph: Resolver
  ): boolean {
    let amountToAdd = amount;
    if (fEntry.unit !== sourceUnit) {
      const converted = this.unitConverter.conversion(
        sourceUnit,
        fEntry.unit,
        amount,
        formulationGraph.resolve(materialId) as Ingredient
      );
      if (converted == null) {
        return false;
      }
      amountToAdd = converted;
    }
    fEntry.amount += amountToAdd;
    return true;
  }

  /**
   * Merge one constituent from a nested pre-mix into this formulation's composition.
   *
   * `amount` is always in comp.resolvedUnit (the unit the parent used to add the pre-mix line).
   * Display rules:
   * - Material already in composition (e.g. direct 100 mL ethanol): convert the incoming amount
   *   into that row's unit and add — one combined row, existing unit wins.
   * - Material only from this pre-mix (e.g. water): new row with unit = comp.resolvedUnit (e.g. g).
   */
  addToComposition(
    comp: IFormulatedProductFormulaItem,
    fComp: IFormulatedProductCompositionItem,
    amount: number,
    formulationGraph: Resolver
  ){
    if (amount == null || !comp.resolvedUnit) {
      console.log(`composition could not be calculated, as unable to calculate amount from ${comp.name}`)
      return;
    }

    // allocateFromNestedMixture returns amount expressed in how the pre-mix was added (e.g. g).
    const additionUnit = comp.resolvedUnit;
    const fEntry = this.composition.find(item => item.id === fComp.id);
    const provenance = {
      id: comp.id,
      name: comp.name,
      amountFrom: amount,
      unit: additionUnit,
      addedDirectly: false as const,
    };

    if (fEntry){
      // Existing row: combine into that row's unit (may differ from pre-mix addition unit).
      if (
        !this.mergeAmountIntoCompositionEntry(
          fEntry,
          amount,
          additionUnit,
          fComp.id,
          formulationGraph
        )
      ) {
        console.log(
          `composition could not merge ${fComp.id} from ${comp.name}: ` +
            `cannot convert ${amount} ${additionUnit} to existing unit ${fEntry.unit}`
        );
        return;
      }
      fEntry.parentMaterials.push(provenance);
    } else {
      // New row: only from pre-mix — show quantity in the pre-mix addition unit, not fComp.unit
      // from the child batch (which may be mL while parent added the pre-mix in g).
      const ingredientEntry: IFormulatedProductCompositionItem = {
        id: fComp.id,
        name: fComp.name,
        role: fComp.role,
        amount,
        unit: additionUnit,
        parentMaterials: [provenance],
      };
      this.composition.push(ingredientEntry);
    }
  }

  /**
   * R2 + R3: Allocate one constituent amount when a parent recipe line adds a nested
   * mixture (pre-mix) formulation.
   *
   * Replaces the old obj.massPercs[fComp.id].value approach, which:
   * - crashed when massPercs was missing
   * - depended on a derived dict computed AFTER composition on the child
   *
   * Instead we scale directly from the child's flattened composition (R2):
   *   scaledAmount = childConstituent.amount × (parentAddition / childBatchTotal)
   * then convert into the parent's addition unit (comp.resolvedUnit).
   *
   * PRECONDITION: FormulationGraph.ensureComputed(child) must have run before the
   * parent recalculates, so child.composition already reflects the child's full batch.
   * This method does not call ensureComputed itself — that remains the graph's job.
   */
  /**
   * Record one UI warning per parent × child pre-mix when volume fallback was used.
   * Deduped so looping every child constituent does not spam duplicate messages.
   */
  private recordVolumeFallbackWarning(child: FormulatedProduct): void {
    const already = this.compositionWarnings.some(
      (w) =>
        w.code === "VOLUME_NON_ADDITIVE_FALLBACK" &&
        w.childFormulationId === child.id
    );
    if (already) return;

    this.compositionWarnings.push({
      code: "VOLUME_NON_ADDITIVE_FALLBACK",
      parentFormulationId: this.id,
      parentFormulationName: this.name,
      childFormulationId: child.id,
      childFormulationName: child.name,
      message:
        `Pre-mix "${child.name}" (${child.id}) in "${this.name}" (${this.id}) ` +
        `was expanded using volume-based apportionment because mass/density metadata ` +
        `was insufficient for a mass-based calculation.`,
    });
  }

  private allocateFromNestedMixture(
    parentLine: IFormulatedProductFormulaItem,
    child: FormulatedProduct,
    childConstituent: IFormulatedProductCompositionItem,
    formulationGraph: Resolver
  ): { amount: number | null; method: CompositionScalingMethod } {
    if (parentLine.resolvedAmount == null || !parentLine.resolvedUnit) {
      return { amount: null, method: "mass" };
    }

    const constituentMaterial = formulationGraph.resolve(
      childConstituent.id
    ) as Ingredient;
    const targetUnit = parentLine.resolvedUnit;

    // Tier 1.5: derive child massAmount from density × volAmount before giving up on mass.
    // Child may have been recalculated earlier but metadata can still be volume-only.
    child.autoFill();

    // Tier 1: mass-based scaling (stoichiometrically correct — matches diluent / aggAmount).
    const byMass = this.scaleNestedComponentByMass(
      parentLine.resolvedAmount,
      parentLine.resolvedUnit,
      child,
      childConstituent,
      constituentMaterial,
      targetUnit
    );
    if (byMass != null) {
      return { amount: byMass, method: "mass" };
    }

    // Tier 2: volume fallback when mass totals or conversions are still unavailable.
    // Approximate for non-ideal solvent mixtures (e.g. ethanol–water volume contraction).
    const byVol = this.scaleNestedComponentByVolume(
      parentLine.resolvedAmount,
      parentLine.resolvedUnit,
      child,
      childConstituent,
      constituentMaterial,
      targetUnit
    );
    if (byVol != null) {
      return { amount: byVol, method: "volume-fallback" };
    }

    return { amount: null, method: "mass" };
  }

  /**
   * Mass-based nested scaling (R2 + R3 primary path).
   *
   * Example: parent adds 50 g of pre-mix F-0001; F-0001's full batch is 178.9 g and
   * contains 100 g water in its composition → scale = 50/178.9, water contribution ≈ 27.9 g,
   * then convert to parent's addition unit if needed.
   */
  private scaleNestedComponentByMass(
    parentResolvedAmount: number,
    parentResolvedUnit: string,
    child: FormulatedProduct,
    childConstituent: IFormulatedProductCompositionItem,
    constituentMaterial: Ingredient,
    targetUnit: string
  ): number | null {
    if (child.massAmount == null || !child.massUnit) {
      return null;
    }

    // How much of the child pre-mix is the parent adding? (normalised to grams)
    const parentMassG = this.unitConverter.conversion(
      parentResolvedUnit,
      "g",
      parentResolvedAmount,
      child
    );
    // Child composition amounts describe a full batch of this size (normalised to grams)
    const childBatchMassG = this.unitConverter.conversion(
      child.massUnit,
      "g",
      child.massAmount,
      child
    );
    if (
      parentMassG == null ||
      childBatchMassG == null ||
      childBatchMassG === 0
    ) {
      return null;
    }

    const scale = parentMassG / childBatchMassG;

    const constituentMassG = this.unitConverter.conversion(
      childConstituent.unit,
      "g",
      childConstituent.amount,
      constituentMaterial
    );
    if (constituentMassG == null) {
      return null;
    }

    const scaledMassG = constituentMassG * scale;
    // Express result in the same unit the parent used to add the pre-mix line
    return this.unitConverter.conversion(
      "g",
      targetUnit,
      scaledMassG,
      constituentMaterial
    );
  }

  /**
   * Volume-based nested scaling (tier-2 fallback).
   *
   * Used when mass totals are unavailable or the mass conversion chain fails — e.g.
   * parent adds pre-mix by mL and child batch is defined volumetrically.
   *
   * NOTE: Solvent volumes are not strictly additive (ethanol + water contracts).
   * This path scales mixture volume correctly but apportions constituents via
   * pure-component equivalent mL — approximate, not stoichiometric.
   */
  private scaleNestedComponentByVolume(
    parentResolvedAmount: number,
    parentResolvedUnit: string,
    child: FormulatedProduct,
    childConstituent: IFormulatedProductCompositionItem,
    constituentMaterial: Ingredient,
    targetUnit: string
  ): number | null {
    if (child.volAmount == null || !child.volUnit) {
      return null;
    }

    const parentVolMl = this.unitConverter.conversion(
      parentResolvedUnit,
      "ml",
      parentResolvedAmount,
      child
    );
    const childBatchVolMl = this.unitConverter.conversion(
      child.volUnit,
      "ml",
      child.volAmount,
      child
    );
    if (
      parentVolMl == null ||
      childBatchVolMl == null ||
      childBatchVolMl === 0
    ) {
      return null;
    }

    const scale = parentVolMl / childBatchVolMl;

    const constituentVolMl = this.unitConverter.conversion(
      childConstituent.unit,
      "ml",
      childConstituent.amount,
      constituentMaterial
    );
    if (constituentVolMl == null) {
      return null;
    }

    const scaledVolMl = constituentVolMl * scale;
    return this.unitConverter.conversion(
      "ml",
      targetUnit,
      scaledVolMl,
      constituentMaterial
    );
  }
  
  /** Calculate the overall breakdown of the material - back to raw materials */
  calculateComposition(formulationGraph: Resolver){
    this.composition = [];
    this.recipe.formula.forEach(comp => {
      /* Skip only when resolution failed (null/undefined), not when amount is legitimately zero */
      if (comp.resolvedAmount != null && comp.resolvedUnit){
        /* if the ingredient added is a reagent */
        const obj = formulationGraph.resolve(comp.id)
        if (obj.type === "reagent" || (obj.type === "formulatedProduct" && obj.mixture !== true)){
          const entry = this.composition.find(item => item.id === comp.id);
          const am= comp.resolvedAmount;   
          const unt = comp.resolvedUnit;       
          const { resolvedUnit, resolvedAmount, unit, amount,  ...rest } = comp;
          const restructuredComp = { ...rest};

          if (entry){
            // Same unit-aware merge as addToComposition — e.g. 100 mg direct onto 50 g from pre-mix
            // must convert mg → g, not add 100 to 50.
            if (
              !this.mergeAmountIntoCompositionEntry(
                entry,
                am,
                unt,
                comp.id,
                formulationGraph
              )
            ) {
              console.log(
                `composition could not merge direct add ${comp.id}: ` +
                  `cannot convert ${am} ${unt} to existing unit ${entry.unit}`
              );
              return;
            }
            entry.parentMaterials.push({
              id: this.id,
              name: this.name,
              amountFrom: am,
              unit: unt,
              addedDirectly: true,
            });
          } else {
            const ingredientEntry: IFormulatedProductCompositionItem = {
              ...restructuredComp,
              amount: am,
              unit: unt,
              parentMaterials: [{
                id: this.id,
                name: this.name,
                amountFrom: am,
                unit: unt,
                addedDirectly: true,
              }],
            } as IFormulatedProductCompositionItem
            this.composition.push(ingredientEntry)
          }
        /* if the ingredient added is a Formulation */
        } else if (obj.type == 'formulatedProduct'){
          if (obj.mixture){
            const childFormulation = obj as FormulatedProduct;

            // R2: scale from child.composition, not child.massPercs.
            // Child composition must already exist — FormulationGraph.ensureComputed(child)
            // runs a full child.recalculate() (including calculateComposition) before this
            // parent runs. An empty array means the child failed to flatten, not that we
            // beat the graph to it.
            if (!childFormulation.composition.length) {
              console.log(
                `Cannot expand mixture ${childFormulation.id} into ${this.id}: ` +
                  `child composition is empty. Check child recipe resolution and that ` +
                  `recalculate is invoked via FormulationGraph.ensureComputed.`
              );
              return;
            }

            childFormulation.composition.forEach((fComp) => {
              // R2 + R3: mass first (with autoFill), then volume fallback.
              const { amount, method } = this.allocateFromNestedMixture(
                comp,
                childFormulation,
                fComp,
                formulationGraph
              );

              if (amount != null) {
                this.addToComposition(comp, fComp, amount, formulationGraph);
                if (method === "volume-fallback") {
                  this.recordVolumeFallbackWarning(childFormulation);
                }
              } else {
                console.log(
                  `composition could not allocate ${fComp.id} from ${comp.name} ` +
                    `(${childFormulation.id}): mass and volume scaling both failed`
                );
              }
            });
          } 
        }
      } 
    })
  }

  /** Return concentration of a given component based on total volume */
  getComponentConc(comp: IFormulatedProductFormulaItem|IFormulatedProductCompositionItem, formulationGraph: Resolver){
    if (!this.volUnit || this.volAmount == null){
      console.log('Cannot calculate concentration with no total volume and/or unit')
      return null
    }
    const unit = 'resolvedUnit' in comp ? comp.resolvedUnit : comp.unit;
    const amount = 'resolvedAmount' in comp ? comp.resolvedAmount : comp.amount;
    if (amount == null || unit == null) return null;
    var total = this.unitConverter.conversion(this.volUnit, 'ml', this.volAmount, this)
    var componentAmount = this.unitConverter.conversion(unit, 'g', amount, formulationGraph.resolve(comp.id) as Ingredient)
      if (total != null && componentAmount != null){
      return {value: (componentAmount/total), unit: 'g/ml'}
    } else {
      return null
    }
  };

  /** Return concentration of a given component based on total volume */
  getComponentConcFromPerc(percent: number, density: number){
    if (!this.volUnit || this.volAmount == null){
      console.log('Cannot calculate concentration with no total volume and/or unit')
      return null
    }
    if (density == null || percent == null){
        return null
    }
    return {value: (density * percent), unit: 'g/ml'}
  };

  /** Return mass% of a given component based on total mass */
  getComponentMassPerc(comp: IFormulatedProductFormulaItem|IFormulatedProductCompositionItem, formulationGraph: Resolver){
    if (!this.massUnit || this.massAmount == null){
      console.log('Cannot calculate Mass% with no total mass and/or unit')
      return null
    }
    const unit = 'resolvedUnit' in comp ? comp.resolvedUnit : comp.unit;
    const amount = 'resolvedAmount' in comp ? comp.resolvedAmount : comp.amount;
    if (amount == null || unit == null) return null;
    var total = this.unitConverter.conversion(this.massUnit, 'g', this.massAmount, this)
    var componentAmount = this.unitConverter.conversion(unit, 'g', amount, formulationGraph.resolve(comp.id) as Ingredient)
    if (total != null && componentAmount != null){
      return {value: (componentAmount/total)*100, unit: '%'}
    } else {
      return null
    }
  };

  /** Return vol% of a given component based on total volume */
  getComponentVolPerc(comp: IFormulatedProductFormulaItem|IFormulatedProductCompositionItem, formulationGraph: Resolver){
    if (!this.volUnit || this.volAmount == null){
      console.log('Cannot calculate Vol% with no total volume and/or unit')
      return null
    }
    const unit = 'resolvedUnit' in comp ? comp.resolvedUnit : comp.unit;
    const amount = 'resolvedAmount' in comp ? comp.resolvedAmount : comp.amount;
    if (amount == null || unit == null) return null;
    var total = this.unitConverter.conversion(this.volUnit, 'ml', this.volAmount, this)
    var componentAmount = this.unitConverter.conversion(unit, 'ml', amount, formulationGraph.resolve(comp.id) as Ingredient)
    if (total != null && componentAmount != null){
      return {value: (componentAmount/total)*100, unit: '%'}
    } else {
      return null
    }
  };

  /** Return molfraction of a given component based on an understanding of full composition */
  getComponentMolFrac(comp: IFormulatedProductCompositionItem, formulationGraph: Resolver){
    var molesTotal = this.composition.map(component => this.unitConverter.conversion(component.unit, 'moles', component.amount, formulationGraph.resolve(component.id) as Ingredient))
    if (!molesTotal.every(x => x !== null)){
      console.log('Cannot calculate mole fraction as one or more constituent cannot be converted to moles')
      return null
    } else {
          var totalNumberOfMoles = molesTotal.reduce((s, a) => s + a, 0);
      var componentMoles = this.unitConverter.conversion(comp.unit, 'moles', comp.amount, formulationGraph.resolve(comp.id) as Ingredient)
      if (componentMoles != null && totalNumberOfMoles != null && totalNumberOfMoles !== 0){
        return {value: (componentMoles/totalNumberOfMoles)*100, unit: '%'}
      }
    }
  };

  /**
   * Sum resolved amounts for non-diluent recipe lines that have been entered,
   * converted into `targetUnit`. Lines without resolved amounts are skipped.
   */
  private aggregateEnteredAmount(
    targetUnit: string,
    formulationGraph: Resolver
  ): number | null {
    const components = this.recipe.formula.filter(
      (comp) =>
        comp.role.toLowerCase() !== "diluent" &&
        comp.resolvedAmount != null &&
        comp.resolvedUnit
    );

    if (components.length === 0) {
      return 0;
    }

    const converted = components.map((component) =>
      this.unitConverter.conversion(
        component.resolvedUnit!,
        targetUnit,
        component.resolvedAmount!,
        formulationGraph.resolve(component.id) as Ingredient
      )
    );

    if (!converted.every((x) => x != null)) {
      return null;
    }

    return converted.reduce((sum, amount) => sum + amount!, 0);
  }

  /**
   * Mass% and vol% of batch total not yet accounted for by entered (non-diluent)
   * recipe ingredients. Computed after pass 1, before auto diluent fill.
   */
  calculateResiduals(formulationGraph: Resolver): void {
    if (this.massAmount != null && this.massUnit) {
      const aggregatedMass = this.aggregateEnteredAmount(
        this.massUnit,
        formulationGraph
      );
      this.residualMass =
        aggregatedMass != null
          ? ((this.massAmount - aggregatedMass) / this.massAmount) * 100
          : undefined;
    } else {
      this.residualMass = undefined;
    }

    if (this.volAmount != null && this.volUnit) {
      const aggregatedVol = this.aggregateEnteredAmount(
        this.volUnit,
        formulationGraph
      );
      this.residualVolume =
        aggregatedVol != null
          ? ((this.volAmount - aggregatedVol) / this.volAmount) * 100
          : undefined;
    } else {
      this.residualVolume = undefined;
    }
  }

  /** return aggregate amount of all non diluents in a given unit*/
  aggAmount(unit: string, formulationGraph: Resolver){
      // get all the non diluent components (i.e. every other component)
      var components = this.recipe.formula.filter(comp => comp.role.toLowerCase() != 'diluent');
      // get the amounts in the same unit
      var unitAggregate = components.map(component => this.unitConverter.conversion(component.resolvedUnit!, unit, component.resolvedAmount!, formulationGraph.resolve(component.id) as Ingredient));
      // when all resolve, aggregate and return
      if (!unitAggregate.every(x => x !== null)){
        console.log(`Cannot calculate aggregate amount in ${unit} as one or more values is null`)
        return null
      }
      return unitAggregate.reduce((s, a) => s + a, 0);
  }
  /** Calculate the amount of diluent present */
  calculateConcentration(component: IFormulatedProductFormulaItem, formulationGraph: Resolver){
    if (component.amount == null || this.volAmount == null || !this.volUnit) {
      return;
    }

    const gpMl = this.unitConverter.conversion(
      component.unit,
      "g/mL",
      component.amount,
      formulationGraph.resolve(component.id) as Ingredient
    );
    if (gpMl == null) {
      console.log(
        `Concentration for ${component.id} cannot be calculated - check input parameters`
      );
      return;
    }

    const totalMl = this.unitConverter.conversion(
      this.volUnit,
      "mL",
      this.volAmount,
      this
    );
    if (totalMl == null) {
      console.log(
        `Concentration for ${component.id} cannot be calculated - batch volume unit invalid`
      );
      return;
    }

    const gramAmount = gpMl * totalMl;
    const resolvedMass = this.unitConverter.conversion(
      "g",
      this.massUnit ?? "g",
      gramAmount,
      formulationGraph.resolve(component.id) as Ingredient
    );
    if (resolvedMass == null) {
      console.log(
        `Concentration for ${component.id} cannot be calculated - mass unit conversion failed`
      );
      return;
    }

    component.resolvedAmount = resolvedMass;
    component.resolvedUnit = this.massUnit ?? "g";
  }

  /** Calculate the amount of diluent present */
  calculatePercentage(component: IFormulatedProductFormulaItem, formulationGraph: Resolver){
    /* We back calculate quantity from % */
    if (component.unit == 'mass%' && component.amount != null && this.massUnit && this.volUnit && this.massAmount != null && this.volAmount != null){
      this.massPercs[component.id] = {value: component.amount, unit: '%'}
      var massAmount = this.massAmount * (component.amount/100)
      component.resolvedAmount = massAmount;
      component.resolvedUnit = this.massUnit;
      this.volPercs[component.id] = {value: ((component.amount/100)/formulationGraph.resolve(component.id).density!)*this.density!, unit: '%'}
      const conc = this.getComponentConcFromPerc(component.amount/100, this.density!);
      if (conc != null){this.concentrations[component.id] = conc}
    }      
    else if (component.unit == 'vol%' && component.amount != null && this.volUnit && this.volAmount != null && this.density != null){
      this.volPercs[component.id] = {value: component.amount, unit: '%'}
      var volAmount = this.volAmount * (component.amount/100)
      component.resolvedAmount = volAmount;
      component.resolvedUnit = this.volUnit;
      var mlTotal = this.unitConverter.conversion(this.volUnit, 'mL', this.volAmount, formulationGraph.resolve(component.id) as Ingredient)
      if (mlTotal != null){
        this.massPercs[component.id] = {value: ((component.amount/100)*formulationGraph.resolve(component.id).density! * mlTotal ) /(mlTotal * this.density!), unit: '%'}
      } else {
        console.log('Cannot calculate volume percentage as total volume is not in a valid unit')
      }
      const conc = this.getComponentConcFromPerc(component.amount/100, formulationGraph.resolve(component.id).density!);
      if (conc != null){this.concentrations[component.id] = conc}
    }  
    console.log(component)
  }
  /** Calculate the amount of diluent present */
  calculateDiluent(diluent: IFormulatedProductFormulaItem, formulationGraph: Resolver){
    if (diluent.manualDiluentAmount) {
      // Fixed amount from formula grid — pass 1 already copied recipe.amount → resolved*.
      return;
    }

    /* We calculate dilulents with a mass-conversion as volumetric measurements are NOT ADDITIVE */
    if (this.massUnit && this.volUnit && this.massAmount != null){
      /* get all of the non-diluent amounts in the common mass unit of the formulation */
      const aggregated = this.aggAmount(this.massUnit, formulationGraph) 
      /* get the difference between this and the stated Formulation total mass  and return it in the volume Unit */
      if (aggregated != null){
        const calculatedAmount = this.unitConverter.conversion(this.massUnit, this.volUnit, this.massAmount-aggregated, formulationGraph.resolve(diluent.id) as Ingredient)
        if (calculatedAmount != null){
          // Store computed quantity in resolved* only — recipe.amount must stay unset so
          // pass 2 keeps recalculating when non-diluent rows change.
          diluent.resolvedAmount = calculatedAmount;
          diluent.resolvedUnit = this.volUnit;
          const conc = this.getComponentConc(diluent, formulationGraph);
          if (conc != null){this.concentrations[diluent.id] = conc}
          const massPerc = this.getComponentMassPerc(diluent, formulationGraph);
          if (massPerc != null){this.massPercs[diluent.id] = massPerc}
          const volPerc = this.getComponentVolPerc(diluent, formulationGraph);
          if (volPerc != null){this.volPercs[diluent.id] = volPerc}

        } else {
          console.log(`Diluent amount for ${diluent.name} cannot be calculated - check input parameters`)
        }
      }  
    }
  }
}

export default FormulatedProduct