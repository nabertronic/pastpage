import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/global.css";
import { PopupApp } from "../../src/components/PopupApp";
import { loadAndApplyStoredTheme } from "../../src/components/useAppliedTheme";

async function bootstrap() {
  const initialSettings = await loadAndApplyStoredTheme();

  createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <PopupApp initialSettings={initialSettings} />
    </React.StrictMode>
  );
}

void bootstrap();
