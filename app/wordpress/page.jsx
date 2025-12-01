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
  Link,
  Grid,
  Box,
  InlineStack,
  ProgressBar,
  Icon,
  Banner,
  Divider,
  TextField,
  FormLayout,
  List,
  EmptyState,
} from "@shopify/polaris";
import {
  ImportIcon,
  SettingsIcon,
  CalendarIcon,
  PackageIcon,
  ChartVerticalIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  ArrowUpIcon,
} from "@shopify/polaris-icons";
import { useAppContext } from "@/context/AppContext";
import { PLANS } from "@/lib/plans";
import { useState, useEffect, useRef } from "react";
import QuickSettings from "@/components/QuickSettings";
import QuickStats from "@/components/QuickStats";
import { formatDate } from "@/lib/utils";
import LastJob from "@/components/LastJob";
import Welcome from "@/components/Welcome";
import EbayButton from "@/components/EbayButton";

// --- MAIN PAGE COMPONENT ---
export default function WordpressPage() {
  const { settings, isLoading, setSettings, authedFetch } = useAppContext();
  const {
    wordpressNonce,
    wordpressToken,
    wordpressUrl
  } = settings || {};

  const [handshakeStatus, setHandshakeStatus] = useState('idle'); // idle, pending, success, error
  const [handshakeError, setHandshakeError] = useState(null);
  const [handshakeData, setHandshakeData] = useState(null);

  const doHandshake = () => {
    if (wordpressUrl && wordpressToken) {
      setHandshakeStatus('pending');
      setHandshakeError(null);

      // The endpoint for our Shopify app handshake in the WP plugin
      const endpoint = `${wordpressUrl}/wp-json/esyncify/v1/connect/verify`;
      alert(endpoint) // why does this endpoint get converted to https?

      // We use the browser's fetch since this is a cross-origin request to WordPress,
      // not an internal API route.
      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // The token from the plugin acts as a Bearer token
          'Authorization': `Bearer ${wordpressToken}`,
        },
        // We send the nonce to be verified by the plugin
        body: JSON.stringify({ nonce: wordpressNonce }),
      })
        .then(async (response) => {
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'An unknown error occurred.' }));
            throw new Error(errorData.message || `Request failed with status ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          // If successful, the plugin might send back data like site name, etc.
          setHandshakeData(data);
          setHandshakeStatus('success');

          // It might also send back a new token/nonce for future requests, which we can save.
          if (data.token) {
            authedFetch("/api/settings/", {
              method: "PATCH",
              body: JSON.stringify({ wordpressToken: data.token })
            }).then(r => r.json()).then(newSettings => {
              setSettings(newSettings);
            });
          }
        })
        .catch(error => {
          console.error("WordPress Handshake failed:", error);
          setHandshakeError(error.message);
          setHandshakeStatus('error');
        });
    }
  };

  const renderStatus = () => {
    switch (handshakeStatus) {
      case 'pending':
        return <InlineStack gap="200" blockAlign="center"><Spinner size="small" /><Text>Connecting...</Text></InlineStack>;
      case 'success':
        return <Badge tone="success">Connected</Badge>;
      case 'error':
        return <Badge tone="critical">Connection Failed</Badge>;
      default:
        return <Badge>Not Verified</Badge>;
    }
  };

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
    <Page title="WordPress Connection">
      <Layout>
        <Layout.Section>
          {!wordpressUrl ? (
            <Card padding="400">
              <EmptyState
                heading="Connect to your WordPress site"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Install the eSyncify companion plugin on your WordPress site to get started.</p>
              </EmptyState>
            </Card>
          ) : (
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd">Connection Details</Text>
                  <div style={{ border: '1px solid var(--p-color-border)', borderRadius: 'var(--p-border-radius-2)' }}>
                    <Box padding="400">
                      <InlineStack align="space-between" blockAlign="center" wrap={false}>
                        <Text>WordPress URL</Text>
                        <Link url={wordpressUrl} target="_blank" removeUnderline>{wordpressUrl}</Link>
                      </InlineStack>
                    </Box>
                    <div style={{ borderTop: '1px solid var(--p-color-border)' }}>
                      <Box padding="400">
                        <InlineStack align="space-between" blockAlign="center">
                          <Text>Status</Text>
                          {renderStatus()}
                        </InlineStack>
                      </Box>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    onClick={doHandshake}
                    loading={handshakeStatus === 'pending'}
                    disabled={handshakeStatus === 'pending'}
                    fullWidth
                  >
                    Verify Connection
                  </Button>
                </BlockStack>
              </Card>

              {handshakeStatus === 'success' && (
                <Banner title="Connection Successful!" tone="success" onDismiss={() => setHandshakeStatus('idle')}>
                  <p>
                    Successfully connected to <strong>{handshakeData?.site_name || 'your WordPress site'}</strong>.
                  </p>
                </Banner>
              )}
              {handshakeStatus === 'error' && (
                <Banner title="Connection Failed" tone="critical" onDismiss={() => setHandshakeStatus('idle')}>
                  <BlockStack gap="200">
                    <p>
                      Could not connect to your WordPress site. Please ensure the eSyncify plugin is installed and activated.
                    </p>
                    <p><strong>Error:</strong> {handshakeError}</p>
                  </BlockStack>
                </Banner>
              )}
            </BlockStack>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
