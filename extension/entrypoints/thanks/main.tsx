import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/global.css";
import { ThanksApp } from "../../src/components/ThanksApp";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThanksApp />
  </React.StrictMode>
);
