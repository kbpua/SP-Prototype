import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource-variable/inter";
import "./index.css";
import App from "./App";
import { ReviewProvider } from "./state/ReviewContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ReviewProvider>
        <App />
      </ReviewProvider>
    </BrowserRouter>
  </StrictMode>,
);
