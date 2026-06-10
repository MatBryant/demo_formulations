export interface IReagent {
    /* Physical properties */
    molecularWeight: number
    smiles: string;
    chemicalFormula: string
    CASNumber: string;

    /* Specific Properties */
    supplier: string;
    purity: number; 
}