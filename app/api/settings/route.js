// app/api/settings/route.js

import { NextResponse } from "next/server";
import shopify, { getAuthenticatedShop } from "@/lib/shopify";
import prisma from "@/lib/prisma";
import sessionHandler from "@/lib/sessionHandler";

const RequestedTokenType = {
  OnlineAccessToken: "urn:shopify:params:oauth:token-type:online-access-token",
  OfflineAccessToken: "urn:shopify:params:oauth:token-type:offline-access-token"
}

// This function handles GET requests to /api/settings
export async function GET(req) {
  console.log("--> GET /api/settings request received");
  let shop = {}
  try {
    shop = await getAuthenticatedShop(req);
  } catch (e) {
    console.log('oops we do not have any shop yet')
    const params = new URLSearchParams(req.headers.get('referer'))
    const shopParam = params.get('shop')
    const idToken = params.get('id_token')
    let ok = await doTokenExchange(shopParam, idToken)
    if (ok) {
      shop = await prisma.shop.findUnique({
        where: { domain: shopParam },
        include: {
          sessions: true
        }
      })
    }
  }

  if (shop && shop.domain) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentImports = await prisma.import.findMany({
      where: {
        shopDomain: shop.domain,
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const groupedByDay = recentImports.reduce((acc, activity) => {
      const date = activity.createdAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { date, successCount: 0, failedCount: 0 };
      }
      if (activity.status === 'SUCCESS') {
        acc[date].successCount++;
      } else {
        // Assuming any status other than SUCCESS is a failure
        acc[date].failedCount++;
      }
      return acc;
    }, {});

    const recentActivity = Object.values(groupedByDay)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5); // Take the 5 most recent days with activity

    shop.recentActivity = recentActivity;

    const pendingJob = await prisma.job.findFirst({
      where: {
        shopDomain: shop.domain,
        status: { in: ['QUEUED', 'RUNNING'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    shop.pendingJob = pendingJob;

    const lastJob = await prisma.job.findFirst({
      where: {
        shopDomain: shop.domain,
        // We now include 'CANCELLED' status here, so that when a user cancels a job,
        // it correctly appears in their "Last Import" history view on the dashboard.
        status: { in: ['COMPLETED', 'FAILED', 'CANCELLED'] },
      },
      include: {
        // imports: {
        //   select: {
        //     createdAt: true,
        //     status: true,
        //     error: true,
        //     shopifyProductId: true,
        //   },
        //   orderBy: {
        //     createdAt: 'desc',
        //   },
        //   take: 50,
        // }
      },
      orderBy: { createdAt: 'desc' },
    });
    shop.lastJob = lastJob;

  } else {
    shop.recentActivity = [];
    shop.pendingJob = null;
    shop.lastJob = null;
  }

  // reset the quota here
  if (shop && shop.domain && shop.quotaResetDate && new Date(shop.quotaResetDate) < new Date()) {
    const newResetDate = new Date();
    newResetDate.setMonth(newResetDate.getMonth() + 1);

    const updatedShopData = {
      productsSyncedThisMonth: 0,
      quotaResetDate: newResetDate,
    };

    await prisma.shop.update({
      where: { domain: shop.domain },
      data: updatedShopData,
    });

    shop.productsSyncedThisMonth = updatedShopData.productsSyncedThisMonth;
    shop.quotaResetDate = updatedShopData.quotaResetDate;
  }

  return NextResponse.json(shop);
}

async function doTokenExchange(shop, idToken) {
  const { session: offlineSession } = await shopify.auth.tokenExchange({
    sessionToken: idToken,
    shop,
    requestedTokenType: RequestedTokenType.OfflineAccessToken,
  }).catch(e => {
    //  `Failed to parse session token 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczpcL1wvcXVpY2tzdGFydC00ZWY1YWZmZS5teXNob3BpZnkuY29tXC9hZG1pbiIsImRlc3QiOiJodHRwczpcL1wvcXVpY2tzdGFydC00ZWY1YWZmZS5teXNob3BpZnkuY29tIiwiYXVkIjoiMzA1YjNhMTc5YjljNjFiZDcxYjBiMGVmNGQzN2JmZGQiLCJzdWIiOiI4NDY5MjIwNTc3NiIsImV4cCI6MTc2NDU1NjE1NSwibmJmIjoxNzY0NTU2MDk1LCJpYXQiOjE3NjQ1NTYwOTUsImp0aSI6IjFlNGM4ODFmLTVlNTEtNDdkOC1hZDdiLTk0MGQwYTMzMjg4OSIsInNpZCI6IjNhZjdmNTA5LTdlNzMtNDk0My05NzMxLTYwYzcwYTQ1NWEzYSIsInNpZyI6IjA2ZWY0ZDNhZGUzZGJiNzcyMTZmZGI4YjBkOGY5MjRhMWY1ZjFjMzUwODYwZmQwODU4MzZjNTc0Mjg2MDRmNTAifQ.HhU42QaK0B0vURvdgLvwcFnAd_LpA5g0V5_KJWXss7Y': "exp" claim timestamp check failed`
    debugger
  });

  const { session: onlineSession } = await shopify.auth.tokenExchange({
    sessionToken: idToken,
    shop,
    requestedTokenType: RequestedTokenType.OnlineAccessToken,
  }).catch(e => {
    debugger
  });

  await sessionHandler.storeSession(offlineSession);

  let newShop = await sessionHandler.storeSession(onlineSession);

  return newShop
}

export async function PATCH(req) {
  let shop

  try {
    // Authenticate the request and get the shop domain
    shop = await getAuthenticatedShop(req);
    let data = await req.json()

    const updatedSettings = await prisma.shop.update({
      where: { domain: shop.domain },
      data
    });

    return NextResponse.json(updatedSettings);
  } catch (error) {
    console.error("An error occurred at POST /api/settings:", error);
    return new NextResponse(
      JSON.stringify({ error: "An unexpected error occurred." }), { status: 500 }
    );
  }
}

