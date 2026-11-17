// The graph bench on its own page, for a plain browser: the dev server
// serves it at /src/dev/graph-bench/index.html. Remove once C-502 is decided.
import { createRoot } from "react-dom/client";
import "../../styles/index.css";
import { GraphBench } from "./GraphBench";

const root = document.getElementById("root");
if (root === null) throw new Error("No #root");
createRoot(root).render(
  <div className="mx-auto max-w-240 p-8">
    <GraphBench />
  </div>,
);
