import { useRef, useCallback, useMemo } from "react";
import type { GridApi, GridReadyEvent } from "ag-grid-community";

type GridSlot = "metadata" | "formula" | "composition";

export type AlignedGridBinding = {
  alignedGrids: () => GridApi[];
  onGridReady: (event: GridReadyEvent) => void;
};

export function useAlignedFormulationGrids() {
  const metadataApi = useRef<GridApi | null>(null);
  const formulaApi = useRef<GridApi | null>(null);
  const compositionApi = useRef<GridApi | null>(null);

  const getOtherApis = useCallback((exclude: GridSlot): GridApi[] => {
    const apis: GridApi[] = [];
    if (exclude !== "metadata" && metadataApi.current && !metadataApi.current.isDestroyed()) {
      apis.push(metadataApi.current);
    }
    if (exclude !== "formula" && formulaApi.current && !formulaApi.current.isDestroyed()) {
      apis.push(formulaApi.current);
    }
    if (
      exclude !== "composition" &&
      compositionApi.current &&
      !compositionApi.current.isDestroyed()
    ) {
      apis.push(compositionApi.current);
    }
    return apis;
  }, []);

  const metadataBinding = useMemo<AlignedGridBinding>(
    () => ({
      alignedGrids: () => getOtherApis("metadata"),
      onGridReady: (event) => {
        metadataApi.current = event.api;
      },
    }),
    [getOtherApis]
  );

  const formulaBinding = useMemo<AlignedGridBinding>(
    () => ({
      alignedGrids: () => getOtherApis("formula"),
      onGridReady: (event) => {
        formulaApi.current = event.api;
      },
    }),
    [getOtherApis]
  );

  const compositionBinding = useMemo<AlignedGridBinding>(
    () => ({
      alignedGrids: () => getOtherApis("composition"),
      onGridReady: (event) => {
        compositionApi.current = event.api;
      },
    }),
    [getOtherApis]
  );

  return {
    metadataBinding,
    formulaBinding,
    compositionBinding,
  };
}
