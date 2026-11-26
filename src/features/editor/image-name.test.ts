import { describe, expect, test } from "bun:test";
import { imageName } from "./web-images";

describe("imageName", () => {
  test("a file of the vault by its file name", () => {
    expect(imageName("attachments/photo.png")).toBe("photo.png");
  });

  test("a web image by its file name, or by its site without one", () => {
    expect(imageName("https://example.com/a/My%20cat.jpg?w=200")).toBe(
      "My cat.jpg",
    );
    expect(
      imageName("https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9&s=10"),
    ).toBe("encrypted-tbn0.gstatic.com");
    expect(imageName("//cdn.example.org/img")).toBe("cdn.example.org");
  });
});
