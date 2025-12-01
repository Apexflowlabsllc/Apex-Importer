"use client";

import {
  BlockStack,
  Button,
  Card,
  Layout,
  Page,
  Text,
  Badge,
  Spinner,
  Box,
  InlineStack,
  Banner,
} from "@shopify/polaris";
import {
  ImportIcon,
} from "@shopify/polaris-icons";
import { useAppContext } from "@/context/AppContext";
import { useState, useEffect, useRef } from "react";
import LastJob from "@/components/LastJob";
import Welcome from "@/components/Welcome";

function Dashboard({ authedFetch }) {
  const {
    pending,
  } = useAppContext();

  const [isCancelling, setIsCancelling] = useState(false);
  const [showImportBanner, setShowImportBanner] = useState(false);
  const prevPendingRef = useRef();

  // --- HANDLERS ---

  const handleCancelImport = async () => {
    if (!pending || !pending.id) return;

    setIsCancelling(true);

    try {
      await authedFetch(`/api/job/${pending.id}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error("Failed to send cancel request:", error);
    } finally {
      // Reload to get fresh state (or you could optimistically update state)
      window.location.reload();
    }
  };

  // --- EFFECTS ---

  useEffect(() => {
    // Show banner only when a new job starts (pending goes from null to a job)
    if (!prevPendingRef.current && pending) {
      setShowImportBanner(true);
      window.scrollTo(0, 0);
    }
    prevPendingRef.current = pending;
  }, [pending]);

  // --- RENDER ---

  return (
    <BlockStack gap="600">

      {/* 1. Status Banner */}
      {showImportBanner && (
        <Banner
          title="Sync started"
          tone="success"
          onDismiss={() => setShowImportBanner(false)}
        >
          <p>Your products are being synced. You can see the progress below.</p>
        </Banner>
      )}

      {/* 2. Generic Welcome Message */}
      <Welcome />

      {/* 3. Main Action Card */}
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Box>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    background: 'var(--p-color-bg-fill-success-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {/* Using ImportIcon as a generic sync icon */}
                    <ImportIcon className="w-6 h-6 text-emerald-700" />
                  </div>
                </Box>
                <Badge tone={pending ? 'attention' : 'success'}>
                  {pending ? (pending.status === 'QUEUED' ? 'Queued' : 'Running') : 'Idle'}
                </Badge>
              </InlineStack>

              <BlockStack gap="200">
                <Text variant="headingMd">Product Synchronization</Text>
                <Text tone="subdued">
                  {pending
                    ? "Sync is currently in progress."
                    : "Ready to sync products to your store."}
                </Text>
              </BlockStack>

              {/* Action Buttons */}
              {pending ? (
                <Button
                  fullWidth
                  variant="primary"
                  tone="critical"
                  onClick={handleCancelImport}
                  loading={isCancelling}
                  disabled={isCancelling}
                >
                  Cancel Sync
                </Button>
              ) : (
                <Button
                  fullWidth
                  variant="primary"
                  icon={ImportIcon}
                  url="#import" // Or connect this to your start import modal/function
                >
                  Start Sync
                </Button>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {/* 4. History */}
      <LastJob />

      <Box paddingBlockEnd="600" />
    </BlockStack>
  );
}

// --- MAIN PAGE COMPONENT ---
export default function HomePage() {
  const { isLoading, authedFetch } = useAppContext();

  if (isLoading) {
    return (
      <Page>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <Spinner accessibilityLabel="Loading dashboard" size="large" />
          <Text tone="subdued">Loading...</Text>
        </div>
      </Page>
    );
  }

  return (
    <Page title="Dashboard">
      <Layout>
        <Layout.Section>
          <Dashboard authedFetch={authedFetch} />
        </Layout.Section>
      </Layout>
    </Page>
  );
}