import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ConvexRoot } from "./lib/convex.tsx";
import { hasConvexConfig } from "./lib/convexConfig.ts";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexRoot>
      <App backendReady={hasConvexConfig} />
    </ConvexRoot>
  </StrictMode>,
);
