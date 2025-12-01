"use client"
// app/loading.jsx

import { Page, Spinner } from '@shopify/polaris';

// This is a simple, server-renderable component to use as a fallback.
export default function Loading() {
  return (
    <Page>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spinner accessibilityLabel="Loading app..." size="large" />
      </div>
    </Page>
  );
}
