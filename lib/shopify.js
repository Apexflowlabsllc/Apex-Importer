// lib/shopify.js

import { shopifyApi, LogSeverity } from "@shopify/shopify-api";
import { restResources } from "@shopify/shopify-api/rest/admin/2025-01"; // Use the API version from .env?
import "@shopify/shopify-api/adapters/node";
import sessionHandler from "./sessionHandler.js"; // our custom session handler
import prisma from "./prisma.js";

const isDev = process.env.NODE_ENV === 'development';

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_APP_KEY,
  apiSecretKey: process.env.SHOPIFY_APP_SECRET,
  scopes: process.env.SHOPIFY_APP_SCOPES?.split(',') || ["read_products", "write_products"],
  hostName: process.env.SHOPIFY_APP_URL.replace(/https:\/\//, ""),
  apiVersion: process.env.SHOPIFY_API_VERSION,
  restResources,
  sessionStorage: sessionHandler,
  isEmbeddedApp: true,
  logger: { level: isDev ? LogSeverity.Debug : LogSeverity.Info },
});

export async function getAuthenticatedShop(req) {
  const shopDomain = req.headers.get('X-Shop-Domain');
  const shop = await prisma.shop.findUnique({
    where: { domain: shopDomain },
    include: {
      sessions: true
    }
  });

  if (!shop) {
    throw new Error('Unauthorized: Shop domain missing from headers.');
  }

  return shop;
}

export default shopify;