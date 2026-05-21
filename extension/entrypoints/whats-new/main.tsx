import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/global.css";
import { WhatsNewApp } from "../../src/components/WhatsNewApp";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WhatsNewApp />
  </React.StrictMode>
);
