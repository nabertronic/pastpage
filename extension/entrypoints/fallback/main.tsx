import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/global.css";
import { FallbackApp } from "../../src/components/FallbackApp";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FallbackApp />
  </React.StrictMode>
);
