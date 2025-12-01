// app/settings/page.jsx

"use client";

import {
  Page,
  Card,
  FormLayout,
  TextField,
  Banner,
  Spinner,
  Button,
  Layout,
  BlockStack,
} from "@shopify/polaris";
import { useState, useEffect } from "react";
import { useAppContext } from "@/context/AppContext";

export default function SettingsPage() {
  // Get global state and the authenticated fetch function from our context.
  const { settings: initialSettings, isLoading, setSettings, authedFetch } = useAppContext();

  // Local state for the form input field.
  const [username, setUsername] = useState("");
  // Local state for the save action.
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Sync the local form state with the global context when it finishes loading.
  useEffect(() => {
    if (initialSettings) {
      setUsername(initialSettings.ebaySellerUsername || "");
    }
  }, [initialSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      const response = await authedFetch("/api/user/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ebaySellerUsername: username }),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings.");
      }

      const { settings: updatedSettings } = await response.json();
      // Update the GLOBAL state. This will cause all components to re-render with the new data.
      setSettings(updatedSettings);
      setSaveSuccess(true);
    } catch (error) {
      console.error(error);
      setSaveError(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // The page uses the global loading state from the context.
  if (isLoading) {
    return (
      <Page>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <Spinner accessibilityLabel="Loading settings" size="large" />
        </div>
      </Page>
    );
  }

  return (
    <Page title="Settings">
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {saveSuccess && (
              <Banner title="Settings saved successfully" tone="success" onDismiss={() => setSaveSuccess(false)} />
            )}
            {saveError && (
              <Banner title="Failed to save settings" tone="critical" onDismiss={() => setSaveError(null)}>
                <p>{saveError}</p>
              </Banner>
            )}
            <Card>
              <FormLayout>
                <TextField
                  label="eBay Seller Username"
                  value={username}
                  onChange={setUsername}
                  autoComplete="off"
                  helpText="Enter the eBay username you want to import listings from."
                  disabled={isSaving}
                />
                <Button variant="primary" onClick={handleSave} loading={isSaving} disabled={!username || isSaving}>
                  Save Settings
                </Button>
              </FormLayout>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

