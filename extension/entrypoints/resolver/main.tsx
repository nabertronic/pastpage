import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/global.css";
import { ResolverApp } from "../../src/components/ResolverApp";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ResolverApp />
  </React.StrictMode>
);
