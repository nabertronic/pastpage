import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/global.css";
import { OptionsApp } from "../../src/components/OptionsApp";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>
);
