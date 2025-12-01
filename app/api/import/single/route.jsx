import prisma from '@/lib/prisma';
import shopify, { getAuthenticatedShop } from '@/lib/shopify';
import ShopifyProductUpsert from '@/lib/upsert';
import { NextResponse } from 'next/server';

export async function POST(req) {
  let shop
  let importRecord;

  try {
    const body = await req.json();
    shop = await getAuthenticatedShop(req);

    const offlineSession = shop.sessions.find(s => !s.isOnline)

    if (!offlineSession || !offlineSession.accessToken) {
      throw new Error('Offline access token not found. Cannot perform background tasks.');
    }

    const { accessToken } = offlineSession;
    const { item, options } = body;

    if (!item || !options) {
      return NextResponse.json({ error: 'Missing item or options' }, { status: 400 });
    }

    const upserter = new ShopifyProductUpsert({ shop, accessToken });
    const result = await upserter.upsertProduct(item, options);

    // Update job progress if this is part of a job
    if (options.jobId) {
      const job = await prisma.job.update({
        where: { id: options.jobId },
        data: {
          processed: { increment: 1 },
          succeeded: { increment: result.success ? 1 : 0 },
          failed: { increment: result.success ? 0 : 1 },
        }
      });

      // If all items are processed, mark the job as completed
      if (job.processed >= job.total) {
        await prisma.job.update({ where: { id: options.jobId }, data: { status: 'COMPLETED' } });
      }
    }


    if (result.success) {
      // Increment monthly quota usage for the shop
      await prisma.shop.update({
        where: { domain: shop.domain },
        data: { productsSyncedThisMonth: { increment: 1 } }
      });

      // Create a success record for this import
      importRecord = await prisma.import.create({
        data: {
          shopDomain: shop.domain,
          jobId: options.jobId || null,
          shopifyProductId: String(result.data.id),
          title: result.data.title,
          sku: result.data.variants?.[0]?.sku || 'N/A',
          status: 'SUCCESS',
          action: result.action,
        },
      });

      return NextResponse.json({ success: true, ...importRecord });

    } else {
      // Create a failure record for this import
      importRecord = await prisma.import.create({
        data: {
          shopDomain: shop.domain,
          jobId: options.jobId || null,
          title: item.title,
          sku: item.legacyItemId || item.epid || 'N/A',
          status: 'FAILED',
          action: 'failed',
          error: result.error,
        },
      });

      return NextResponse.json({ error: result.error || 'Failed to upsert product.', success: false, ...importRecord }, { status: 500 });
    }

  } catch (error) {
    console.error('[SINGLE_IMPORT] Failed:', error);
    // If an unexpected error occurs, try to fail the job gracefully if it's part of one.
    try {
      const { options } = await req.json();
      if (options.jobId) {
        await prisma.job.update({
          where: { id: options.jobId },
          data: { status: 'FAILED', error: 'A critical error occurred during the import process.' }
        });
      }
    } catch (e) {
      // Ignore errors from trying to fail the job
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
