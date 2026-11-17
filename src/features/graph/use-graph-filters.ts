import { useCallback, useEffect, useState } from "react";
import { DEFAULT_FILTERS, type GraphFilters } from "./use-graph-data";

const KEY = "carbon.graph.filters";

/**
 * The filters of the graph of the vault (C-506), remembered between app
 * starts. `change` takes the filters to change; the rest stay.
 */
export function useGraphFilters(): {
  filters: GraphFilters;
  change(patch: Partial<GraphFilters>): void;
} {
  const [filters, setFilters] = useState(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(filters));
    } catch {
      // Without storage the filters work, they are only forgotten.
    }
  }, [filters]);
  const change = useCallback(
    (patch: Partial<GraphFilters>) =>
      setFilters((old) => ({ ...old, ...patch })),
    [],
  );
  return { filters, change };
}

function load(): GraphFilters {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (typeof saved !== "object" || saved === null) return DEFAULT_FILTERS;
    const { tag, orphans, missing } = saved as Partial<GraphFilters>;
    return {
      tag: typeof tag === "string" ? tag : DEFAULT_FILTERS.tag,
      orphans: typeof orphans === "boolean" ? orphans : DEFAULT_FILTERS.orphans,
      missing: typeof missing === "boolean" ? missing : DEFAULT_FILTERS.missing,
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}
