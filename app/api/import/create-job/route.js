import { NextResponse } from 'next/server';
import { getAuthenticatedShop } from '@/lib/shopify';
import prisma from '@/lib/prisma';

// Helper to group flat CSV rows into Shopify Product structure
function groupRowsByHandle(rows, options={}) {
  const groups = {};

  rows.forEach((row) => {
    // 1. Normalize keys
    // Handle -> handle, Body (HTML) -> bodyhtml, Image Src -> imagesrc
    const cleanRow = {};
    Object.keys(row).forEach(key => {
      if (!key) return; // skip null keys
      cleanRow[key.toLowerCase().replace(/[^a-z0-9]/g, '')] = row[key];
    });

    const handle = cleanRow['handle'];
    if (!handle) return;

    // 2. Initialize Product (Run this logic for the first occurrence of the handle)
    if (!groups[handle]) {
      groups[handle] = {
        title: cleanRow['title'] || row['Title'],
        // Map 'bodyhtml' (normalized from 'Body (HTML)')
        body_html: cleanRow['bodyhtml'] || row['Body (HTML)'],
        vendor: cleanRow['vendor'] || row['Vendor'],
        // Map 'type' (normalized from 'Type')
        product_type: cleanRow['type'] || row['Type'],
        tags: cleanRow['tags'] || row['Tags'],
        // Map 'published' (boolean)
        status: options.status || 'active',
        // Map 'giftcard' (boolean)
        gift_card: (cleanRow['giftcard'] || row['Gift Card'] || 'false').toString().toLowerCase() === 'true',
        variants: [],
        images: [],
        options: []
      };
    }

    const product = groups[handle];

    // 3. Extract Variant Data
    // We look for 'option1value' or 'variantprice' to decide if this row has variant info
    const opt1Val = cleanRow['option1value'] || row['Option1 Value'];
    const hasVariantData = opt1Val || cleanRow['variantprice'] || row['Variant Price'];

    if (hasVariantData) {
      // Determine if we should add this variant.
      // If it's the very first row and it's a simple product, we still add it as a variant.
      // If the product already has variants, we only add if this row is unique (simple dedupe based on SKU + Options)

      const variant = {
        price: cleanRow['variantprice'] || row['Variant Price'],
        compare_at_price: cleanRow['variantcompareatprice'] || row['Variant Compare At Price'],
        sku: cleanRow['variantsku'] || row['Variant SKU'],
        grams: cleanRow['variantgrams'] || row['Variant Grams'],
        inventory_management: cleanRow['variantinventorytracker'] || row['Variant Inventory Tracker'] || 'shopify',

        inventory_qty: cleanRow['variantinventoryqty'] || row['Variant Inventory Qty'],
        inventory_policy: cleanRow['variantinventorypolicy'] || row['Variant Inventory Policy'] || 'deny',
        fulfillment_service: cleanRow['variantfulfillmentservice'] || row['Variant Fulfillment Service'] || 'manual',
        requires_shipping: (cleanRow['variantrequiresshipping'] || 'true').toLowerCase() === 'true',
        taxable: (cleanRow['varianttaxable'] || 'true').toLowerCase() === 'true',
        barcode: cleanRow['variantbarcode'] || row['Variant Barcode'],
        // Options
        option1: cleanRow['option1value'] || row['Option1 Value'],
        option2: cleanRow['option2value'] || row['Option2 Value'],
        option3: cleanRow['option3value'] || row['Option3 Value'],
        // Variant Specific Image (This is different from the Gallery Images below)
        // Note: For creating products, Shopify matches this by URL to the product.images array
        image: cleanRow['variantimage'] || row['Variant Image'] || null
      };

      // Simple deduplication: Check if a variant with these exact options already exists
      const exists = product.variants.some(v =>
        v.option1 === variant.option1 &&
        v.option2 === variant.option2 &&
        v.option3 === variant.option3
      );

      if (!exists) {
        product.variants.push(variant);
      }

      // Capture Option Names (One time setup)
      if (product.options.length === 0) {
        const opt1Name = cleanRow['option1name'] || row['Option1 Name'];
        const opt2Name = cleanRow['option2name'] || row['Option2 Name'];
        const opt3Name = cleanRow['option3name'] || row['Option3 Name'];

        if (opt1Name && opt1Name !== 'Title') product.options.push({ name: opt1Name });
        if (opt2Name) product.options.push({ name: opt2Name });
        if (opt3Name) product.options.push({ name: opt3Name });
      }
    }

    // 4. Extract Image Data (Gallery)
    // Normalized key for 'Image Src' is 'imagesrc'
    const imgSrc = cleanRow['imagesrc'] || row['Image Src'];

    if (imgSrc) {
      // Check for duplicates in the image array
      const imageExists = product.images.some(img => img.src === imgSrc);
      if (!imageExists) {
        product.images.push({
          src: imgSrc,
          alt: cleanRow['imagealttext'] || row['Image Alt Text'],
          // Convert position to integer if present
          position: parseInt(cleanRow['imageposition'] || row['Image Position'] || '0') || undefined
        });
      }
    }
  });

  return Object.values(groups);
}

export async function POST(req) {
  try {
    const shopRecord = await getAuthenticatedShop(req);
    if (!shopRecord || !shopRecord.domain) {
      return NextResponse.json({ error: 'Authentication failed.' }, { status: 401 });
    }

    // 1. Parse Request
    // We expect 'items' to be the raw array of CSV rows/JSON objects
    const { count, options, items } = await req.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided for import.' }, { status: 400 });
    }

    // 2. Group items by Handle
    const groupedProducts = groupRowsByHandle(items);

    // 3. Create Job Record
    const newJob = await prisma.job.create({
      data: {
        shopDomain: shopRecord.domain,
        status: 'QUEUED', // Or 'RUNNING' since we process inline immediately after
        total: groupedProducts.length,
        options: JSON.stringify(options),
      },
    });

    // 4. Create Import Records for each Grouped Product
    // We map the grouped products to the database schema
    const importRecordsData = groupedProducts.map(product => ({
      shopDomain: shopRecord.domain,
      jobId: newJob.id,
      status: 'PENDING',
      productData: product, // Store the full grouped JSON here
    }));

    // Use createMany for efficiency
    await prisma.import.createMany({
      data: importRecordsData,
    });

    // 5. Fetch back the imports so we have their IDs (createMany doesn't return them)
    // This allows the frontend to update specific import rows if needed
    const createdImports = await prisma.import.findMany({
      where: { jobId: newJob.id },
      select: { id: true, productData: true, status: true }
    });

    return NextResponse.json({
      success: true,
      job: newJob,
      imports: createdImports,
      count: groupedProducts.length
    });

  } catch (error) {
    console.error('[CREATE-JOB] Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}