import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { insideTauri } from "./platform/runtime";
import { BrowserNotice } from "./shells/browser/BrowserNotice";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {/* In a plain web browser the app cannot start: it says so instead. */}
    {insideTauri() ? <App /> : <BrowserNotice />}
  </React.StrictMode>,
);
