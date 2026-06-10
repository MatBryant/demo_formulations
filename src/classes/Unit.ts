interface conversionJson {
    meta: string[],
    formula: Function,
}

/* unit class */
export class unitObj{
    group: string;
    title: string;
    base: string;
    innerConversion: number;
    conversions: {[key: string]: conversionJson};
    dp: number;
    constructor(group: string, title: string, base: string, innerConversion: number, dp: number){
		this.group = group,
        this.title = title,
        this.base = base,
        this.innerConversion = innerConversion,
        this.conversions = {},
        this.dp = dp
    }

    /* add a unit and formula this unit can convert to */
    addBaseConversion(u:string, f:Function, args: string[]): void{
        if (this.conversions[u]){return}
        this.conversions[u] = {formula: f, meta: args};
    }

    /* magnitude conversion */
    scale(u: unitObj, val: number): number{
        !u.innerConversion? u.innerConversion = 1:u.innerConversion;
        !this.innerConversion? this.innerConversion = 1:this.innerConversion;
        var converted = (val * this.innerConversion) / u.innerConversion;
        return converted;
    }

    /* magnitude conversion with rounding */
    simpleConvertTo(u: unitObj, val: number): number{
        return this.roundToDp(this.scale(u, val), this.dp);
    }

    /* formula conversion*/
    formulaConvertTo(u: unitObj, val: number, formula: Function, args: number[]): number{
        return this.roundToDp(this.scale(u, formula(val, ...args)), this.dp);
    }
    /* A function for rounding numbers*/	
    roundToDp(value: number, dp: number): number{
        var order = 10**dp
        return Math.round((value * order)) / order;
    }

}