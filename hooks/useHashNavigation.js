// hooks/useHashNavigation.js

"use client"; // This is a client-side hook

import { useState, useEffect, useCallback } from "react";

// This hook manages the window's URL hash
export function useHashNavigation() {
  const [hash, setHash] = useState("");

  // This effect runs once on the client to get the initial hash
  useEffect(() => {
    // We remove the '#' symbol to get the clean view name (e.g., "settings")
    const currentHash = window.location.hash.substring(1);
    setHash(currentHash || "home"); // Default to 'home' if no hash is present
  }, []);

  // This effect listens for changes to the hash (e.g., user clicks back/forward)
  useEffect(() => {
    const handleHashChange = () => {
      const newHash = window.location.hash.substring(1);
      setHash(newHash || "home");
    };

    window.addEventListener("hashchange", handleHashChange);

    // Cleanup function to remove the event listener
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  // A function our components can call to programmatically change the view
  const navigate = useCallback((newHash) => {
    window.location.hash = newHash;
  }, []);

  // The hook returns the current hash and the navigate function
  return { currentHash: hash, navigate };
}

