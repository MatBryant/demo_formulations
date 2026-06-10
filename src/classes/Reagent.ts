
import { Material } from "./Material"
import type { IMaterial } from "../../types/Material.interface";
import type { IReagent } from "../../types/Reagent.interface";

export default class Reagent extends Material<"reagent"> implements IReagent{
    public readonly molecularWeight: number;
    public readonly smiles: string;
    public readonly chemicalFormula: string;
    public readonly CASNumber: string;
    public readonly supplier: string;
    public readonly purity: number;

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
    molecularWeight,
    smiles,
    chemicalFormula,
    CASNumber,
    supplier,
    purity}: IMaterial & IReagent) {
    super({id, type: 'reagent', name, created, density, alias, costPerGram, costUnit, state, description, hazards})
    this.molecularWeight = molecularWeight;
    this.smiles = smiles;
    this.chemicalFormula = chemicalFormula;
    this.CASNumber = CASNumber;
    this.supplier = supplier;
    this.purity = purity;
  }
}