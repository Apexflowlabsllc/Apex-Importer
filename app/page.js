// app/page.js

"use client";

import { useHashNavigation } from "@/hooks/useHashNavigation";
import { useAppContext } from "@/context/AppContext";
import { Page, Spinner } from "@shopify/polaris";
import { useSearchParams } from 'next/navigation';

// Import the different "view" components
import HomePage from "./home/page";
import SettingsPage from "./settings/page";
import ImportPage from "./import/page";
import { useEffect } from "react";
import WordpressPage from "./wordpress/page";

// This is our main SPA router component
export default function AppRouter() {
  const { currentHash } = useHashNavigation();
  const { isLoading: isContextLoading, settings, setSettings, authedFetch } = useAppContext();

  const searchParams = useSearchParams();

  let domain = settings?.domain
  useEffect(() => {
    // Check if the 'wp_url' query parameter exists in THIS iframe's URL.
    // Shopify automatically forwards it from the parent URL.
    if (domain && searchParams.has('wp_url')) {
      // If it exists, set the hash of this iframe's window.

      let token = searchParams.get('token')
      let wp_url = searchParams.get('wp_url')

      fetch(`${wp_url}/wp-json/esyncify/v1/connect/verify?token=${token}&shopify_shop=${settings.domain}`)
        .then(r => r.json())
        .then(data => {
          if (data?.success) {
            showToast("Successfully connected to WooCommerce")
            authedFetch("/api/settings/", {
              method: "PATCH",
              body: JSON.stringify({
                wordpressToken: data.api_key,
                wordpressUrl: wp_url
              })
            }).then(r => r.json()).then(newSettings => {
              setSettings(newSettings)
              window.location.hash = 'wordpress';
            })
          } else {
            showToast("There was an error connecting WooCommerce")
          }
        })


    }
    // We run this effect whenever searchParams change, though it's most important on the initial load.
  }, [domain, searchParams]);

  // A helper function to select which component to render
  const renderView = () => {
    switch (currentHash) {
      case "settings":
        return <SettingsPage />;
      case "import":
        return <ImportPage />;
      case "wordpress":
        // You can now render a specific component for this view
        return <WordpressPage />;
      case "home":
      default:
        return <HomePage />;
    }
  };

  return <>
    {renderView()}
  </>;
}