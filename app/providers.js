// app/providers.js

"use client";

import { AppProvider as PolarisProvider } from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";
import translations from "@shopify/polaris/locales/en.json";
// 👈 REMOVE: import { Provider as AppBridgeProvider } from "@shopify/app-bridge-react";
import { AppContextProvider } from "@/context/AppContext";
// 👈 REMOVE: import { useState, useEffect } from 'react';

export function Providers({ children }) {
  // We can DELETE all of the old logic that was here:
  // - The useState calls for shop and host
  // - The useEffect to parse window.location.search
  // - The "if (!shop || !host)" check
  // - The appBridgeConfig object

  return (
    <PolarisProvider i18n={translations}>
      {/* The <AppBridgeProvider> component is completely removed */}
      <AppContextProvider>
        {children}
      </AppContextProvider>
    </PolarisProvider>
  );
}