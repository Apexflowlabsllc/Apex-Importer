// app/api/import/enqueue/route.js
import { NextResponse } from 'next/server';
import { getAuthenticatedShop } from '@/lib/shopify';
import prisma from '@/lib/prisma';
import { getPaginatedEbayItems } from '@/lib/ebay';
import { PLANS } from '@/lib/plans';
import ShopifyProductUpsert from '@/lib/upsert';

export async function POST(req) {
  try {
    let products = [] // get the products out of the uploaded file

    const shopRecord = await getAuthenticatedShop(req);
    if (!shopRecord || !shopRecord.domain) {
      return NextResponse.json({ error: 'Authentication failed.' }, { status: 401 });
    }

    const options = {} // tbd

    // 3. Get shop settings from DB
    const shopSettings = await prisma.shop.findUnique({
      where: { domain: shopRecord.domain },
    });

    if (!shopSettings || !shopSettings.ebaySellerUsername) {
      return NextResponse.json({ error: 'Shop is not configured for import.' }, { status: 400 });
    }

    // 4. Set defaults and create job data. This makes the job record authoritative.
    const jobOptions = {
      ...options,
      syncStrategy: options.syncStrategy || 'ALL',
      sortOrder: options.sortOrder || '-creationDate',
    };

    const newJob = await prisma.job.create({
      data: {
        shopDomain: shopRecord.domain,
        status: 'QUEUED',
        total: shopSettings.numEbayProducts || 0,
        options: JSON.stringify(jobOptions),
      },
    });

    // add an import for each record with status "PENDING"

    return NextResponse.json({ success: true, job: newJob });




  } catch (error) {
    console.error('[ENQUEUE] Failed to enqueue job:', error);
    return NextResponse.json({ error: 'An unexpected error occurred while enqueueing the job.' }, { status: 500 });
  }
}
