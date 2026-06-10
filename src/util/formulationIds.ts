export type FormulationKey = `F-${string}`;

export function nextFormulationId(existingIds: Iterable<string>): FormulationKey {
  let max = 0;
  for (const id of existingIds) {
    const match = /^F-(\d+)$/.exec(id);
    if (match) {
      max = Math.max(max, Number.parseInt(match[1], 10));
    }
  }
  return `F-${String(max + 1).padStart(4, "0")}` as FormulationKey;
}
