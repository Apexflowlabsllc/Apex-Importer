"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { Providers } from "./providers";

export default function RootLayout({ children }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true); // ensures client picks up only after hydration
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {ready && (
          <Script
            id="shopify-app-bridge"
            src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
            strategy="beforeInteractive"
            type="text/javascript"
          />
        )}
      </head>
      <body suppressHydrationWarning>
        <div id="app">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
