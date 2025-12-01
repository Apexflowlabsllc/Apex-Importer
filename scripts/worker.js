import 'dotenv/config';
import prisma from '../lib/prisma.js';
import shopify from '../lib/shopify.js';

// 👇 THIS LINE SILENCES THE DEPRECATION LOGS
// We know we are using old fields (inventory_qty), we accept it.
shopify.config.logger.level = 0; // 0 = Error only (hides Warnings and Info)

const BATCH_SIZE = 5;
const POLL_INTERVAL = 5000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const log = (jobId, msg, type = 'INFO') => {
  const timestamp = new Date().toISOString();
  const idStr = jobId ? `[Job: ${jobId}]` : '[System]';
  // Manually log to console since we silenced the library
  console.log(`${timestamp} ${type.padEnd(5)} ${idStr} ${msg}`);
};

async function processJob(job) {
  try {
    if (job.status === 'QUEUED') {
      log(job.id, 'Starting job processing...', 'START');
      await prisma.job.update({ where: { id: job.id }, data: { status: 'PROCESSING' } });
    }

    const sessionId = shopify.session.getOfflineId(job.shopDomain);
    const session = await shopify.config.sessionStorage.loadSession(sessionId);

    if (!session) {
      log(job.id, `ERROR: Could not find offline session`, 'ERROR');
      await prisma.job.update({ where: { id: job.id }, data: { status: 'FAILED', error: 'Missing session' } });
      return;
    }

    const client = new shopify.clients.Rest({ session });

    const items = await prisma.import.findMany({
      where: { jobId: job.id, status: 'PENDING' },
      take: BATCH_SIZE
    });

    if (items.length === 0) {
      log(job.id, 'No pending items. Job COMPLETED.', 'DONE');
      await prisma.job.update({ where: { id: job.id }, data: { status: 'COMPLETED' } });
      return;
    }

    for (const record of items) {
      try {
        // Sanitize Payload
        let payload = JSON.parse(JSON.stringify(record.productData));

        // 1. Clean up "Published" (Use status instead)
        delete payload.published;
        delete payload.published_scope;
        if (!payload.status) payload.status = 'active';

        // 2. Handle Inventory (The Simple Way)
        // We force "shopify" tracking so the quantity actually sticks
        if (payload.variants) {
          payload.variants = payload.variants.map(v => {
            if (v.inventory_qty && !v.inventory_management) {
              v.inventory_management = 'shopify';
            }
            return v;
          });
        }

        // 3. Send Request
        // Note: This WILL technically trigger a warning internally at Shopify,
        // but because we set logger.level = 0, your terminal won't get spammed.
        const response = await client.post({
          path: 'products',
          data: { product: payload },
          type: 'application/json',
        });

        const newProductId = response.body.product.id;

        // Success
        await prisma.import.update({
          where: { id: record.id },
          data: { status: 'SUCCESS', shopifyProductId: `${newProductId}`, error: null }
        });

        await prisma.job.update({
          where: { id: job.id },
          data: { processed: { increment: 1 }, succeeded: { increment: 1 } }
        });

        log(job.id, `✔ Imported "${payload.title}"`, 'OK');

      } catch (err) {
        const errorBody = err.response?.body?.errors || err.response?.body || err.message;
        log(job.id, `✘ Failed: ${JSON.stringify(errorBody)}`, 'FAIL');

        await prisma.import.update({
          where: { id: record.id },
          data: { status: 'FAILED', error: JSON.stringify(errorBody) }
        });

        await prisma.job.update({
          where: { id: job.id },
          data: { processed: { increment: 1 }, failed: { increment: 1 } }
        });
      }
      await sleep(250);
    }
  } catch (error) {
    log(job.id, `Worker Error: ${error.message}`, 'FATAL');
  }
}

async function run() {
  log(null, 'Worker started...');
  while (true) {
    try {
      const job = await prisma.job.findFirst({
        where: { status: { in: ['QUEUED', 'PROCESSING'] } },
        orderBy: { createdAt: 'asc' }
      });

      if (job) {
        await processJob(job);
      } else {
        await sleep(POLL_INTERVAL);
      }
    } catch (error) {
      log(null, `Loop Error: ${error.message}`, 'FATAL');
      await sleep(POLL_INTERVAL);
    }
  }
}

run();