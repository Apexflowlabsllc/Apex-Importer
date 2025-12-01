// app/api/auth/ebay/callback/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const receivedState = searchParams.get('state');

  if (!receivedState) {
    return NextResponse.json({ error: 'State parameter missing.' }, { status: 400 });
  }

  try {
    // 1. Find the shop that has this state value. This is the key step.
    const shop = await prisma.shop.findUnique({
      where: { ebayOAuthState: receivedState },
    });

    if (!shop) {
      throw new Error('Invalid state parameter. No matching shop found. CSRF attack suspected.');
    }

    // 2. Clear the state from the database immediately to prevent reuse.
    await prisma.shop.update({
      where: { id: shop.id },
      data: { ebayOAuthState: null },
    });

    // 3. Proceed with token exchange...
    const { accessToken, refreshToken, expiresIn } = await exchangeCodeForTokens(code);
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    await prisma.shop.update({
      where: { id: shop.id },
      data: {
        ebayAccessToken: accessToken,
        ebayRefreshToken: refreshToken,
        ebayTokenExpiresAt: expiresAt,
      },
    });

    const { userId, username, accountType, registrationMarketplaceId } = await getEbayUsername(accessToken);

    // 4. Update the correct shop record.
    await prisma.shop.update({
      where: { id: shop.id },
      data: {
        ebayUserId: userId,
        ebaySellerUsername: username,
        ebayAccountType: accountType,
        ebayMarketplaceId: registrationMarketplaceId,
      },
    });

    console.log(`Successfully connected eBay user '${username}' to shop '${shop.domain}'`);

    // Redirect back to the Shopify admin app

    const redirectUrl = `https://admin.shopify.com/store/${shop.domain}/apps/${process.env.APP_SLUG}?message=${encodeURI('Your shop has been set up successfully!')}`
    return NextResponse.redirect(redirectUrl);

  } catch (error) {
    console.error('Error during eBay OAuth callback:', error);
    return NextResponse.json({ error: 'An error occurred while connecting to eBay.' }, { status: 500 });
  }
}

async function exchangeCodeForTokens(code) {
  const { EBAY_API_ID, EBAY_API_SECRET, EBAY_REDIRECT_URI } = process.env;
  const tokenUrl = `https://api${process.env.NODE_ENV === 'production' ? '' : '.sandbox'}.ebay.com/identity/v1/oauth2/token`;
  const basicAuth = Buffer.from(`${EBAY_API_ID}:${EBAY_API_SECRET}`).toString('base64');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: EBAY_REDIRECT_URI,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to exchange code for token: ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

async function getEbayUsername(accessToken) {
  const userUrl = `https://apiz${process.env.NODE_ENV === 'production' ? '' : '.sandbox'}.ebay.com/commerce/identity/v1/user/`;
  const response = await fetch(userUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to fetch eBay user: ${JSON.stringify(errorData)}`);
  }

  const userData = await response.json();
  return userData;
}