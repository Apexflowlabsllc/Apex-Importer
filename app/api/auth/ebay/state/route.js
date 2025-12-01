// app/api/auth/ebay/state/route.js
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { getAuthenticatedShop } from '@/lib/shopify';

export async function POST(req) { // Use POST for an action that creates something
  const shop = await getAuthenticatedShop(req);


  // 1. Generate a secure, random state parameter.
  const state = crypto.randomBytes(24).toString('hex');

  // 2. Save this state to the database, associated with the current shop.
  await prisma.shop.update({
    where: { domain: shop.domain },
    data: { ebayOAuthState: state },
  });

  // 3. Construct the authorization URL with the state parameter.

  const scopes = [
    'https://api.ebay.com/oauth/api_scope/commerce.identity.readonly',
    'https://api.ebay.com/oauth/api_scope/sell.inventory',
    'https://api.ebay.com/oauth/api_scope/sell.account',
    'https://api.ebay.com/oauth/api_scope/sell.marketing',
    'https://api.ebay.com/oauth/api_scope/sell.fulfillment'
  ];

  // Join them into a single, space-delimited string.
  const scopeString = scopes.join(' ');

  const params = new URLSearchParams();
  params.append('client_id', process.env.EBAY_API_ID);
  params.append('response_type', 'code');
  params.append('redirect_uri', 'Pinky_Guardiari-PinkyGua-Replac-udwylnade');
  params.append('scope', scopeString);
  params.append('state', state);








  // The .toString() method of URLSearchParams often encodes spaces as '+'.
  // We will replace them with '%20' to be compliant with the OAuth spec.
  const queryString = params.toString().replace(/\+/g, '%20');

  const authorizationUrl = `https://auth${process.env.NODE_ENV === 'production' ? '' : '.sandbox'}.ebay.com/oauth2/authorize?${queryString}`;

  console.log("Generated eBay Auth URL:", authorizationUrl);

  // 4. Return the URL to the frontend.
  return NextResponse.json({ authorizationUrl });
}