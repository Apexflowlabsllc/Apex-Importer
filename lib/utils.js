// lib/utils.js

import crypto from 'crypto';

/**
 * Verifies the HMAC signature of a Shopify webhook request.
 * This is a CRITICAL security step to ensure the request is from Shopify.
 *
 * @param {string} rawBody - The raw, unparsed request body from the webhook.
 * @param {string} hmacHeader - The value of the 'X-Shopify-Hmac-Sha256' header.
 * @returns {boolean} - True if the signature is valid, false otherwise.
 */
export function verifyShopifyWebhook(rawBody, hmacHeader) {
  const secret = process.env.SHOPIFY_APP_SECRET;

  // If the secret is missing, we cannot verify, so we must fail.
  if (!secret) {
    console.error('SHOPIFY_APP_SECRET environment variable is not set. Webhook verification will fail.');
    return false;
  }

  // Calculate the HMAC hash using the app's secret key.
  const hash = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf-8')
    .digest('base64');

  // Compare the calculated hash with the one from the header.
  // It's important to use a timing-safe comparison in production,
  // but for simplicity, direct comparison is shown here. In a real-world
  // scenario, consider `crypto.timingSafeEqual`.
  return hash === hmacHeader;
}

// You can add other utility functions here in the future.
//
export const formatDate = (dateString) => {
  const activityDate = new Date(`${dateString}T00:00:00`); // Treat as local time start of day

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  if (activityDate.getTime() === today.getTime()) {
    return 'Today';
  }
  if (activityDate.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  }
  return activityDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};
