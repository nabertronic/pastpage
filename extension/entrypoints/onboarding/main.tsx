import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/global.css";
import { OnboardingApp } from "../../src/components/OnboardingApp";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <OnboardingApp />
  </React.StrictMode>
);
