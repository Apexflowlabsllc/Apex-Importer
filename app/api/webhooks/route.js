// app/api/webhooks/route.js

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyShopifyWebhook } from '@/lib/utils';

export async function POST(req) {
  try {
    const rawBody = await req.text();
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256');

    // 1. Use the utility function for verification
    if (!verifyShopifyWebhook(rawBody, hmacHeader)) {
      console.warn('Webhook verification failed.');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. If verified, proceed with the logic
    const topic = req.headers.get('x-shopify-topic');
    const domain = req.headers.get('x-shopify-shop-domain');
    const body = JSON.parse(rawBody);

    console.log(`✅ Webhook received: Topic: ${topic}, Shop: ${domain}`);

    // Received unhandled webhook topic: app/uninstalled

    switch (topic) {
      case 'customers/data_request':
      case 'customers/redact':
        console.log(`Acknowledged ${topic} for shop ${domain}. No PII is stored.`);
        break;

      case 'shop/redact':
        console.log(`Received shop redact request for ${domain}. Deleting all associated data.`);
        try {
          await prisma.$transaction([
            // 👇 Fixed a silent bug here: Sessions are linked via shopDomain
            prisma.import.deleteMany({ where: { shopDomain: domain } }),
            prisma.job.deleteMany({ where: { shopDomain: domain } }),
            prisma.session.deleteMany({ where: { shopDomain: domain } }), // <-- FIX
            prisma.shop.deleteMany({ where: { domain: domain } }),
          ]);
          console.log(`✅ Successfully redacted data for shop ${domain}.`);
        } catch (error) {
          console.error(`❌ Failed to redact data for shop ${domain}:`, error);
        }
        break;

      // 👇 ADDED a case for this topic so it's no longer "unhandled"
      case 'app/uninstalled':
        console.log(`App uninstalled for shop ${domain}.`);
        break;

      default:
        console.log(`❌ Received unhandled webhook topic: ${topic}`);
        break;
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('❌ An unexpected error occurred in the webhook handler:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}