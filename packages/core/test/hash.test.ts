import { describe, expect, test } from "bun:test";
import { contentHash } from "../src/index";
import { sha256 } from "../src/util/hash";

const bytes = (text: string) => new TextEncoder().encode(text);

describe("sha256", () => {
  // Test vectors from FIPS 180-4 and the NIST examples.
  test.each([
    ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    [
      "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    ],
    [
      "a".repeat(1_000_000),
      "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0",
    ],
  ])("matches the known hash of %#", (input, expected) => {
    expect(sha256(bytes(input))).toBe(expected);
  });

  test("matches the runtime for every length around a block edge", () => {
    for (let length = 50; length <= 130; length++) {
      const data = bytes("x".repeat(length));
      const expected = new Bun.CryptoHasher("sha256")
        .update(data)
        .digest("hex");
      expect(sha256(data)).toBe(expected);
    }
  });
});

describe("contentHash", () => {
  test("is the same for the same text", () => {
    expect(contentHash("# Inbox\n")).toBe(contentHash("# Inbox\n"));
  });

  test.each([
    ["# Inbox", "# Inbox\n"],
    ["a\nb", "a\r\nb"],
    ["", " "],
    ["Заметка", "Заметкa"],
    ["📝", "📄"],
  ])("differs between %p and %p", (a, b) => {
    expect(contentHash(a)).not.toBe(contentHash(b));
  });
});
