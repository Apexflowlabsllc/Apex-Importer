import { useState, useEffect } from "react";
import {
  Grid,
  Card,
  BlockStack,
  Text,
  FormLayout,
  TextField,
  Button,
  Banner,
  Box,
} from "@shopify/polaris";
import { useAppContext } from "@/context/AppContext";

export default function QuickSettings({inModal}) {
  const [username, setUsername] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { settings, setSettings, authedFetch } = useAppContext()

  const [errorBanner, setErrorBanner] = useState(null);



  // Sync the local form state with the global context when it finishes loading.
  useEffect(() => {
    if (settings) {
      setUsername(settings.ebaySellerUsername || "");
    }
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await authedFetch("/api/user/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ebaySellerUsername: username }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setErrorBanner(errorData.error || errorData.message || "Failed to save settings.");
        return;
      } else {
        setErrorBanner(null)
        const { settings: updatedSettings } = await response.json();
        // Update the GLOBAL state. This will cause all components to re-render with the new data.
        setSettings(updatedSettings);
      }

    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return inModal ? (
    <BlockStack gap="400">
          <BlockStack gap="200">
            {/* <Text variant="headingMd">Quick Settings</Text> */}
            <Text variant="headingMd">Update your eBay username</Text>
          </BlockStack>
          <FormLayout>
            <TextField
              label="eBay Seller Username"
              labelHidden
              value={username}
              onChange={setUsername}
              autoComplete="off"
              disabled={isSaving}
            />
            <Button
              fullWidth
              onClick={handleSave}
              loading={isSaving}
              disabled={!username || isSaving || username === settings?.ebaySellerUsername}
            >
              Update Username
            </Button>
          </FormLayout>
        </BlockStack>
  ) : (
    <Grid.Cell columnSpan={{ xs: 6, md: 6, lg: 6 }}>
      {errorBanner && (
        <Box paddingBlockEnd="400">
          <Banner
            title="An error occurred"
            tone="critical"
            onDismiss={() => setErrorBanner(null)}
          >
            <p>{errorBanner}</p>
          </Banner>
        </Box>
      )}
      <Card>
        <BlockStack gap="400">
          <BlockStack gap="200">
            <Text variant="headingMd">Quick Settings</Text>
            <Text tone="subdued">Update your eBay username</Text>
          </BlockStack>
          <FormLayout>
            <TextField
              label="eBay Seller Username"
              labelHidden
              value={username}
              onChange={setUsername}
              autoComplete="off"
              disabled={isSaving}
            />
            <Button
              fullWidth
              onClick={handleSave}
              loading={isSaving}
              disabled={!username || isSaving || username === settings?.ebaySellerUsername}
            >
              Update Username
            </Button>
          </FormLayout>
        </BlockStack>
      </Card>
    </Grid.Cell>
  );
}
