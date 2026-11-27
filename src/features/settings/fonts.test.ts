import { describe, expect, test } from "bun:test";
import { cssFamily, familyOf, familyValue, fontValue } from "./fonts";

describe("fonts of the system in the settings", () => {
  test("a family goes into a value and back", () => {
    expect(familyOf(familyValue("Fira Sans"))).toBe("Fira Sans");
    expect(familyOf("inter")).toBeNull();
    expect(familyOf("family:")).toBeNull();
  });

  test("a stored value is a named one or a family", () => {
    const parse = fontValue(["inter", "system"]);
    expect(parse("inter")).toBe("inter");
    expect(parse("family:Iosevka") as string).toBe("family:Iosevka");
    expect(parse("comic")).toBeUndefined();
    expect(parse("family:")).toBeUndefined();
  });

  test("a family is quoted for CSS", () => {
    expect(cssFamily("Fira Sans")).toBe('"Fira Sans"');
    expect(cssFamily('Odd "Font" \\ 1')).toBe('"Odd \\"Font\\" \\\\ 1"');
  });
});
