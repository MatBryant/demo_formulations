import { useMemo, useState, useEffect, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef } from "ag-grid-community";
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import type {
  CustomCellEditorProps,
  CustomCellRendererProps,
} from "ag-grid-react";

import {
  collectFormulationKeys,
  formulationColumnClasses,
  shouldHidePremixColumn,
  type FormulationTypeMap,
} from "../util/formulationColumnStyles";
import type { AlignedGridBinding } from "../hooks/useAlignedFormulationGrids";
import type { CompositionWarning } from "../../types/FormulatedProduct.interface";
import type unitConversionEngine from "../classes/UnitConversionEngine";
import {
  COMPOSITION_DISPLAY_UNITS,
  convertCompositionDisplayUnit,
  formatCompositionDisplay,
  type CompositionDisplayUnit,
  type FormulationCompositionContext,
  type MaterialResolver,
} from "../util/compositionViewConverter";
import {
  DEFAULT_TABLE_UNIT,
  type TableDefaultUnit,
} from "../util/tableDefaultUnits";
import { DEFAULT_DISPLAY_DECIMALS } from "../util/displayDecimals";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

ModuleRegistry.registerModules([AllCommunityModule]);

export type FormulationKey = `F-${string}`;

export type CompositionCanonical = {
  amount: number;
  unit: string;
};

export type CompositionCellValue = {
  value: number;
  unit: CompositionDisplayUnit;
  canonical: CompositionCanonical;
};

export type Row = {
  id: string;
  ingredient: string;
  role: string;
} & Partial<Record<FormulationKey, CompositionCellValue>>;

export type CompositionDisplayUnitChange = {
  formulationId: FormulationKey;
  ingredientId: string;
  displayUnit: CompositionDisplayUnit;
};

function CompositionCellRenderer(
  props: CustomCellRendererProps<Row, CompositionCellValue> & {
    displayDecimals?: number;
  }
) {
  const dp = props.displayDecimals ?? DEFAULT_DISPLAY_DECIMALS;
  return <span>{formatCompositionDisplay(props.value, dp)}</span>;
}

function CompositionUnitCellEditor(
  props: CustomCellEditorProps<Row, CompositionCellValue> & {
    formulationContext?: FormulationCompositionContext;
    resolveMaterial?: MaterialResolver;
    unitConverter?: unitConversionEngine;
    defaultDisplayUnit?: TableDefaultUnit;
    displayDecimals?: number;
  }
) {
  const canonical = props.value?.canonical;
  const fallbackUnit = props.defaultDisplayUnit ?? DEFAULT_TABLE_UNIT;
  const [unit, setUnit] = useState<CompositionDisplayUnit>(
    () => props.value?.unit ?? fallbackUnit
  );
  const skipInitialConversion = useRef(true);

  useEffect(() => {
    if (skipInitialConversion.current) {
      skipInitialConversion.current = false;
      return;
    }

    if (
      !canonical ||
      !props.formulationContext ||
      !props.resolveMaterial ||
      !props.unitConverter
    ) {
      return;
    }

    const converted = convertCompositionDisplayUnit(
      {
        id: props.data?.id ?? "",
        amount: canonical.amount,
        unit: canonical.unit,
      },
      unit,
      props.formulationContext,
      props.resolveMaterial,
      props.unitConverter,
      props.displayDecimals ?? DEFAULT_DISPLAY_DECIMALS
    );

    if (!converted) {
      props.onValueChange(undefined);
      return;
    }

    props.onValueChange({
      value: converted.value,
      unit: converted.unit,
      canonical,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit]);

  return (
    <div
      style={{ width: "100%" }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <select
        value={unit}
        onChange={(e) => setUnit(e.target.value as CompositionDisplayUnit)}
        style={{ width: "100%" }}
        autoFocus
      >
        {COMPOSITION_DISPLAY_UNITS.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
    </div>
  );
}

interface CompositionGridProps {
  data: Row[];
  formulationTypes?: FormulationTypeMap;
  formulationContexts?: Partial<Record<FormulationKey, FormulationCompositionContext>>;
  resolveMaterial?: MaterialResolver;
  unitConverter?: unitConversionEngine;
  showPremixColumns?: boolean;
  gridBinding?: AlignedGridBinding;
  warnings?: CompositionWarning[];
  onDisplayUnitChange?: (payload: CompositionDisplayUnitChange) => void;
  defaultDisplayUnit?: TableDefaultUnit;
  displayDecimals?: number;
}

export default function CompositionGrid({
  data,
  formulationTypes = {},
  formulationContexts = {},
  resolveMaterial,
  unitConverter,
  showPremixColumns = true,
  gridBinding,
  warnings = [],
  onDisplayUnitChange,
  defaultDisplayUnit = DEFAULT_TABLE_UNIT,
  displayDecimals = DEFAULT_DISPLAY_DECIMALS,
}: CompositionGridProps) {
  const [rowData, setRowData] = useState<Row[]>(data);

  useEffect(() => {
    setRowData(data);
  }, [data]);

  const formulationKeys = useMemo<FormulationKey[]>(
    () => collectFormulationKeys(formulationTypes, data),
    [data, formulationTypes]
  );

  const columnDefs = useMemo<ColDef<Row>[]>(() => {
    const base: ColDef<Row>[] = [
      {
        field: "id",
        headerName: "Id",
        pinned: "left",
        width: 140,
        suppressMovable: true,
        editable: false,
        cellClass: "first-column",
        headerClass: "first-column-header",
      },
      {
        field: "ingredient",
        headerName: "Ingredient",
        pinned: "left",
        width: 140,
        suppressMovable: true,
        editable: false,
        cellClass: "first-column",
        headerClass: "first-column-header",
      },
      {
        field: "role",
        headerName: "Role",
        pinned: "left",
        width: 140,
        suppressMovable: true,
        editable: false,
        cellClass: "first-column",
        headerClass: "first-column-header",
      },
    ];

    const formulationCols: ColDef<Row>[] = formulationKeys.map((k) => {
      const { cellClass, headerClass } = formulationColumnClasses(k, formulationTypes);
      const formulationContext = formulationContexts[k];

      return {
        colId: k,
        headerName: k,
        field: k,
        hide: shouldHidePremixColumn(k, formulationTypes, showPremixColumns),
        cellClass,
        headerClass,
        editable: (params) => {
          const field = params.colDef?.field as FormulationKey | undefined;
          if (!field || !params.data) return false;
          return params.data[field] != null;
        },
        cellDataType: false,
        cellRenderer: CompositionCellRenderer,
        cellRendererParams: { displayDecimals },
        cellEditor: CompositionUnitCellEditor,
        cellEditorParams: {
          formulationContext,
          resolveMaterial,
          unitConverter,
          defaultDisplayUnit,
          displayDecimals,
        },
        cellEditorPopup: true,
      };
    });

    return [...base, ...formulationCols];
  }, [
    formulationKeys,
    formulationTypes,
    formulationContexts,
    resolveMaterial,
    unitConverter,
    showPremixColumns,
    defaultDisplayUnit,
    displayDecimals,
  ]);

  const defaultColDef = useMemo<ColDef<Row>>(
    () => ({
      flex: 1,
      resizable: true,
      sortable: true,
      editable: false,
    }),
    []
  );

  return (
    <div style={{ width: "100%" }}>
      {warnings.length > 0 && (
        <div
          role="alert"
          style={{
            marginBottom: 8,
            padding: "10px 12px",
            backgroundColor: "#fef3c7",
            border: "1px solid #f59e0b",
            borderRadius: 4,
            color: "#92400e",
            fontSize: "0.9em",
          }}
        >
          <strong>Approximate composition:</strong> Volumes of mixed solvents are
          not strictly additive. One or more pre-mix expansions used volume-based
          apportionment because mass or density metadata was insufficient for a
          mass-based calculation. Values may be slightly inaccurate (e.g.
          ethanol–water mixtures).
          <ul style={{ margin: "8px 0 0", paddingLeft: "1.25rem" }}>
            {warnings.map((w) => (
              <li key={`${w.parentFormulationId}:${w.childFormulationId}`}>
                {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div
        className="ag-theme-quartz"
        style={{ height: "100%", width: "100%" }}
      >
        <AgGridReact<Row>
          domLayout="autoHeight"
          theme="legacy"
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          alignedGrids={gridBinding?.alignedGrids}
          onGridReady={gridBinding?.onGridReady}
          singleClickEdit
          stopEditingWhenCellsLoseFocus
          onCellValueChanged={(e) => {
            const field = e.colDef.field as FormulationKey | undefined;
            if (!field || !e.data?.id || !e.newValue) return;

            const oldCell = e.oldValue as CompositionCellValue | undefined;
            const newCell = e.newValue as CompositionCellValue;
            if (!newCell?.unit || oldCell?.unit === newCell.unit) return;

            onDisplayUnitChange?.({
              formulationId: field,
              ingredientId: e.data.id,
              displayUnit: newCell.unit,
            });
          }}
        />
      </div>
    </div>
  );
}
