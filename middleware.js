// middleware.js

import { NextResponse } from 'next/server';
import shopify from '@/lib/shopify';
import prisma from '@/lib/prisma'; // Prisma can now be used here.

// 👇 THIS IS THE KEY CHANGE
// Force this middleware to run on the Node.js runtime instead of the Edge.
export const runtime = 'nodejs';

export async function middleware(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new NextResponse(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const session = await shopify.session.decodeSessionToken(token);
    const shopDomain = session.dest.replace('https://', '');

    if (!shopDomain) {
      return new NextResponse(JSON.stringify({ error: 'Invalid session token' }), { status: 401 });
    }

    // --- Database Logic is now possible here ---
    const shopData = await prisma.shop.findUnique({
      where: { domain: shopDomain },
      include: {
        sessions: true,

      },
    });

    const requestHeaders = new Headers(request.headers);

    if (shopData) {
      requestHeaders.set('X-Shop-Domain', shopDomain);
      requestHeaders.set('X-Shop-Plan', shopData.plan);

    }

    // --- Forward the enriched request ---
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

  } catch (error) {
    console.error('Middleware Error:', error);
    return new NextResponse(JSON.stringify({ error: 'Authentication failed.' }), { status: 401 });
  }
}

// Your config remains the same
export const config = {
  matcher: ['/api/((?!webhooks|.*callback|billing\/confirm).*)'],
};