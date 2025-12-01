// app/api/job/[id]/route.js

import { NextResponse } from 'next/server';
import { getAuthenticatedShop } from '@/lib/shopify';
import prisma from '@/lib/prisma';

export async function GET(req, { params }) {
  params = await params
  const { id } = params;
  try {
    const shop = await getAuthenticatedShop(req);
    // const foo = await params


    const job = await prisma.job.findUnique({
      where: { id }
    });

    const imports = await prisma.import.findMany({
      where: { jobId: id }
    })

    // Security check: ensure the job belongs to the requesting shop
    if (!job || job.shopDomain !== shop.domain) {
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (error) {
    console.error(`[GET_JOB] Failed to fetch job status:`, error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

// NEW: This function handles DELETE requests to /api/job/[id]
// It is used to cancel an ongoing import job.
export async function DELETE(req, { params }) {
  params = await params
  const { id } = params;
  try {
    const shop = await getAuthenticatedShop(req);
    const job = await prisma.job.findUnique({
      where: { id }
    });

    if (!job || job.shopDomain !== shop.domain) {
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
    }

    // Business logic check:
    // We can only cancel jobs that are currently 'QUEUED' or 'RUNNING'.
    if (job.status !== 'QUEUED' && job.status !== 'RUNNING') {
      return NextResponse.json({ error: `Cannot cancel job with status '${job.status}'.` }, { status: 400 });
    }

    const cancelledJob = await prisma.job.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    const jobWithImports = await prisma.job.findUnique({
      where: { id: cancelledJob.id },
      include: {
        imports: {
          select: {
            sku: true,
            title: true,
            createdAt: true,
            status: true,
            error: true,
            shopifyProductId: true,
          },
          orderBy: {
            createdAt: 'desc', // Show the most recent imports first.
          },
          take: 50, // Limit to the last 50 imports for performance.
        }
      }
    });

    console.info(`[CANCEL_JOB] cancelled job ${id}:`);
    return NextResponse.json({ success: true, job: jobWithImports });

  } catch (error) {
    // If any unexpected error occurs, log it for debugging purposes.
    console.error(`[CANCEL_JOB] Failed to cancel job ${id}:`, error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
