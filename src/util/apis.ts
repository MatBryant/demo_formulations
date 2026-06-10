
/* THESE FUNCTIONS CAN BE SWAPPED OUT WITH WHATEVER YOU WANT AS LONG AS DATA IS RETURNED IN EXPECTED FORMAT */

/** Set true to load from futurelab.dotmatics.net (disabled for local/offline dev). */
const USE_FUTURELAB_API = false;

const FUTURELAB_BASE =
  "https://futurelab.dotmatics.net/browser/custom/mat_custom/UnitComprehension/dummyEndpoints.jsp";

const LOCAL_UNITS_JSON =
  '[{"group":"Conc w/v","name":"mg/uL","base":"g/L","inner_conversion":1000}, {"group":"Conc w/v","name":"ug/uL","base":"g/L","inner_conversion":1}, {"group":"Conc w/v","name":"ng/uL","base":"g/L","inner_conversion":0.001}, {"group":"Conc w/v","name":"mg/mL","base":"g/L","inner_conversion":1}, {"group":"Conc w/v","name":"ug/mL","base":"g/L","inner_conversion":0.001}, {"group":"Conc w/v","name":"ng/mL","base":"g/L","inner_conversion":0.000001}, {"group":"conc","name":"mM","base":"M","inner_conversion":0.001}, {"group":"conc","name":"nM","base":"M","inner_conversion":0.000000001}, {"group":"conc","name":"uM","base":"M","inner_conversion":0.000001}, {"group":"Time","name":"day","base":"s","inner_conversion":86400}, {"group":"Time","name":"hr","base":"s","inner_conversion":3600}, {"group":"Time","name":"min","base":"s","inner_conversion":60}, {"group":"Time","name":"ms","base":"s","inner_conversion":0.001}, {"group":"Time","name":"s","base":"s","inner_conversion":1}, {"group":"Mass","name":"mg","base":"kg","inner_conversion":0.000001}, {"group":"Mass","name":"g","base":"kg","inner_conversion":0.001}, {"group":"Mass","name":"kg","base":"kg","inner_conversion":1}, {"group":"Mass","name":"ug","base":"kg","inner_conversion":0.000000001}, {"group":"Volume","name":"mL","base":"L","inner_conversion":0.001}, {"group":"Volume","name":"uL","base":"L","inner_conversion":0.000001}, {"group":"Volume","name":"L","base":"L","inner_conversion":1}, {"group":"Conc w/v","name":"g/L","base":"g/L","inner_conversion":1}, {"group":"Conc w/v","name":"mg/L","base":"g/L","inner_conversion":0.001}, {"group":"Conc w/v","name":"ug/L","base":"g/L","inner_conversion":0.000001}, {"group":"Conc w/v","name":"ng/L","base":"g/L","inner_conversion":0.000000001}, {"group":"Conc w/v","name":"ppm","base":"ppm","inner_conversion":1}, {"group":"Conc w/v","name":"ppb","base":"ppm","inner_conversion":0.001}, {"group":"Temperature","name":"°C","base":"°C","inner_conversion":1}, {"group":"Temperature","name":"°F","base":"°F","inner_conversion":1}, {"group":"Temperature","name":"K","base":"K","inner_conversion":1}, {"group":"Quantity","name":"Moles","base":"Moles","inner_conversion":1}, {"group":"Quantity","name":"Count","base":"Count","inner_conversion":1}, {"group":"Cost","name":"£","base":"£","inner_conversion":1}, {"group":"Mass","name":"Troy oz","base":"Troy oz","inner_conversion":1}, {"group":"Mass","name":"oz","base":"lb","inner_conversion":0.0625}, {"group":"Mass","name":"lb","base":"lb","inner_conversion":1}, {"group":"Mass","name":"St","base":"lb","inner_conversion":14}, {"group":"Volume","name":"Pints","base":"Pints","inner_conversion":1}, {"group":"Volume","name":"Gallons","base":"Pints","inner_conversion":8}, {"group":"Temperature","name":"°R","base":"°R","inner_conversion":1}, {"group":"Conc w/v","name":"g/ml","base":"g/L","inner_conversion":1000}, {"group":"conc","name":"M","base":"M","inner_conversion":1}, {"group":"conc","name":"mol dm^-3","base":"M","inner_conversion":1}]';

const LOCAL_FORMULAE_JSON = String.raw`[{"a":"Troy oz","b":"kg","meta":null,"arguments":"a","formula":"a / 32.150746568628","solution":"N"}, {"a":"Troy oz","b":"lb","meta":null,"arguments":"a","formula":"a / 14.583333333333","solution":"N"}, {"a":"kg","b":"\u00A3","meta":"[[\"COST_PER_GRAM\",\"TEST_METADATA_VW\",\"ID\"]]","arguments":"a,COST_PER_GRAM","formula":"a * (COST_PER_GRAM * 1000) ","solution":"N"}, {"a":"M","b":"g/L","meta":"[[\"MW\",\"TEST_METADATA_VW\",\"ID\"]]","arguments":"a,MW","formula":"a * MW","solution":"N"}, {"a":"\u00B0C","b":"K","meta":null,"arguments":"a","formula":"a + 273.15","solution":"N"}, {"a":"g/L","b":"ppm","meta":null,"arguments":"a","formula":"a * 1001.142303","solution":"N"}, {"a":"\u00B0C","b":"\u00B0F","meta":null,"arguments":"a","formula":"(a * (9/5)) + 32","solution":"N"}, {"a":"Moles","b":"kg","meta":"[[\"MW\",\"TEST_METADATA_VW\",\"ID\"]]","arguments":"a,MW","formula":"(a * MW)/1000","solution":"N"}, {"a":"L","b":"kg","meta":"[[\"CONCENTRATION\",\"TEST_METADATA_VW\",\"ID\"]]","arguments":"a,CONCENTRATION","formula":"(a * CONCENTRATION) /1000","solution":"Y"}, {"a":"\u00B0R","b":"\u00B0F","meta":null,"arguments":"a","formula":"a -459.67","solution":"N"}, {"a":"L","b":"Pints","meta":null,"arguments":"a","formula":"a / 0.568261","solution":"N"}, {"a":"Moles","b":"Count","meta":null,"arguments":"a","formula":"a * 602214076000000000000000","solution":"N"}, {"a":"A","b":"kg","meta":"[[\"MW\",\"TEST_METADATA_VW\",\"ID\"]]","arguments":"a,MW","formula":"a + MW","solution":"N"}, {"a":"L","b":"kg","meta":"[[\"DENSITY\",\"TEST_METADATA_VW\",\"ID\"]]","arguments":"a,DENSITY","formula":"a * DENSITY","solution":"N"}, {"a":"TESTUNIT","b":"kg","meta":null,"arguments":"a","formula":"a +10","solution":"N"}, {"a":"kg","b":"Troy oz","meta":null,"arguments":"a","formula":"a * 32.150746568628","solution":"N"}, {"a":"lb","b":"Troy oz","meta":null,"arguments":"a","formula":"a * 14.583333333333","solution":"N"}, {"a":"\u00A3","b":"kg","meta":"[[\"COST_PER_GRAM\",\"TEST_METADATA_VW\",\"ID\"]]","arguments":"a,COST_PER_GRAM","formula":"a / (COST_PER_GRAM * 1000) ","solution":"N"}, {"a":"g/L","b":"M","meta":"[[\"MW\",\"TEST_METADATA_VW\",\"ID\"]]","arguments":"a,MW","formula":"a / MW","solution":"N"}, {"a":"K","b":"\u00B0C","meta":null,"arguments":"a","formula":"a - 273.15","solution":"N"}, {"a":"ppm","b":"g/L","meta":null,"arguments":"a","formula":"a / 1001.142303","solution":"N"}, {"a":"\u00B0F","b":"\u00B0C","meta":null,"arguments":"a","formula":"(a - 32) * (5/9)","solution":"N"}, {"a":"kg","b":"Moles","meta":"[[\"MW\",\"TEST_METADATA_VW\",\"ID\"]]","arguments":"a,MW","formula":"(a / MW) *1000","solution":"N"}, {"a":"kg","b":"L","meta":"[[\"CONCENTRATION\",\"TEST_METADATA_VW\",\"ID\"]]","arguments":"a,CONCENTRATION","formula":"(a *1000) / CONCENTRATION","solution":"Y"}, {"a":"\u00B0F","b":"\u00B0R","meta":null,"arguments":"a","formula":"a +459.67","solution":"N"}, {"a":"Pints","b":"L","meta":null,"arguments":"a","formula":"a * 0.568261","solution":"N"}, {"a":"Count","b":"Moles","meta":null,"arguments":"a","formula":"a / 602214076000000000000000","solution":"N"}, {"a":"kg","b":"A","meta":"[[\"MW\",\"TEST_METADATA_VW\",\"ID\"]]","arguments":"a,MW","formula":"a - MW","solution":"N"}, {"a":"kg","b":"L","meta":"[[\"DENSITY\",\"TEST_METADATA_VW\",\"ID\"]]","arguments":"a,DENSITY","formula":"a / DENSITY","solution":"N"}, {"a":"kg","b":"TESTUNIT","meta":null,"arguments":"a","formula":"a -10","solution":"N"}]`;

async function fetchFuturelab(action: string): Promise<string> {
  const url = `${FUTURELAB_BASE}?action=${action}`;
  const response = await fetch(url, { method: "GET" });
  if (response.status === 200) {
    return response.text();
  }
  return "FAILED";
}

/** Get Units from External Location (standin for an API endpoint)
    @remarks format required by engine - example:  
        {
            group: 'Volume',
            name: 'mL',
            base: 'L', -- Unit by which formula conversions operate
            inner_conversion: 0.001 -- scale relatie to base
        }
    @returns array of JSON objects in the above format
*/
export async function getUnits(): Promise<string> {
  if (!USE_FUTURELAB_API) {
    return LOCAL_UNITS_JSON;
  }
  return fetchFuturelab("getUnits");
}

/** Get conversion Formulae from External Location  (standin for an API endpoint)
    @remarks format required by engine - example:  
        {
            a: 'kg', -- unit to convert from 
            b: '£', -- unit to convert to
            formula: 'a * (COST_PER_GRAM * 1000) --'a' is treated by the tool as the value to be converted in unit (a) 
            arguments: 'a,COST_PER_GRAM' -- comma separated list of arguments to mask into function 
        }
    @returns array of JSON objects in the above format
*/
export async function getFormulae(): Promise<string> {
  if (!USE_FUTURELAB_API) {
    
    return LOCAL_FORMULAE_JSON;
  }
  return fetchFuturelab("getFormulae");
}

/** Get Materials from External Location  (standin for an API endpoint) 
    @remarks format required by engine - example: 
        {
            name: 'Acetic Acid',
            Acetic Acid: 53,
            id: 53, -- end of mandatory fields! additional fields are known metadata params for formulae
            MW: 60.052, -- these metadata fields should correspond to those used in the formulae above
            DENSITY: 1.0524, 
            COST_PER_GRAM: 0.34,
            MORE METADATA…
        }
    @returns array of JSON objects in the above format
*/
export async function getMaterials(): Promise<string> {
  if (!USE_FUTURELAB_API) {
    return "[]";
  }
  return fetchFuturelab("getMaterials");
}
