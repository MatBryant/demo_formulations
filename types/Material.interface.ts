import type { MaterialType } from "./ddcTypes";

export interface IMaterial<TType extends MaterialType = MaterialType> {
  id: string;
  type: TType;
  name: string;
  alias: string;
  description: string;
  created: Date;
  state: string;
  density?: number;
  costPerGram: number;
  costUnit: string;
  hazards: string[];
}
