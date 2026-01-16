import React from "react";
import ReactDOM from "react-dom/client";
import "@/assets/styles/index.css";
import "focus-visible";
import App from "@/App";
import { HelmetProvider } from "react-helmet-async";
import { DarkModeProvider } from "@/components/ModeToggle";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <DarkModeProvider>
          <HelmetProvider>
            <App />
          </HelmetProvider>
        </DarkModeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
