/**
 * Compares names as a person reads them, as the core sorts: "Note 2"
 * before "Note 10", and case does not matter.
 */
export const byName = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});
