// In your React/Polaris component
import { useAppContext } from '@/context/AppContext';
import { Button } from '@shopify/polaris';
import { useState } from 'react';

export default function EbayButton() {
  const { settings, authedFetch } = useAppContext()
  const [isLoading, setIsLoading] = useState(false);

  const handleConnectClick = async () => {
    setIsLoading(true);
    try {
      // 1. Call your new `/state` endpoint to get the URL.
      const response = await authedFetch('/api/auth/ebay/state', { method: 'POST' });

      if (!response.ok) { throw new Error('Failed to prepare eBay authorization.'); }

      const data = await response.json();
      const { authorizationUrl } = data;

      if (!authorizationUrl) { throw new Error('Authorization URL not found.'); }

      // 2. Redirect the user's top-level window to eBay.
      window.top.location.href = authorizationUrl;

    } catch (error) {
      console.error('Error initiating eBay connection:', error);
      setIsLoading(false);
    }
  };

  return (
    <Button primary onClick={handleConnectClick} loading={isLoading}>
      Connect eBay Account
    </Button>
  );
}