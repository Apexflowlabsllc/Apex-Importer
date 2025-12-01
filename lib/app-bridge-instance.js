// lib/app-bridge-instance.js

import { createApp } from "@shopify/app-bridge"; // <-- Use curly braces

let appBridgeInstance = null;

export function getAppBridge() {
  if (appBridgeInstance) {
    return appBridgeInstance;
  }

  // This check is crucial for Next.js to avoid running on the server.
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const host = params.get("host");

  if (!host) {
    // Or throw an error, depending on how you want to handle it.
    console.error("Host parameter is missing from the URL.");
    return null;
  }

  const config = {
    host,
    apiKey: process.env.NEXT_PUBLIC_SHOPIFY_APP_KEY,
    forceRedirect: true,
  };

  appBridgeInstance = createApp(config);
  return appBridgeInstance;
}