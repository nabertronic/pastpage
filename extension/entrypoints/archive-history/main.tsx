import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/global.css";
import { HistoryApp } from "../../src/components/HistoryApp";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HistoryApp />
  </React.StrictMode>
);
