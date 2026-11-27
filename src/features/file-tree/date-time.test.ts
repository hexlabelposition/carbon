import { expect, test } from "bun:test";
import { dateTime } from "./date-time";

test("a time is written in digits, the date year first", () => {
  expect(dateTime(new Date(2026, 10, 20, 14, 5).getTime())).toBe(
    "2026-11-20 14:05",
  );
  expect(dateTime(new Date(2026, 0, 5, 9, 0).getTime())).toBe(
    "2026-01-05 09:00",
  );
});
