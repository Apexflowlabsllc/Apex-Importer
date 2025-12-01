// components/AppLayout.jsx

"use client";

import { Frame, Navigation } from "@shopify/polaris";
import { HomeIcon, ImportIcon, SettingsIcon } from "@shopify/polaris-icons";
import { useHashNavigation } from "@/hooks/useHashNavigation"; // Import our new hook

export function AppLayout({ children }) {
  // Get the current hash from our custom hook
  const { currentHash } = useHashNavigation();

  const navLinks = [
    { label: "Home", url: "#home", icon: HomeIcon, view: "home" },
    { label: "Import", url: "#import", icon: ImportIcon, view: "import" },
    { label: "Settings", url: "#settings", icon: SettingsIcon, view: "settings" },
  ];

  const navigationMarkup = (
    <Navigation location="/"> {/* Location is now static */}
      <Navigation.Section
        items={navLinks.map((link) => ({
          ...link,
          // The selected item is now based on our `currentHash` state
          selected: currentHash === link.view,
        }))}
      />
    </Navigation>
  );

  return <Frame navigation={navigationMarkup}>{children}</Frame>;
}