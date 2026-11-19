/**
 * A small client of the W3C WebDriver protocol, enough to drive Carbon
 * through `tauri-driver`: find elements, click, type, run a script, wait.
 */

const ELEMENT = "element-6066-11e4-a52e-4f735466cecf";

/** Keys of the WebDriver protocol that are not characters. */
export const Key = {
  Enter: "",
  Escape: "",
  Backspace: "",
  Shift: "",
  Control: "",
  Alt: "",
} as const;

type Json = Record<string, unknown>;

async function call(
  url: string,
  method: "GET" | "POST" | "DELETE",
  body?: Json,
): Promise<unknown> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json()) as {
    value: { error?: string; message?: string } | unknown;
  };
  const value = data.value as { error?: string; message?: string } | null;
  if (!response.ok || (value !== null && typeof value?.error === "string")) {
    throw new Error(
      `WebDriver ${method} ${url}: ${value?.error ?? response.status} ${
        value?.message ?? ""
      }`,
    );
  }
  return data.value;
}

/** An element of the page, as the driver knows it. */
export class Element {
  constructor(
    private readonly session: Session,
    readonly id: string,
  ) {}

  click(): Promise<unknown> {
    return this.session.post(`/element/${this.id}/click`, {});
  }

  async text(): Promise<string> {
    return (await this.session.get(`/element/${this.id}/text`)) as string;
  }

  /** Types into the element, which takes the focus. */
  type(text: string): Promise<unknown> {
    return this.session.post(`/element/${this.id}/value`, { text });
  }
}

/** One run of the app under the driver. */
export class Session {
  private constructor(
    private readonly base: string,
    readonly id: string,
  ) {}

  /** Starts the app at `application` through the driver at `driver`. */
  static async start(driver: string, application: string): Promise<Session> {
    const value = (await call(`${driver}/session`, "POST", {
      capabilities: {
        alwaysMatch: { "tauri:options": { application } },
      },
    })) as { sessionId: string };
    return new Session(`${driver}/session/${value.sessionId}`, value.sessionId);
  }

  get(path: string): Promise<unknown> {
    return call(`${this.base}${path}`, "GET");
  }

  post(path: string, body: Json): Promise<unknown> {
    return call(`${this.base}${path}`, "POST", body);
  }

  /** Closes the app. */
  async end(): Promise<void> {
    await call(this.base, "DELETE");
  }

  /** Runs `script` in the page; `arguments` holds `args`. */
  execute<T>(script: string, ...args: unknown[]): Promise<T> {
    return this.post("/execute/sync", { script, args }) as Promise<T>;
  }

  private async findIn(using: string, value: string): Promise<Element[]> {
    const found = (await this.post("/elements", { using, value })) as Json[];
    return found.map((item) => new Element(this, item[ELEMENT] as string));
  }

  /** The elements a CSS selector finds now. */
  all(selector: string): Promise<Element[]> {
    return this.findIn("css selector", selector);
  }

  /** Waits for an element a CSS selector finds, and gives the first. */
  async find(selector: string, timeout = 10_000): Promise<Element> {
    return this.waitFor(
      async () => (await this.all(selector))[0] ?? null,
      `an element at ${selector}`,
      timeout,
    );
  }

  /** Waits for a button with exactly this text. */
  async button(text: string, timeout = 10_000): Promise<Element> {
    return this.waitFor(
      async () =>
        (
          await this.findIn(
            "xpath",
            `//button[normalize-space(.)=${JSON.stringify(text)}]`,
          )
        )[0] ?? null,
      `a button "${text}"`,
      timeout,
    );
  }

  /**
   * Presses keys together, as Ctrl+N: every key down in order, then up.
   * Characters are typed one by one when given alone.
   */
  async press(...keys: string[]): Promise<void> {
    const down = keys.map((value) => ({ type: "keyDown", value }));
    const up = [...keys].reverse().map((value) => ({ type: "keyUp", value }));
    await this.post("/actions", {
      actions: [{ type: "key", id: "keyboard", actions: [...down, ...up] }],
    });
  }

  /** Types text into whatever has the focus. */
  async typeText(text: string): Promise<void> {
    const actions = [...text].flatMap((value) => [
      { type: "keyDown", value },
      { type: "keyUp", value },
    ]);
    await this.post("/actions", {
      actions: [{ type: "key", id: "keyboard", actions }],
    });
  }

  /** The page as a PNG. */
  async screenshot(): Promise<Uint8Array> {
    const base64 = (await this.get("/screenshot")) as string;
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  }

  /**
   * Asks `check` until it gives something other than `null` or `false`,
   * and gives that; fails after `timeout` milliseconds.
   */
  async waitFor<T>(
    check: () => Promise<T | null | false>,
    what: string,
    timeout = 10_000,
  ): Promise<T> {
    const until = Date.now() + timeout;
    let last: unknown = null;
    for (;;) {
      try {
        const result = await check();
        if (result !== null && result !== false) return result;
      } catch (error) {
        last = error;
      }
      if (Date.now() > until) {
        throw new Error(
          `Waited ${timeout} ms for ${what}${last ? `: ${String(last)}` : ""}`,
        );
      }
      await Bun.sleep(100);
    }
  }
}
