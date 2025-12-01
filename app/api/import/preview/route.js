// app/api/settings/route.js

import { NextResponse } from "next/server";
import shopify, { getAuthenticatedShop } from "@/lib/shopify";
import prisma from "@/lib/prisma";
import categories from '@/lib/categories.js';
import * as cheerio from 'cheerio';
import { getEbayToken } from "@/lib/ebay";

export async function GET(req) {
  try {
    const shop = await getAuthenticatedShop(req);
    const { domain, categories, ebaySellerUsername } = shop;

    if (!ebaySellerUsername || !categories || categories.length === 0) {
      return NextResponse.json({
        error: "Missing eBay seller username or selected categories. Please configure them in settings.",
      }, { status: 400 });
    }

    const ebayAccessToken = await getEbayToken();
    let sampleItem, ebayData;

    for (let category_id of categories) {
      const params = new URLSearchParams({
        'category_ids': category_id,
        'fieldgroups': 'EXTENDED',
        'filter': `sellers:{${ebaySellerUsername}}`,
        'limit': 1,
        'offset': 0
      });

      const ebayApiUrl = `https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`;
      const response = await fetch(ebayApiUrl, {
        headers: {
          'Authorization': `Bearer ${ebayAccessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[IMPORT_PREVIEW] eBay API failed for shop ${domain} with status: ${response.status}`, errorBody);
        // Continue to the next category if this one fails
        continue;
      }

      ebayData = await response.json();
      sampleItem = ebayData.itemSummaries?.shift();
      if (sampleItem) break;
    }

    if (!sampleItem) {
      return NextResponse.json({
        error: "No items found on eBay for the selected categories and seller. Please check your settings or eBay listings.",
      }, { status: 404 });
    }

    if (ebayData?.warnings?.length > 0) {
      console.warn(`[IMPORT_PREVIEW] eBay API returned warnings for shop ${domain}:`, ebayData.warnings);
    }

    const responsePayload = {
      totalItems: ebayData.total || 0,
      sampleItem
    };

    return NextResponse.json(responsePayload);

  } catch (error) {
    console.error('[IMPORT_PREVIEW] An unexpected error occurred:', error);
    return NextResponse.json({ error: "An internal server error occurred." }, { status: 500 });
  }
}


// const shop = await prisma.shop.findFirst({
//   where: { domain: 'quickstart-4ef5affe.myshopify.com' },
// })
// debugger

