// app/api/settings/route.js

import { NextResponse } from "next/server";
import shopify, { getAuthenticatedShop } from "@/lib/shopify";
import prisma from "@/lib/prisma";
import categories from '@/lib/categories.js';
import * as cheerio from 'cheerio';
import { getEbayToken, getTotalsForUsername } from "@/lib/ebay.js";

export async function POST(req) {
  try {
    const shop = await getAuthenticatedShop(req);
    const body = await req.json();
    let ebaySellerUsername = body.ebaySellerUsername.trim()

    if (ebaySellerUsername === undefined) {
      return new NextResponse(JSON.stringify({ error: 'Missing ebaySellerUsername' }), { status: 400 });
    }

    const { categoryIds: userCategories, totalFound: nResults, sampleItem } = await getTotalsForUsername(ebaySellerUsername)

    if(nResults){
      const updatedSettings = await prisma.shop.update({
        where: { id: shop.id },
        data: {
          ebaySellerUsername,
          sampleProduct: sampleItem ? JSON.stringify(sampleItem) : null,
          numEbayProducts: nResults,
          categories: userCategories.join(','),
        }
      })

      return NextResponse.json({ success: true, settings: updatedSettings });
    } else {
      return NextResponse.json({
        success: false,
        error: "Could not validate seller. Either the username is incorrect, or they have no items listed in supported primary categories.",
      }, { status: 400 });
    }

  } catch (error) {
    console.error('An error occurred at POST /api/settings:', error.message);
    const status = error.message.includes('Unauthorized') ? 401 : 500;
    return new NextResponse(
      JSON.stringify({ error: error.message }),
      { status }
    );
  }
}


// const shop = await prisma.shop.findFirst({
//   where: { domain: 'quickstart-4ef5affe.myshopify.com' },
// })
// debugger

