import type { Groups } from "./node-style";

/**
 * The groups with a color, each with its swatch, name and count, and the
 * notes of the rest. Pointing at a group highlights its notes, so a
 * group is told by more than its color.
 */
export function GraphLegend({
  groups,
  onHover,
  other,
  label,
}: {
  groups: Groups;
  onHover(slot: number | null): void;
  /** The name of the rest. */
  other: string;
  label: string;
}) {
  return (
    <ul
      aria-label={label}
      className="absolute bottom-3 left-3 flex flex-col gap-0.5 rounded-md border border-line bg-panel px-2 py-1 text-small"
    >
      {groups.legend.map((group) => (
        <li
          key={group.slot}
          className="flex cursor-default items-center gap-1.5 text-muted hover:text-fg"
          onPointerEnter={() => onHover(group.slot)}
          onPointerLeave={() => onHover(null)}
        >
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-full"
            style={{ background: `var(--cb-group-${group.slot + 1})` }}
          />
          <span className="max-w-40 truncate">{group.name}</span>
          <span className="text-faint">{group.count}</span>
        </li>
      ))}
      {groups.others > 0 && (
        <li className="flex items-center gap-1.5 text-faint">
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-full bg-faint"
          />
          <span>{other}</span>
          <span>{groups.others}</span>
        </li>
      )}
    </ul>
  );
}
