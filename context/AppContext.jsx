"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { getSessionToken } from "@shopify/app-bridge-utils";
import { Toast } from "@shopify/app-bridge/actions";
import { Modal, Text } from "@shopify/polaris";
import { getAppBridge } from "@/lib/app-bridge-instance";

const AppContext = createContext(undefined);

export function AppContextProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Job State Management
  const [pending, setPending] = useState(null);
  const [lastJob, setLastJob] = useState(null);
  // 'imports' can hold the list of imports for the current or last job
  const [imports, setImports] = useState(null);

  const appBridge = getAppBridge();

  // --- UI Helpers (Modal & Toast) ---
  const [modal, setModal] = useState({
    isOpen: false,
    title: "",
    content: null,
    primaryAction: null,
    secondaryActions: [],
  });

  const showModal = useCallback((config) => {
    setModal({ ...config, isOpen: true });
  }, []);

  const hideModal = useCallback(() => {
    setModal((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const showToast = useCallback((content, options = {}) => {
    const toastOptions = {
      message: content,
      duration: 3000,
      ...options,
    };
    const toastNotice = Toast.create(appBridge, toastOptions);
    toastNotice.dispatch(Toast.Action.SHOW);
  }, [appBridge]);


  // --- Authentication ---
  const authedFetch = useCallback(
    async (url, options = {}) => {
      if (!appBridge) {
        throw new Error("App Bridge instance is not available.");
      }

      const token = await getSessionToken(appBridge);
      const headers = new Headers(options.headers || {});
      headers.set("Authorization", `Bearer ${token}`);
      headers.set("Content-Type", "application/json");

      return fetch(url, { ...options, headers });
    },
    [appBridge]
  );


  // --- Effects ---

  // 1. Initial Fetch on Load
  useEffect(() => {
    if (!appBridge) return;

    const fetchInitialSettings = async () => {
      setIsLoading(true);
      try {
        const response = await authedFetch("/api/settings");
        if (response.ok) {
          setSettings(await response.json());
        } else {
          setSettings(null);
        }
      } catch (error) {
        console.error("Failed to fetch settings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialSettings();
  }, [appBridge, authedFetch]);

  // 2. Initialize state from settings (Restore session)
  useEffect(() => {
    if (!settings) return;

    if (settings.pendingJob) {
      setPending(settings.pendingJob);
    } else if (settings.lastJob) {
      setLastJob(settings.lastJob);
      if (!pending) {
        setImports(settings.lastJob.imports);
      }
    }
  }, [settings]);

  // 3. Poll for pending job status
  useEffect(() => {
    if (!pending) return;

    // Check if job reached a terminal state
    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(pending.status)) {
      setLastJob(pending);
      setPending(null); // Stop polling

      // Optionally fetch the final list of imports here if needed
      // fetchImports(pending.id);
      return;
    }

    // Poll every 2 seconds
    const intervalId = setInterval(async () => {
      try {
        const response = await authedFetch(`/api/job/${pending.id}`);
        if (response.ok) {
          const updatedJob = await response.json();
          setPending(updatedJob);
          // If you want to see imports populate live, you could also fetch imports here
        } else {
          // If 404 or error, stop polling
          clearInterval(intervalId);
        }
      } catch (error) {
        console.error('Error during polling:', error);
        clearInterval(intervalId);
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [pending, authedFetch]);


  // --- Derived State ---
  const lastSyncDate = settings?.lastJob
    ? new Date(settings.lastJob.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : "Never";

  // --- Confirm Helper ---
  const confirm = ({ message = "do this action", content = "Confirm", destructive = false, onAction = () => {} }) => {
    showModal({
      title: destructive ? "Are you sure?" : "Confirm Action",
      content: (
        <div>
          <Text as="p">Are you sure you want to {message}?</Text>
          {destructive && <Text as="p" tone="critical">This action cannot be undone.</Text>}
        </div>
      ),
      primaryAction: {
        content,
        destructive,
        onAction: () => {
          onAction();
          hideModal();
        }
      },
      secondaryActions: [{ content: "Cancel", onAction: hideModal }],
    });
  };

  const contextValue = {
    settings,
    setSettings,
    isLoading,
    authedFetch,
    // Job State
    lastJob,
    pending,
    imports,
    lastSyncDate,
    // UI Helpers
    confirm,
    showModal,
    hideModal,
    showToast,
    // Trigger to start watching a new job
    startTrackingJob: (job) => {
      setPending(job);
      setImports([]); // Reset imports view
    },
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
      <Modal
        open={modal.isOpen}
        onClose={hideModal}
        title={modal.title}
        primaryAction={modal.primaryAction}
        secondaryActions={modal.secondaryActions}
      >
        <Modal.Section>{modal.content}</Modal.Section>
      </Modal>
    </AppContext.Provider>
  );
}

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppContextProvider");
  }
  return context;
};