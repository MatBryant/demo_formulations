import { useMemo, useState, useEffect } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef } from "ag-grid-community";
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import type { MetadataRow } from "../App";
import type { AlignedGridBinding } from "../hooks/useAlignedFormulationGrids";
import {
  collectFormulationKeys,
  formulationColumnClasses,
  shouldHidePremixColumn,
  type FormulationTypeMap,
} from "../util/formulationColumnStyles";
import {
  DEFAULT_DISPLAY_DECIMALS,
  formatValue,
} from "../util/displayDecimals";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

ModuleRegistry.registerModules([AllCommunityModule]);

// keys like "F-0001"
export type FormulationKey = `F-${string}`;

interface MetadataTableProps {
  data: MetadataRow[];
  formulationTypes?: FormulationTypeMap;
  showPremixColumns?: boolean;
  displayDecimals?: number;
  commit: (rows: MetadataRow[]) => void;
  gridBinding?: AlignedGridBinding;
}

export default function MetadataTable({
  data,
  formulationTypes = {},
  showPremixColumns = true,
  displayDecimals = DEFAULT_DISPLAY_DECIMALS,
  commit,
  gridBinding,
}: MetadataTableProps) {
  const [rowData, setRowData] = useState<MetadataRow[]>(data);

  useEffect(() => {
    setRowData(data);
  }, [data]);

  const formulationKeys = useMemo<FormulationKey[]>(
    () => collectFormulationKeys(formulationTypes, data),
    [data, formulationTypes]
  );

  const columnDefs = useMemo<ColDef<MetadataRow>[]>(() => {
    const base: ColDef<MetadataRow>[] = [
      {
        field: "parameter",
        headerName: "Parameter",
        pinned: "left",
        width: 420,
        suppressMovable: true,
        editable: false,
        cellClass: "first-column",
        headerClass: "first-column-header",
      },
    ];

    const formulationCols: ColDef<MetadataRow>[] = formulationKeys.map((k) => {
      const { cellClass, headerClass } = formulationColumnClasses(k, formulationTypes);
      return {
        colId: k,
        headerName: k,
        field: k,
        hide: shouldHidePremixColumn(k, formulationTypes, showPremixColumns),
        cellClass,
        headerClass,
        editable: (params) =>
          params.data?.parameter !== "residualMass" &&
          params.data?.parameter !== "residualVolume",
        cellDataType: false,

        valueFormatter: (p) => {
          const v = p.value;
          if (typeof v === "number" && Number.isFinite(v)) {
            return formatValue(v, displayDecimals);
          }
          return v == null ? "" : String(v);
        },

        valueSetter: (p) => {
          const field = p.colDef.field as FormulationKey | undefined;
          if (!field) return false;
          p.data[field] = p.newValue as any;
          return true;
        },
      };
    });

    return [...base, ...formulationCols];
  }, [formulationKeys, formulationTypes, showPremixColumns, displayDecimals]);

  const defaultColDef = useMemo<ColDef<MetadataRow>>(
    () => ({
      flex: 1,
      resizable: true,
      sortable: true,
      editable: true,
    }),
    []
  );

  return (
    <div style={{ width: "100%" }}>
      <div className="ag-theme-quartz" style={{ height: "100%", width: "100%" }}>
      <AgGridReact<MetadataRow>
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
          const updated: MetadataRow[] = [];
          e.api.forEachNode((n) => n.data && updated.push(n.data));
          setRowData(updated);
          commit(updated); 
        }}
      />
      </div>
    </div>
  );
}
