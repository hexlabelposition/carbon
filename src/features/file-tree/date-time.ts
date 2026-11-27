/**
 * A time as the clock of this computer reads it, in digits, the date
 * year first: 2026-11-20 14:05.
 */
export function dateTime(time: number): string {
  const date = new Date(time);
  const two = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())} ` +
    `${two(date.getHours())}:${two(date.getMinutes())}`
  );
}
