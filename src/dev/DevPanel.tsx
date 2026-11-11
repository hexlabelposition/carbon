import { useState } from "react";
import { ReadBench } from "./bench/ReadBench";
import { SqlBench } from "./bench/SqlBench";

type Theme = "system" | "dark" | "light";

const SURFACES = [
  "bg-backdrop",
  "bg-bg",
  "bg-panel",
  "bg-raise",
  "bg-selected",
  "bg-code",
];
const TEXTS = ["text-fg", "text-muted", "text-faint", "text-link"];

/**
 * Development tools, mounted by the shell in dev builds only: the M0
 * measurements, and a preview of the design tokens and Markdown styles. The preview goes away with C-116, when the editor shows
 * the same styles on real notes.
 */
function DevPanel() {
  const [theme, setTheme] = useState<Theme>("system");

  function apply(next: Theme) {
    setTheme(next);
    if (next === "system")
      document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", next);
  }

  return (
    <div className="mx-auto flex max-w-180 flex-col gap-10 px-8 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <span className="font-semibold">Carbon design tokens</span>
        <div
          className="inline-flex rounded-md border border-line-strong bg-panel p-0.5"
          role="group"
          aria-label="Theme"
        >
          {(["system", "dark", "light"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={theme === t}
              onClick={() => apply(t)}
              className={`h-6.5 rounded-sm px-3 capitalize ${
                theme === t
                  ? "bg-solid font-medium text-on-solid"
                  : "text-muted hover:text-fg"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      <ReadBench />

      <SqlBench />

      <section className="flex flex-col gap-3">
        <h2 className="text-label font-semibold tracking-[0.06em] text-faint uppercase">
          Surfaces
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SURFACES.map((c) => (
            <div
              key={c}
              className={`${c} rounded-md border border-line px-3 py-4 font-mono text-small`}
            >
              {c}
            </div>
          ))}
        </div>
        <h2 className="mt-3 text-label font-semibold tracking-[0.06em] text-faint uppercase">
          Text
        </h2>
        <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-md border border-line bg-panel px-3 py-4 font-mono text-small">
          {TEXTS.map((c) => (
            <span key={c} className={c}>
              {c}
            </span>
          ))}
        </div>
      </section>

      <article className="markdown">
        <h1>Performance budgets</h1>
        <dl className="frontmatter">
          <dt>tags</dt>
          <dd>
            <span className="tag">area/carbon</span>
            <span className="tag">performance</span>
          </dd>
          <dt>aliases</dt>
          <dd>Budgets</dd>
        </dl>
        <p>
          Carbon is fast by design. Every budget here is checked with
          benchmarks, and the reasoning lives in{" "}
          <a className="wikilink" href="#">
            Architecture notes
          </a>
          . A link to a note that does not exist yet looks like{" "}
          <a className="wikilink unresolved" href="#">
            Benchmark log
          </a>
          , and a search match looks like <mark>this</mark>.
        </p>
        <h2>Budgets</h2>
        <ul>
          <li>
            App start to interactive, index already built:{" "}
            <strong>under 1 s</strong>
          </li>
          <li>
            Quick switcher response: <strong>under 16 ms</strong>
          </li>
          <li>
            Heavy work stays off the UI thread, parsing runs in a{" "}
            <em>Web Worker</em>
          </li>
        </ul>
        <blockquote>
          Files are the source of truth. The index is only a cache and can be
          rebuilt at any time.
        </blockquote>
        <h2>Next steps</h2>
        <ul className="tasks">
          <li className="done">
            <input
              type="checkbox"
              defaultChecked
              aria-label="Generate a test vault with 10k notes"
            />
            Generate a test vault with 10k notes
          </li>
          <li>
            <input type="checkbox" aria-label="Measure reading 10k files" />
            <span>
              Measure reading 10k files through the <code>fs</code> plugin
            </span>
          </li>
        </ul>
        <h3>Measuring search</h3>
        <pre>
          <code>
            <span className="tok-comment">{"// ts\n"}</span>
            <span className="tok-keyword">const</span>
            {" vault = "}
            <span className="tok-keyword">await</span>
            {" Vault.open(path, platform);\n"}
            <span className="tok-keyword">const</span>
            {" hits = "}
            <span className="tok-keyword">await</span>
            {" vault.search.query("}
            <span className="tok-string">"index"</span>
            {");"}
          </code>
        </pre>
        <hr />
        <table>
          <thead>
            <tr>
              <th>Budget</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>App start to interactive</td>
              <td>under 1 s</td>
            </tr>
            <tr>
              <td>Quick switcher response</td>
              <td>under 16 ms</td>
            </tr>
          </tbody>
        </table>
      </article>
    </div>
  );
}

export default DevPanel;
