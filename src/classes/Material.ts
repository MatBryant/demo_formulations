import type { IMaterial } from "../../types/Material.interface";
import type { MaterialType } from "../../types/ddcTypes";

export abstract class Material<TType extends MaterialType> implements IMaterial<TType> {
  public readonly id: string;
  public readonly type: TType;
  public readonly name: string;
  public readonly created: Date;
  public density?: number;
  public alias: string;
  public costPerGram: number;
  public costUnit: string;
  public state: string;
  public description: string;
  public hazards: string[];

  constructor(args: IMaterial<TType>) {
    this.id = args.id;
    this.type = args.type;
    this.name = args.name;
    this.created = args.created;
    this.density = args.density;
    this.alias = args.alias;
    this.costPerGram = args.costPerGram;
    this.costUnit = args.costUnit;
    this.state = args.state;
    this.description = args.description;
    this.hazards = args.hazards;
  }
}
