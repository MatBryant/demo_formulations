import { useMemo, useState } from "react";
import type Reagent from "../classes/Reagent";

export type PremixOption = {
  id: string;
  name: string;
};

export type IngredientPickerItem = {
  id: string;
  name: string;
  typeLabel: string;
  kind: "premix" | "reagent";
};

interface ReagentPickerModalProps {
  reagents: Reagent[];
  premixes?: PremixOption[];
  excludeIds?: string[];
  onSelect: (item: IngredientPickerItem) => void;
  onClose: () => void;
}

function toReagentItem(reagent: Reagent): IngredientPickerItem {
  return {
    id: reagent.id,
    name: reagent.name,
    typeLabel: "reagent",
    kind: "reagent",
  };
}

function toPremixItem(premix: PremixOption): IngredientPickerItem {
  return {
    id: premix.id,
    name: premix.name,
    typeLabel: "pre-mix",
    kind: "premix",
  };
}

export default function ReagentPickerModal({
  reagents,
  premixes = [],
  excludeIds = [],
  onSelect,
  onClose,
}: ReagentPickerModalProps) {
  const [query, setQuery] = useState("");

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);

  const items = useMemo(() => {
    const sortByName = (a: IngredientPickerItem, b: IngredientPickerItem) =>
      a.name.localeCompare(b.name, undefined, { numeric: true });

    const premixItems = premixes
      .filter((p) => !excluded.has(p.id))
      .map(toPremixItem)
      .sort(sortByName);
    const reagentItems = reagents
      .filter((r) => !excluded.has(r.id))
      .map(toReagentItem)
      .sort(sortByName);

    return [...premixItems, ...reagentItems];
  }, [premixes, reagents, excluded]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.id.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.typeLabel.toLowerCase().includes(q) ||
        (item.kind === "reagent" &&
          reagents
            .find((r) => r.id === item.id)
            ?.alias.toLowerCase()
            .includes(q))
    );
  }, [items, query, reagents]);

  return (
    <div
      className="picker-modal-overlay"
      onClick={onClose}
    >
      <div className="picker-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="picker-modal-header">
          <h2 style={{ margin: 0, fontSize: 18 }}>Select ingredient</h2>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div style={{ padding: "12px 20px" }}>
          <input
            type="search"
            placeholder="Search by id, name, or type…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="picker-modal-search"
          />
        </div>

        <div className="picker-modal-columns">
          <span>Id</span>
          <span>Ingredient</span>
          <span>Type</span>
        </div>

        <ul className="picker-modal-list">
          {filtered.length === 0 ? (
            <li className="picker-modal-empty">No ingredients match your search.</li>
          ) : (
            filtered.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <button
                  type="button"
                  className="picker-modal-row"
                  onClick={() => onSelect(item)}
                >
                  <span
                    className={
                      item.kind === "premix"
                        ? "picker-cell-premix"
                        : "picker-cell-reagent"
                    }
                  >
                    {item.id}
                  </span>
                  <span
                    className={
                      item.kind === "premix"
                        ? "picker-cell-premix"
                        : "picker-cell-reagent"
                    }
                  >
                    {item.name}
                  </span>
                  <span
                    className={
                      item.kind === "premix"
                        ? "picker-cell-premix"
                        : "picker-cell-reagent"
                    }
                  >
                    {item.typeLabel}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
