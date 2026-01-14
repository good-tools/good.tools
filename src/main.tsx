import React from "react";
import ReactDOM from "react-dom/client";
import "@/assets/styles/index.css";
import "focus-visible";
import App from "@/App";
import { HelmetProvider } from "react-helmet-async";
import { DarkModeProvider } from "@/components/ModeToggle";
import { BrowserRouter } from "react-router-dom";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <BrowserRouter>
    <DarkModeProvider>
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </DarkModeProvider>
  </BrowserRouter>,
);
