"use client";

import { useState, useCallback } from "react";
import Papa from "papaparse"; // 👈 Ensure this is imported
import {
  Page, Card, Text, BlockStack, Banner, Spinner, InlineStack, Thumbnail, Button, TextField, Grid, Select, DropZone, Icon,
} from "@shopify/polaris";
import { NoteIcon, UploadIcon } from "@shopify/polaris-icons";
import { useAppContext } from "@/context/AppContext";
import { useRouter } from "next/navigation";

export default function ImportPage() {
  const { authedFetch, startTrackingJob, showToast, isLoading: isContextLoading } = useAppContext();
  const router = useRouter();

  // State
  const [file, setFile] = useState(null);
  const [products, setProducts] = useState([]);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState(null);
  const [isImporting, setImporting] = useState(null)

  // Import Options
  const [options, setOptions] = useState({
    status: 'active',
    defaultVendor: 'Custom Import',
    appendTags: 'imported',
    productType: '',
  });

  const handleOptionChange = (key, value) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  };

  // --- FILE HANDLING ---
  const handleDrop = useCallback(
    async (_droppedFiles, acceptedFiles, _rejectedFiles) => {
      setError(null);
      const selectedFile = acceptedFiles[0];
      if (!selectedFile) return;

      setFile(selectedFile);
      setIsParsing(true);

      // 1. Handle JSON
      if (selectedFile.name.endsWith('.json')) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const json = JSON.parse(e.target.result);
            const items = Array.isArray(json) ? json : [json];
            setProducts(items);
            showToast(`Loaded ${items.length} products`);
          } catch (err) {
            setError("Invalid JSON.");
          } finally {
            setIsParsing(false);
          }
        };
        reader.readAsText(selectedFile);
        return;
      }

      // 2. Handle CSV (Using Papa Parse)
      // 👇 This handles quoted strings and commas correctly!
      if (selectedFile.name.endsWith('.csv')) {
        Papa.parse(selectedFile, {
          header: true, // This keeps keys raw: "Title", "Body (HTML)"
          skipEmptyLines: true,
          complete: (results) => {
            const items = results.data;
            if (items.length === 0) {
              setError("CSV is empty.");
            } else {
              setProducts(items);
              showToast(`Loaded ${items.length} rows`);
            }
            setIsParsing(false);
          },
          error: (err) => {
            setError("CSV Parse Error: " + err.message);
            setIsParsing(false);
          }
        });
        return;
      }
    },
    [showToast]
  );

  const handleBeginImport = async () => {
    if (products.length === 0) return;

    try {
      setImporting(true)
      const response = await authedFetch("/api/import/create-job", {
        method: "POST",
        body: JSON.stringify({ count: products.length, options, items: products })
      });

      if (!response.ok) throw new Error("Could not initialize job");
      const { job } = await response.json();

      // Trigger background worker
      fetch(`/api/cron?key=${process.env.NEXT_PUBLIC_CRON_KEY || 'changethis-to-something-secure'}`)
        .catch(() => {});

      startTrackingJob(job);
      window.location.hash = "home"
    } catch (e) {
      setError(e.message);
    }
  };

  const resetUpload = () => {
    setFile(null);
    setProducts([]);
    setError(null);
  };

  if (isContextLoading) return <Spinner />;

  // --- PREVIEW ---
  const previewItem = products[0];

  // Helper to find key regardless of casing
  const findVal = (keys) => {
    if (!previewItem) return null;
    for (const k of keys) {
      // Check exact match first, then lowercase match
      if (previewItem[k]) return previewItem[k];
      const match = Object.keys(previewItem).find(pk => pk.toLowerCase() === k.toLowerCase());
      if (match) return previewItem[match];
    }
    return null;
  };

  const pTitle = findVal(['Title', 'title', 'Handle']);
  const pPrice = findVal(['Variant Price', 'price', 'Price']);
  const pDesc = findVal(['Body (HTML)', 'body_html', 'description']);
  const pImg = findVal(['Image Src', 'Image', 'src']);

  return (
    <Page title="Import Products" backAction={{
        content: "Dashboard",
        url: "#home"
      }}>
      <BlockStack gap="500">
        {error && <Banner tone="critical" onDismiss={() => setError(null)}><p>{error}</p></Banner>}

        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd">1. Upload Data</Text>
            {!file ? (
              <DropZone accept=".json, .csv" type="file" onDrop={handleDrop} allowMultiple={false}>
                <DropZone.FileUpload actionHint="Accepts .csv or .json" />
              </DropZone>
            ) : (
              <Banner tone="success">
                <InlineStack align="space-between"><Text>Loaded {products.length} rows</Text>
                <Button onClick={resetUpload}>Change</Button></InlineStack>
              </Banner>
            )}
            {isParsing && <Spinner size="small" />}
          </BlockStack>
        </Card>

        {previewItem && (
          <>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd">2. Preview</Text>
                <InlineStack gap="400" blockAlign="start">
                  <Thumbnail source={pImg || NoteIcon} />
                  <BlockStack>
                    <Text variant="headingSm">{pTitle}</Text>
                    <Text>${pPrice}</Text>
                    <Text tone="subdued" truncate>{pDesc}</Text>
                  </BlockStack>
                </InlineStack>

                {/* SETTINGS INPUTS */}
                <Grid>
                  <Grid.Cell columnSpan={{ md: 6 }}>
                    <Select label="Status" options={['active', 'draft', 'archived']} value={options.status} onChange={v => handleOptionChange('status', v)} />
                  </Grid.Cell>
                  <Grid.Cell columnSpan={{ md: 6 }}>
                    <TextField label="Default Vendor" value={options.defaultVendor} onChange={v => handleOptionChange('defaultVendor', v)} autoComplete="off" />
                  </Grid.Cell>
                </Grid>
              </BlockStack>
            </Card>

            {isImporting ? <div style={{ position: 'sticky', bottom: '20px', zIndex: 10 }}>
    <Card background="bg-surface-secondary">
      <div style={{ padding: '10px 0' }}>
        <InlineStack align="center" blockAlign="center" gap="400">
          <Spinner size="small" accessibilityLabel="Processing import" />
          <Text variant="bodyLg" fontWeight="medium">
            Please wait while your import is processed...
          </Text>
        </InlineStack>
      </div>
    </Card>
  </div> : <div style={{ position: 'sticky', bottom: '20px', zIndex: 10 }}>
              <Card background="bg-surface-secondary">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd">Start Import</Text>
                  <Button disabled={isImporting} variant="primary" size="large" icon={UploadIcon} onClick={handleBeginImport}>Import Products</Button>
                </InlineStack>
              </Card>
            </div>}


          </>
        )}
      </BlockStack>
    </Page>
  );
}