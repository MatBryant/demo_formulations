import { getUnits, getFormulae } from "../util/apis";
import { Network } from "vis-network";
import { unitObj } from "./Unit";
import { pathFind } from "../util/pathfinder";

interface unitsJson {
    group: string,
    name: string,
    base: string,
    inner_conversion: number
}

interface baseConvJson {
    a: string,
    b: string,
    meta: string,
    arguments: string,
    formula: any
}

interface treeJson {
    nodes: [],
    edges: []
}

const variableMap: Record<string,string> = {
    'DENSITY': 'density',
    'COST_PER_GRAM': 'costPerGram',
    'MW': 'molecularWeight'
}


/* unit converter class */
export default class unitConversionEngine{
    initiated: boolean;
    baseConversions: baseConvJson[];
    unitsDict: unitsJson[];
    units: {[key: string]: unitObj};
    private unitIndex: {[key: string]: unitObj} | null;
    dp: number;
    log: string[];
    visualiser: boolean;
    unitsTree: any;
    network: any;
    runOnLoad: Function;

    constructor(dp:number, visualiser:boolean, runOnLoad?: Function){
        this.initiated = false;
        this.baseConversions = []; // Formulae for conversion between base units
        this.unitsDict = []; // Units as loaded into the engine
        this.units = {}; // Units as parsed into Unit objects
        this.unitIndex = null;
        this.dp = dp; // Decimal places for result
        this.log = []; // Conversion logs
        this.visualiser = visualiser; // Generate visualisation in vis.js (true/false) 
        this.unitsTree = {nodes: [], edges: []}; // Visualiser network structure 
        this.network = null; // Visualiser network 
        this.runOnLoad = runOnLoad?? (() => console.log('map loaded')); // function to run when network is loaded (used for loading spinners etc.)
    }

    async init():Promise<unitConversionEngine>{
        if (this.initiated){return this}
        /*  Pull units from Integration Layer */
        return  getUnits().then(x=>{
            
            var unitsJson = JSON.parse(x)
            this.unitsDict = unitsJson.sort((a: unitsJson, b: unitsJson) => {
                if (a.group < b.group) {
                    return -1;
                } else {
                    return 1;
                }
            });
            this.unitsDict.map(u=> new unitObj(u.group, u.name, u.base, u.inner_conversion, this.dp)).forEach(x=> this.units[x.title] = x);
            this.unitIndex = null;
            /*  Pull conversion formulae from Integration Layer */
            return getFormulae().then(f => {
                
                this.baseConversions = typeof f === 'string' ? JSON.parse(f) : f;
                this.baseConversions.forEach((r,n) => {
                      // Don't show hardcoded concentrations - feature deprecated
                    if (r.arguments.split(',')[1] == 'CONCENTRATION'){this.baseConversions.splice(n, 1);return}
                    r.formula = new Function(...r.arguments.split(','), `return ${r.formula}`)
                    Object.keys(this.units).filter(u => this.units[u].base == r.a && this.units[u].addBaseConversion(r.b, r.formula, r.arguments.split(',').slice(1)))
                });
                            if (this.visualiser && !this.network){
                this.network = this.genNetwork(); // Populate network structure   
                
            }
            // cannot initiate multiple times
            this.initiated = true;  
            return this
            })
        })     
    }

    /* Highlight the conversion path in the visualiser */
    highlightPath(u1: unitObj, u2: unitObj): void{
        var node1 = this.network.body.data.nodes.get(u1.title);
        var node2 = this.network.body.data.nodes.get(u2.title);
        node1.color = '#9966ff';
        node2.color = '#9966ff';
        node1.borderWidth =  5;
        node2.borderWidth =  5;
        this.network.body.data.nodes.update(node1);
        this.network.body.data.nodes.update(node2);

        if (!edge2 && !edge) {
            var edge = this.network.body.data.edges.get(`${u1.title}-${u2.title}`);  
            var edge2 = this.network.body.data.edges.get(`${u2.title}-${u1.title}`);  
        }

        if (edge){
            edge.arrows= {
            to: { enabled: true, scaleFactor: 1, type: "arrow" }
            }
            edge.width = 8;
            edge.color = '#9966ff';
            this.network.body.data.edges.update(edge);
        } else if (edge2){
            edge2.arrows= {
            from: { enabled: true, scaleFactor: 1, type: "arrow" }
            }
            edge2.width = 8;
            edge2.color = '#9966ff';
            this.network.body.data.edges.update(edge2);
        }
    }

    /* Reset the conversion path in the visualiser */
    resetNetwork(): void{
        this.unitsDict.forEach(u=>{
            if (u.name.toLowerCase() == u.base.toLowerCase()){
                var unit = this.network.body.data.nodes.get(u.name);
                unit.borderWidth =  2;
                unit.color = "rgb(170, 255, 156)";
                this.network.body.data.nodes.update(unit);
            } else {
                var unit = this.network.body.data.nodes.get(u.name);
                var edge = this.network.body.data.edges.get(`${u.name}-${u.base}`);
                if (edge){
                    edge.width = 4;
                    edge.color = "rgb(3, 102, 252)"
                    edge.arrows =  {
                        to: { enabled: false},
                        from: { enabled: false}
                    }
                }
                unit.borderWidth =  2;
                unit.color = "rgb(156, 196, 255)";
                this.network.body.data.nodes.update(unit);
                this.network.body.data.edges.update(edge);
            }
        })
        this.baseConversions.forEach(c => {
            var edge = this.network.body.data.edges.get(`${c.a}-${c.b}`);
            if (edge){
                edge.color = "rgb(252, 58, 78)",
                edge.width = 5;
                edge.arrows =  {
                    from: { enabled: false}
                }
                this.network.body.data.edges.update(edge);
            }
        })
    }
    
    /* Generate the visualiser */
    genNetwork(): Network { 
        this.unitsDict.forEach(u=>{
            if (u.name.toLowerCase() == u.base.toLowerCase()){
                this.unitsTree.nodes.push({'id': u.name, 'label':u.name,
                    'base': 1, 
                    shape: 'circle',
                    font: {size: 60, align:'right', face: 'Mulish'},
                    color: "rgb(170, 255, 156)",
                    borderWidth: 2,
                heightConstraint: 100,
                align:'center'}
                    );
            } else {
                this.unitsTree.nodes.push({'id': u.name, 'label': u.name, 
                    'base': 0, 
                    shape: 'circle',
                    font: {size: 30, align:'center', face: 'Mulish'},
                    color: "rgb(156, 196, 255)",
                    borderWidth: 2,
                    heightConstraint: 60}
                    );

                this.unitsTree.edges.push({'id': `${u.name}-${u.base}`, 'from': u.name, 'to': u.base, 
                    'title': `Scale: ${u.inner_conversion}`,
                    color: "rgb(3, 102, 252)",
                    width:4,
                    length:250,});
                
            }
        })
        this.baseConversions.forEach(c => {
            let formula: string = '';
            if (c.formula){
                 formula = c.formula.toString().split('{').pop().split('}')[0].replace('a', c.a).replace('return', '')
            }
            var id = `${c.a}-${c.b}`;
            var arrowColor = "rgb(252, 58, 78)";
            this.unitsTree.edges.push({'id': id , 'from': c.a, 'to': c.b, color: arrowColor,
                                    arrows: {
                                        to: { enabled: true, scaleFactor: 1, type: "arrow" }
                                    },
                                    width:5,
                                    length:400,
                                    'title': formula
                                })
        })
        /*  build network */
        var container = document.getElementById("mynetwork")!;
        var data: treeJson = {
          nodes: this.unitsTree.nodes,
          edges: this.unitsTree.edges,
        };
        /* network settings and physics */
        var options = {
            edges:{
                physics:true
            },
            nodes:{
                physics:true,
                mass:2
            },
            physics:{
                enabled: true,

                barnesHut: {
                    theta: 0.5,
                    gravitationalConstant: -2000,
                    centralGravity: 0.3,
                    springLength: 395,
                    springConstant: 0.02,
                    damping: 0.19,
                    avoidOverlap: 0.1
                  },
            }
        };
        
        var network = new Network(container, data, options);
        network.once('afterDrawing', () => this.runOnLoad())
        network.setOptions(options);
        return network
    }

    /* get logs as string */
    getLogs(): string{
        return this.log.join(`
`)
    }
    /* get logs as HTML */
    getLogsAsHTML(): string{   
        return this.log.join('&#013;&#010;')
    }

    /* reset the log variable */
    resetLog(): void{
        this.log = [];
    }

    private ensureUnitIndex(): void {
        if (this.unitIndex) return;
        this.unitIndex = {};
        for (const key in this.units) {
            this.unitIndex[key.toLowerCase()] = this.units[key];
        }
    }

    /** Case-insensitive lookup of a parsed unit by name (e.g. "mL", "g/L"). */
    getUnit(name: string): unitObj | undefined {
        if (!name || !this.initiated) return undefined;
        this.ensureUnitIndex();
        return this.unitIndex![name.toLowerCase()];
    }

    /** Update rounding precision for the engine and all loaded unit objects. */
    setDecimalPlaces(dp: number): void {
        this.dp = dp;
        for (const key in this.units) {
            this.units[key].dp = dp;
        }
    }

    /* find the path to convert the unit when no direct conversion exists */
    getPath(unit1Obj: unitObj, unit2Obj: unitObj): string[]{
        var unit1: unitObj = unit1Obj;
        var unit2: string = unit2Obj.base;
        /* build the unit relations map into a graph */
        var graph: any = {};
        Object.keys(this.units).forEach(unit => {
            Object.keys(this.units[unit].conversions).forEach(u =>{
                if (!graph.hasOwnProperty(unit)){graph[unit] = {};}
                graph[unit][u] = 1;
            })
        })
        if (!graph[unit2]){
            /* unit2 is islanded from unit1 */
            return [];
        }
        graph['start'] = {};
        graph['start'][unit1.title] = 1;
        
        graph[unit2]['end'] = 1;
        graph.end = {};
        /* run Dijkstra's algorithm to find the short path */
        var path = pathFind(graph).path.slice(0, -1);
        return path;
    }

    /* run unit conversion */
    conversion(u1: string, u2: string, val: number|null, material?: {[key: string]: any}, reset?: boolean):number|null{ 
        if (reset){this.resetNetwork()};
        // Allow zero quantities; only null/undefined are missing.
        if (val == null){return null};
        var unit1 = this.getUnit(u1);
        var unit2 = this.getUnit(u2);
        if (!unit1 || !unit2) return null;

        this.ensureUnitIndex();
        const lcUnits = this.unitIndex!;
        /* Simple Magnitude Conversion */
        if (unit1.group.toLowerCase() ==  unit2.group.toLowerCase() && unit1.base.toLowerCase() ==  unit2.base.toLowerCase()){
            this.log.push(`${u1} and ${u2} share root: simple scaling...`);
            
            var out = unit1.simpleConvertTo(unit2, val);
            if (unit1.base.toLowerCase() != unit1.title.toLowerCase() && unit2.base.toLowerCase() != unit2.title.toLowerCase()){
                this.log.push(`       Conversion of ${val} ${u1} to ${u2} (via ${unit1.base}): ${out} ${u2}`);
                if (this.visualiser){
                    this.highlightPath(unit1, lcUnits[unit1.base.toLowerCase()]);
                    this.highlightPath(lcUnits[unit2.base.toLowerCase()], unit2);
                }
            }  else if (this.visualiser){
                this.highlightPath(unit1, unit2);
            } 
            return out
            
        } else if (unit1.conversions.hasOwnProperty(unit2.base)){
            /* Formula Conversion */
            var via1: string = '';
            var via2: string = '';
            if (u1.toLowerCase() != unit1.base.toLowerCase()){
                via1 = `(via scaling to ${unit1.base})`;
                if (this.visualiser){
                    this.highlightPath(unit1, lcUnits[unit1.base.toLowerCase()]);
                }
            }
            if (u2.toLowerCase() != unit2.base.toLowerCase()){
                via2 = `(via scaling from ${unit2.base})`;
            }
            this.log.push(`Formula detected for conversion of ${u1} ${via1} to ${u2} ${via2}`);
            var conversionFormula = unit1.conversions[unit2.base].formula;
            var conversions = unit1.conversions[unit2.base];

            if (conversions.meta.length > 0){
                /* Additional info needed */
                if (!material){
                    this.log.push(`Material required to convert ${u1} to ${u2}`);
                    return null;
                }
                this.log.push(`       Metadata values required to convert ${u1} to ${u2}`);
                var data: number[];
                data = conversions.meta.map(x=> material[variableMap[x]] as number);
                var out = unit1.formulaConvertTo(unit2, val, conversionFormula, data);
                if (this.visualiser){
                    this.highlightPath(lcUnits[unit1.base.toLowerCase()], lcUnits[unit2.base.toLowerCase()]);
                }
                if (via2 && this.visualiser){
                    this.highlightPath(lcUnits[unit2.base.toLowerCase()], unit2);
                }
                
                if (!isNaN(out)) {
                    this.log.push(`         - values retrieved`);
                    this.log.push(`       Conversion of ${val} ${u1} to ${u2}: ${out} ${u2}`);
                } else {
                    this.log.push(`Required metadata values for selected material could not be found/ are not available`);
                }
                return out;
            } else {
                /* Additional info not needed - simple formula */
                var out = unit1.formulaConvertTo(unit2, val, conversionFormula, []);
                this.log.push(`       Conversion of ${val} ${u1} to ${u2}: ${out} ${u2}`);
                if (this.visualiser){ 
                    if (via1 != ''){
                        this.highlightPath(lcUnits[unit1.base.toLowerCase()], unit2);
                    } else {
                        this.highlightPath(unit1, unit2);
                    }
                }
                return out;
            }
        } else {
            /* No direct path to convert, looking for path */
            this.log.push(`Formula required for conversion of ${u1} to ${u2}`);
            this.log.push(`       No Formula found`);
            this.log.push(`Searching for alternate route -->`);
            
            /* run recursive conversion through the path */
            function recurs(ut1: string, ut2: string, value: number|null, x: unitConversionEngine):number|null{
                return x.conversion(ut1, ut2, value, material)
                //await x.conversion(ut1, ut2, value, material).then(intermediate =>{
                  //  return intermediate
                //})
            }
            /* Build graph, and find path */
            var pathway = this.getPath(unit1, unit2);
            if (pathway && pathway.length > 0){            
                if (!pathway.includes(u2)){
                    pathway.push(u2);
                }
                this.log.push(`       Pathway from ${u1} to ${u2} found:`);
                this.log.push(`           Pathway: ${pathway.join(' --> ')}`);

                //var converted: Promise<number|null> = recurs(pathway[0], pathway[1], val, this);
                var converted = recurs(pathway[0], pathway[1], val, this)
                pathway.forEach((step, n) =>{
                    if (n <= 1){return null}
                    converted = recurs(pathway[n-1], step, converted, this)
                    //converted = converted.then(x => recurs(pathway[n-1], step, x, this));
                })
                return converted
            } else {
                /* No path to convert units chosen are islanded*/
                this.log.push(`       No pathway from ${u1} to ${u2} found`);
                return null
            }
        }
    }
}
