import { useMemo, useState, useEffect, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import type { CellDoubleClickedEvent, ColDef } from "ag-grid-community";
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import type { CustomCellEditorProps, CustomCellRendererProps } from "ag-grid-react";
import type Reagent from "../classes/Reagent";
import ReagentPickerModal, {
  type IngredientPickerItem,
  type PremixOption,
} from "./reagentPickerModal";
import {
  collectFormulationKeys,
  formulationColumnClasses,
  ingredientRowCellClass,
  shouldHidePremixColumn,
  type FormulationTypeMap,
} from "../util/formulationColumnStyles";
import type { AlignedGridBinding } from "../hooks/useAlignedFormulationGrids";
import {
  DEFAULT_TABLE_UNIT,
  TABLE_DEFAULT_UNITS,
  type TableDefaultUnit,
} from "../util/tableDefaultUnits";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

ModuleRegistry.registerModules([AllCommunityModule]);

type Unit = TableDefaultUnit;
export type Amount = { value: number; unit: Unit };
/** Diluent presence in a formula; calculated amount is read-only display. */
export type DiluentCellValue = {
  diluent: true;
  value?: number;
  unit?: Unit;
};
/** Ingredient is in the recipe but has no amount yet. */
export type EmptyRecipeCell = { empty: true };
/** mass%/vol%/g/L/g/mL — editable value on the left, resolved mass read-only on the right. */
export type PercentCellValue = {
  percent: true;
  value: number;
  unit: "mass%" | "vol%" | "g/L" | "g/mL";
  resolvedValue?: number;
  resolvedUnit?: string;
};

export function isSplitResolvedRecipeUnit(
  unit: string
): unit is PercentCellValue["unit"] {
  return (
    unit === "mass%" ||
    unit === "vol%" ||
    unit === "g/L" ||
    unit === "g/mL"
  );
}
export type FormulationCellValue =
  | Amount
  | DiluentCellValue
  | EmptyRecipeCell
  | PercentCellValue;

// formulation keys like "F-0001", "F-1234", etc.
export type FormulationKey = `F-${string}`;

// Row has fixed fields + any number of formulation columns
export type Row = {
  id: string
  ingredient: string
  role: string
  _userAdded?: boolean
  _rowId?: string
} & Partial<Record<FormulationKey, FormulationCellValue>>;

function rowKey(row: Pick<Row, "id" | "role">): string {
  return `${row.id}__${row.role}`;
}

export type IngredientChangePayload = {
  formulationId: FormulationKey;
  id: string;
  name: string;
  role: string;
  amount?: number;
  unit?: string;
  isDiluent?: boolean;
  matchId?: string;
  matchRole?: string;
};

function isFormulationKey(k: string): k is FormulationKey {
  return k.startsWith("F-");
}

function isDiluentRow(row: Row | undefined): boolean {
  return row?.role === "diluent";
}

function isSelfReference(
  row: Row | undefined,
  formulationId: FormulationKey
): boolean {
  return Boolean(row?.id && row.id === formulationId);
}

function isDiluentCellValue(
  value: FormulationCellValue | undefined | null
): value is DiluentCellValue {
  return (
    value != null &&
    typeof value === "object" &&
    "diluent" in value &&
    value.diluent === true
  );
}

function isEmptyRecipeCell(
  value: FormulationCellValue | undefined | null
): value is EmptyRecipeCell {
  return (
    value != null &&
    typeof value === "object" &&
    "empty" in value &&
    value.empty === true
  );
}

function isDiluentChecked(
  value: FormulationCellValue | undefined | null
): boolean {
  return isDiluentCellValue(value);
}

function formatDiluentCalculated(
  value: FormulationCellValue | undefined | null
): string {
  if (
    !isDiluentCellValue(value) ||
    value.value == null ||
    value.unit == null ||
    value.value === 0
  ) {
    return "";
  }
  return `${value.value} ${value.unit}`;
}

function isPercentCellValue(
  value: FormulationCellValue | undefined | null
): value is PercentCellValue {
  return (
    value != null &&
    typeof value === "object" &&
    "percent" in value &&
    value.percent === true
  );
}

function isAmount(value: FormulationCellValue | undefined | null): value is Amount {
  return (
    value != null &&
    typeof value === "object" &&
    !isDiluentCellValue(value) &&
    !isEmptyRecipeCell(value) &&
    !isPercentCellValue(value)
  );
}

function formatPercentResolved(
  value: FormulationCellValue | undefined | null
): string {
  if (
    !isPercentCellValue(value) ||
    value.resolvedValue == null ||
    !value.resolvedUnit
  ) {
    return "";
  }
  return `${value.resolvedValue} ${value.resolvedUnit}`;
}

function isZeroAmount(amount: Amount | undefined | null): boolean {
  return amount != null && Number(amount.value) === 0;
}

function formatAmount(value: FormulationCellValue | undefined | null): string {
  if (isEmptyRecipeCell(value)) return "";
  if (!isAmount(value) || isZeroAmount(value)) return "";
  return `${value.value} ${value.unit}`;
}

function getRowDiluentFormulations(
  row: Row,
  formulationKeys: FormulationKey[]
): FormulationKey[] {
  return formulationKeys.filter(
    (k) => isDiluentChecked(row[k]) && !isSelfReference(row, k)
  );
}

function rowHasIdentity(row: Row): boolean {
  return Boolean(row.id && row.role);
}

function getRowFormulationAmounts(
  row: Row,
  formulationKeys: FormulationKey[]
): Array<{ formulationId: FormulationKey; amount: Amount }> {
  return formulationKeys
    .filter((k) => {
      const cell = row[k];
      if (isSelfReference(row, k)) return false;
      if (isPercentCellValue(cell)) return cell.value !== 0;
      return isAmount(cell) && !isZeroAmount(cell);
    })
    .map((k) => {
      const cell = row[k]!;
      if (isPercentCellValue(cell)) {
        return {
          formulationId: k,
          amount: { value: cell.value, unit: cell.unit },
        };
      }
      return { formulationId: k, amount: cell as Amount };
    });
}

function untickOtherDiluentsInColumn(
  rows: Row[],
  formulationId: FormulationKey,
  activeRow: Row,
  onIngredientChange?: (payload: IngredientChangePayload) => void
) {
  for (const row of rows) {
    if (row === activeRow || !isDiluentRow(row) || isSelfReference(row, formulationId)) {
      continue;
    }
    if (!isDiluentChecked(row[formulationId]) || !rowHasIdentity(row)) {
      continue;
    }

    onIngredientChange?.({
      formulationId,
      id: row.id,
      name: row.ingredient,
      role: row.role,
      matchId: row.id,
      matchRole: row.role,
    });
    delete row[formulationId];
  }
}

function scrubRowForRoleChange(row: Row, oldRole: string, newRole: string) {
  if (oldRole === "diluent") {
    for (const key of Object.keys(row)) {
      if (isFormulationKey(key) && isDiluentChecked(row[key])) {
        delete row[key];
      }
    }
  }
  if (newRole === "diluent") {
    for (const key of Object.keys(row)) {
      if (!isFormulationKey(key) || isSelfReference(row, key)) continue;
      const value = row[key];
      if (
        (isAmount(value) && !isZeroAmount(value)) ||
        (isPercentCellValue(value) && value.value !== 0)
      ) {
        row[key] = { diluent: true };
      } else if (
        value == null ||
        isZeroAmount(value as Amount) ||
        (isPercentCellValue(value) && value.value === 0)
      ) {
        delete row[key];
      }
    }
  }
}

type PickerTarget =
  | { mode: "add" }
  | { mode: "edit"; row: Row; rowIndex: number };

export type ReagentSelectPayload = {
  oldId: string;
  oldRole: string;
  ingredient: Pick<IngredientPickerItem, "id" | "name">;
};

export type RoleChangePayload = {
  id: string;
  oldRole: string;
  newRole: string;
};

const ROLE_OPTIONS = [
  "ingredient",
  "active",
  "additive",
  "solvent",
  "diluent",
] as const;

interface IGridData {
  data: Row[];
  reagents: Reagent[];
  premixes?: PremixOption[];
  formulationTypes?: FormulationTypeMap;
  showPremixColumns?: boolean;
  gridBinding?: AlignedGridBinding;
  onIngredientChange?: (payload: IngredientChangePayload) => void;
  onReagentSelect?: (payload: ReagentSelectPayload) => void;
  onRoleChange?: (payload: RoleChangePayload) => void;
  defaultUnit?: TableDefaultUnit;
}

function DiluentCheckboxRenderer(props: CustomCellRendererProps<Row, FormulationCellValue>) {
  const field = props.colDef?.field as FormulationKey | undefined;
  const disabled = field != null && isSelfReference(props.data, field);
  const checked = !disabled && isDiluentChecked(props.value);
  const calculated = formatDiluentCalculated(props.value);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: "100%",
        height: "100%",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => {
          if (disabled || !field) return;
          props.node.setDataValue(
            field,
            e.target.checked ? { diluent: true } : undefined
          );
        }}
        onClick={(e) => e.stopPropagation()}
      />
      {checked && calculated && (
        <span style={{ fontSize: 13, color: "#4b5563" }}>{calculated}</span>
      )}
    </div>
  );
}

function PercentCellRenderer(
  props: CustomCellRendererProps<Row, FormulationCellValue>
) {
  const value = props.value;
  if (!isPercentCellValue(value)) return null;
  const resolved = formatPercentResolved(value);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        width: "100%",
        height: "100%",
      }}
    >
      <span>{`${value.value} ${value.unit}`}</span>
      {resolved && (
        <span style={{ fontSize: 13, color: "#4b5563", whiteSpace: "nowrap" }}>
          {resolved}
        </span>
      )}
    </div>
  );
}

function FormulationCellRenderer(props: CustomCellRendererProps<Row, FormulationCellValue>) {
  const field = props.colDef?.field as FormulationKey | undefined;
  if (field && isSelfReference(props.data, field)) {
    return <span style={{ color: "#9ca3af" }}>—</span>;
  }
  if (isDiluentRow(props.data)) {
    return <DiluentCheckboxRenderer {...props} />;
  }
  if (isPercentCellValue(props.value)) {
    return <PercentCellRenderer {...props} />;
  }
  return <span>{formatAmount(props.value)}</span>;
}

function editorFallbackUnit(
  value: FormulationCellValue | undefined | null,
  row: Row | undefined,
  defaultUnit?: Unit
): Unit {
  if (isPercentCellValue(value)) return value.unit;
  if (isAmount(value) && value.unit) return value.unit;
  // Default unit applies only to new user-added ingredient rows.
  if (row?._userAdded) return defaultUnit ?? DEFAULT_TABLE_UNIT;
  return DEFAULT_TABLE_UNIT;
}

// v35 React controlled cell editor
function AmountCellEditor(
  props: CustomCellEditorProps<Row, FormulationCellValue> & {
    units?: Unit[];
    defaultUnit?: Unit;
  }
) {
  const units = props.units ?? [...TABLE_DEFAULT_UNITS];

  const [value, setValue] = useState<string>(() => {
    const v = props.value;
    if (isPercentCellValue(v)) return String(v.value);
    if (!v || !isAmount(v) || isZeroAmount(v)) return "";
    return String(v.value);
  });
  const [unit, setUnit] = useState<Unit>(() =>
    editorFallbackUnit(props.value, props.data, props.defaultUnit)
  );

  // When the editor mounts, ensure local state matches the provided value
  useEffect(() => {
    const v = props.value;
    if (isPercentCellValue(v)) {
      setValue(String(v.value));
      setUnit(v.unit);
      return;
    }
    setValue(!v || !isAmount(v) || isZeroAmount(v) ? "" : String(v.value));
    setUnit(editorFallbackUnit(v, props.data, props.defaultUnit));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // push changes back to AG Grid (commit happens when editing stops)
  useEffect(() => {
    const numericValue = value === "" ? 0 : Number(value);
    if (value === "" || numericValue === 0) {
      props.onValueChange(undefined);
      return;
    }
    props.onValueChange({ value: numericValue, unit });
  }, [value, unit]); // <-- key part

  return (
    <div
      style={{ display: "flex", gap: 8, alignItems: "center", width: "100%" }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{ width: 90 }}
        autoFocus
      />
      <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
        {units.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function SimpleGrid({
  data,
  reagents,
  premixes = [],
  formulationTypes = {},
  showPremixColumns = true,
  gridBinding,
  onIngredientChange,
  onReagentSelect,
  onRoleChange,
  defaultUnit = DEFAULT_TABLE_UNIT,
}: IGridData) {
  const [extraRows, setExtraRows] = useState<Row[]>([]);
  const blankRowCounter = useRef(0);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);

  // Collect all formulation keys present in the dataset
  const premixIds = useMemo(
    () => new Set(premixes.map((p) => p.id)),
    [premixes]
  );
  const reagentIds = useMemo(
    () => new Set(reagents.map((r) => r.id)),
    [reagents]
  );

  const formulationKeys = useMemo<FormulationKey[]>(
    () => collectFormulationKeys(formulationTypes, [...data, ...extraRows]),
    [data, extraRows, formulationTypes]
  );

  const rowData = useMemo(() => {
    const seen = new Set<string>();
    const merged: Row[] = [];

    for (const row of data) {
      if (row.id && row.role) {
        seen.add(rowKey(row));
      }
      merged.push(row);
    }

    for (const row of extraRows) {
      if (!row.id || !row.role) {
        merged.push(row);
        continue;
      }
      const key = rowKey(row);
      if (!seen.has(key)) {
        merged.push(row);
        seen.add(key);
      }
    }

    return merged;
  }, [data, extraRows]);

  const openAddIngredientPicker = () => {
    setPickerTarget({ mode: "add" });
  };

  const addRowFromPicker = (item: Pick<IngredientPickerItem, "id" | "name">) => {
    blankRowCounter.current += 1;
    const newRow: Row = {
      id: item.id,
      ingredient: item.name,
      role: "ingredient",
      _userAdded: true,
      _rowId: `blank-${blankRowCounter.current}`,
    };
    setExtraRows((prev) => [...prev, newRow]);
  };

  const syncExtraRows = (rows: Row[]) => {
    setExtraRows(rows.filter((row) => row._userAdded));
  };

  const applyIngredientToRow = (
    row: Row,
    rowIndex: number,
    ingredient: Pick<IngredientPickerItem, "id" | "name">
  ) => {
    const oldId = row.id;
    const oldRole = row.role;
    const updatedRow: Row = {
      ...row,
      id: ingredient.id,
      ingredient: ingredient.name,
    };

    if (isFormulationKey(ingredient.id)) {
      delete updatedRow[ingredient.id];
    }

    if (row._userAdded) {
      const extraIndex = rowIndex - data.length;
      setExtraRows((prev) =>
        prev.map((r, i) => (i === extraIndex ? updatedRow : r))
      );

      if (isDiluentRow(row)) {
        getRowDiluentFormulations(row, formulationKeys).forEach((formulationId) => {
          onIngredientChange?.({
            formulationId,
            id: ingredient.id,
            name: ingredient.name,
            role: row.role,
            isDiluent: true,
            unit: "g",
            matchId: oldId || undefined,
            matchRole: oldRole || undefined,
          });
        });
      } else {
        getRowFormulationAmounts(row, formulationKeys).forEach(
          ({ formulationId, amount }) => {
            onIngredientChange?.({
              formulationId,
              id: ingredient.id,
              name: ingredient.name,
              role: row.role,
              amount: amount.value,
              unit: amount.unit,
              matchId: oldId || undefined,
              matchRole: oldRole || undefined,
            });
          }
        );
      }
    } else {
      onReagentSelect?.({ oldId, oldRole, ingredient });
    }
  };

  const handleCellDoubleClicked = (event: CellDoubleClickedEvent<Row>) => {
    const field = event.colDef.field;
    if (field !== "id" && field !== "ingredient") return;
    if (!event.data || event.rowIndex == null) return;
    setPickerTarget({
      mode: "edit",
      row: event.data,
      rowIndex: event.rowIndex,
    });
  };

  const columnDefs = useMemo<ColDef<Row>[]>(() => {
    const ingredientCellClass = (row: Row | undefined) =>
      ingredientRowCellClass(row?.id, premixIds, reagentIds);

    const base: ColDef<Row>[] = [
      {
        field: "id",
        headerName: "Id",
        pinned: "left",
        width: 140,
        suppressMovable: true,
        editable: false,
        cellClass: (params) => ingredientCellClass(params.data),
        headerClass: "first-column-header",
      },
      {
        field: "ingredient",
        headerName: "Ingredient",
        pinned: "left",
        width: 140,
        suppressMovable: true,
        editable: false,
        cellClass: (params) => ingredientCellClass(params.data),
        headerClass: "first-column-header",
      },
      {
        field: "role",
        headerName: "Role",
        pinned: "left",
        width: 140,
        suppressMovable: true,
        editable: true,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: {
          values: [...ROLE_OPTIONS],
        },
        cellClass: (params) => ingredientCellClass(params.data),
        headerClass: "first-column-header",
      },
    ];

    const formulationCols: ColDef<Row>[] = formulationKeys.map((k) => {
      const { cellClass, headerClass } = formulationColumnClasses(k, formulationTypes);
      return {
      colId: k,
      headerName: k,
      field: k,
      hide: shouldHidePremixColumn(k, formulationTypes, showPremixColumns),
      cellClass,
      headerClass,
      editable: (params) =>
        !isDiluentRow(params.data) && !isSelfReference(params.data, k),

      cellDataType: false,

      cellRenderer: FormulationCellRenderer,

      cellEditor: AmountCellEditor,
      cellEditorParams: {
        units: [...TABLE_DEFAULT_UNITS],
        defaultUnit,
      },

      valueSetter: (p) => {
        const field = p.colDef.field as FormulationKey | undefined;
        if (!field || !p.data || isSelfReference(p.data, field)) return false;

        if (isDiluentRow(p.data)) {
          if (isDiluentChecked(p.newValue as FormulationCellValue)) {
            const existing = p.data[field];
            p.data[field] = isDiluentCellValue(existing)
              ? { diluent: true, value: existing.value, unit: existing.unit }
              : { diluent: true };
          } else {
            delete p.data[field];
          }
          return true;
        }

        const amount = p.newValue as Amount | undefined | null;
        if (!amount || isZeroAmount(amount)) {
          p.data[field] = { empty: true };
        } else if (isSplitResolvedRecipeUnit(amount.unit)) {
          const existing = p.data[field];
          const resolved = isPercentCellValue(existing)
            ? {
                resolvedValue: existing.resolvedValue,
                resolvedUnit: existing.resolvedUnit,
              }
            : {};
          p.data[field] = {
            percent: true,
            value: amount.value,
            unit: amount.unit,
            ...resolved,
          };
        } else {
          p.data[field] = amount;
        }
        return true;
      },
    };
    });

    return [...base, ...formulationCols];
  }, [
    formulationKeys,
    formulationTypes,
    showPremixColumns,
    premixIds,
    reagentIds,
    defaultUnit,
  ]);

  const defaultColDef = useMemo<ColDef<Row>>(
    () => ({
      flex: 1,
      resizable: true,
      sortable: false,
      editable: true,
    }),
    []
  );

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 8 }}>
        <button
          style={{ backgroundColor: "#4b5563", color: "white" }}
          type="button"
          onClick={openAddIngredientPicker}
        >
          + Ingredient Row
        </button>
      </div>
      <div className="ag-theme-quartz" style={{ height: "100%", width: "100%" }}>
        <AgGridReact<Row>
          domLayout="autoHeight"
          theme="legacy"
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          alignedGrids={gridBinding?.alignedGrids}
          onGridReady={gridBinding?.onGridReady}
          getRowId={(params) =>
            params.data._rowId ?? rowKey(params.data)
          }
          singleClickEdit
          stopEditingWhenCellsLoseFocus
          onCellDoubleClicked={handleCellDoubleClicked}
          onCellValueChanged={(e) => {
            const updated: Row[] = [];
            e.api.forEachNode((n) => n.data && updated.push(n.data));

            const field = e.colDef.field;
            const oldRole = String(e.oldValue ?? "");
            const newRole = String(e.newValue ?? "");

            if (field === "role") {
              scrubRowForRoleChange(e.data, oldRole, newRole);

              if (e.data._userAdded) {
                if (oldRole === "diluent") {
                  getRowDiluentFormulations(e.data, formulationKeys).forEach(
                    (formulationId) => {
                      onIngredientChange?.({
                        formulationId,
                        id: e.data.id,
                        name: e.data.ingredient,
                        role: oldRole,
                        matchId: e.data.id,
                        matchRole: oldRole,
                      });
                    }
                  );
                }
                if (newRole === "diluent") {
                  getRowDiluentFormulations(e.data, formulationKeys).forEach(
                    (formulationId) => {
                      onIngredientChange?.({
                        formulationId,
                        id: e.data.id,
                        name: e.data.ingredient,
                        role: newRole,
                        isDiluent: true,
                        unit: "g",
                        matchId: e.data.id,
                        matchRole: oldRole,
                      });
                    }
                  );
                } else {
                  getRowFormulationAmounts(e.data, formulationKeys).forEach(
                    ({ formulationId, amount }) => {
                      onIngredientChange?.({
                        formulationId,
                        id: e.data.id,
                        name: e.data.ingredient,
                        role: newRole,
                        amount: amount.value,
                        unit: amount.unit,
                        matchId: e.data.id,
                        matchRole: oldRole,
                      });
                    }
                  );
                }
              } else {
                onRoleChange?.({
                  id: e.data.id,
                  oldRole,
                  newRole,
                });
              }
              syncExtraRows(updated);
              return;
            }

            if (
              !field ||
              !isFormulationKey(field) ||
              !rowHasIdentity(e.data) ||
              isSelfReference(e.data, field)
            ) {
              syncExtraRows(updated);
              return;
            }

            if (isDiluentRow(e.data)) {
              if (isDiluentChecked(e.newValue as FormulationCellValue)) {
                untickOtherDiluentsInColumn(
                  updated,
                  field,
                  e.data,
                  onIngredientChange
                );
                onIngredientChange?.({
                  formulationId: field,
                  id: e.data.id,
                  name: e.data.ingredient,
                  role: e.data.role,
                  isDiluent: true,
                  unit: "g",
                });
              } else {
                onIngredientChange?.({
                  formulationId: field,
                  id: e.data.id,
                  name: e.data.ingredient,
                  role: e.data.role,
                  matchId: e.data.id,
                  matchRole: e.data.role,
                });
              }
              syncExtraRows(updated);
              return;
            }

            const cell = e.data[field as FormulationKey] as
              | FormulationCellValue
              | undefined;
            if (isPercentCellValue(cell)) {
              if (cell.value === 0) {
                onIngredientChange?.({
                  formulationId: field,
                  id: e.data.id,
                  name: e.data.ingredient,
                  role: e.data.role,
                  matchId: e.data.id,
                  matchRole: e.data.role,
                });
              } else {
                onIngredientChange?.({
                  formulationId: field,
                  id: e.data.id,
                  name: e.data.ingredient,
                  role: e.data.role,
                  amount: cell.value,
                  unit: cell.unit,
                });
              }
            } else {
              const amount = cell as Amount | undefined | null;
              if (!amount || !isAmount(amount) || isZeroAmount(amount)) {
                onIngredientChange?.({
                  formulationId: field,
                  id: e.data.id,
                  name: e.data.ingredient,
                  role: e.data.role,
                  matchId: e.data.id,
                  matchRole: e.data.role,
                });
              } else {
                onIngredientChange?.({
                  formulationId: field,
                  id: e.data.id,
                  name: e.data.ingredient,
                  role: e.data.role,
                  amount: amount.value,
                  unit: amount.unit,
                });
              }
            }

            syncExtraRows(updated);
          }}
        />
      </div>

      {pickerTarget && (
        <ReagentPickerModal
          reagents={reagents}
          premixes={premixes}
          excludeIds={
            pickerTarget.mode === "edit" && pickerTarget.row.id
              ? [pickerTarget.row.id]
              : undefined
          }
          onClose={() => setPickerTarget(null)}
          onSelect={(item) => {
            if (pickerTarget.mode === "add") {
              addRowFromPicker(item);
            } else {
              applyIngredientToRow(
                pickerTarget.row,
                pickerTarget.rowIndex,
                item
              );
            }
            setPickerTarget(null);
          }}
        />
      )}
    </div>
  );
}
