// lib/upsert.js - the heavy lifting for this app

class ShopifyProductUpsert {
  constructor({shop, accessToken}, logger = console) {
    this.shop = shop;
    this.accessToken = accessToken;
    this.baseUrl = `https://${shop.domain}/admin/api/2025-01`;
    this.logger = logger;

    // Default headers for all API requests
    this.headers = {
      'X-Shopify-Access-Token': this.accessToken,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Main method to upsert a product based on SKU
   * @param {Object} productPayload - Product data
   * @param {Object} options - Upsert options
   * @returns {Object} Result object with success status and data
   */
  async upsertProduct(productPayload, options = {}) {
    // Determine SKU from options and product payload
    const sku = options.skuSource === 'epin' && productPayload.epid
      ? productPayload.epid
      : productPayload.legacyItemId;

    if (!sku) {
      const errorMessage = 'SKU could not be determined for upsertProduct.';
      this.logger.error(errorMessage, { legacyItemId: productPayload.legacyItemId, epid: productPayload.epid });
      return { success: false, error: errorMessage };
    }

    // Rewrite title on the payload if options are provided
    if (options.rewriteTitles && options.rewriteFind) {
      try {
        let title = productPayload.title;
        if (options.rewriteIsRegex) {
          const regex = new RegExp(options.rewriteFind, 'g');
          title = title.replace(regex, options.rewriteReplace || '');
        } else {
          title = title.replaceAll(options.rewriteFind, options.rewriteReplace || '');
        }
        productPayload.title = title; // Mutate the payload for downstream functions
      } catch (e) {
        this.logger.warn(`Invalid regex for title rewrite: '${options.rewriteFind}'. Using original title.`);
      }
    }

    const processedOptions = {
      ...options,
      sku,
      quantity: options.defaultQuantity || 0,
      appendTags: typeof options.appendTags === 'string'
        ? options.appendTags.split(',').map(tag => tag.trim()).filter(Boolean)
        : (options.appendTags || [])
    };

    try {
      this.logger.info(`Starting upsert operation for SKU: ${sku}`);

      // Check if product exists by SKU
      const existingProduct = await this.findProductBySku(sku);

      let result;
      if (existingProduct) {
        this.logger.info(`Product found with SKU: ${sku}. Updating...`);
        result = await this.updateProduct(existingProduct.id, productPayload, processedOptions);
      } else {
        this.logger.info(`Product not found with SKU: ${sku}. Creating new product...`);
        result = await this.createProduct(productPayload, processedOptions);
      }

      this.logger.info(`Successfully ${existingProduct ? 'updated' : 'created'} product with SKU: ${sku}`);
      return { success: true, data: result, action: existingProduct ? 'updated' : 'created' };

    } catch (error) {
      this.logger.error(`Failed to upsert product with SKU: ${sku}`, error.message);
      return { success: false, error: error.message, sku };
    }
  }

  /**
   * Find existing product by SKU using GraphQL
   * @param {string} sku - Product SKU
   * @returns {Object|null} Product object containing ID, or null if not found
   */
  async findProductBySku(sku) {
    try {
      const graphqlQuery = {
        query: `
          query productVariants($query: String!) {
            productVariants(first: 1, query: $query) {
              edges {
                node {
                  product {
                    id
                  }
                }
              }
            }
          }
        `,
        variables: {
          query: `sku:${sku}`
        }
      };

      const response = await fetch(
        `${this.baseUrl}/graphql.json`,
        {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify(graphqlQuery)
        }
      ).catch(e => {
        debugger
      })

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const responseData = await response.json();

      if (responseData.errors) {
        throw new Error(`GraphQL Error: ${JSON.stringify(responseData.errors)}`);
      }

      const edges = responseData.data?.productVariants?.edges;

      if (edges && edges.length > 0) {
        const product = edges[0].node.product;
        if (product && product.id) {
          const productId = product.id.split('/').pop();
          return { id: productId };
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Error finding product by SKU: ${sku}`, error.message);
      throw error;
    }
  }

  /**
   * Create a new product
   * @param {Object} productPayload - Product data
   * @param {Object} options - Upsert options
   * @returns {Object} Created product object
   */
  async createProduct(productPayload, options) {
    const { sku, quantity = 0 } = options;
    try {
      // Transform the payload to Shopify format
      const shopifyProduct = this.transformToShopifyFormat(productPayload, options);

      // Create the product
      const productResponse = await fetch(
        `${this.baseUrl}/products.json`,
        {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({ product: shopifyProduct })
        }
      );

      if (!productResponse.ok) {
        const errorData = await productResponse.json();
        throw new Error(`HTTP ${productResponse.status}: ${JSON.stringify(errorData)}`);
      }

      const productData = await productResponse.json();
      const createdProduct = productData.product;

      // Handle image upload if provided
      if (productPayload.image && productPayload.image.imageUrl) {
        const imageUrl = productPayload.image.imageUrl;
        const imageExists = createdProduct.images?.some(img => img.src === imageUrl);

        if (!imageExists) {
          await this.uploadProductImage(createdProduct.id, imageUrl);
        } else {
          this.logger.info(`Image with URL ${imageUrl} already exists for product ${createdProduct.id}. Skipping upload.`);
        }
      }

      // Set inventory quantity if provided
      if (quantity > 0 && createdProduct.variants && createdProduct.variants.length > 0) {
        await this.updateInventoryQuantity(createdProduct.variants[0].inventory_item_id, quantity);
      }

      return createdProduct;
    } catch (error) {
      this.logger.error(`Error creating product with SKU: ${sku}`, error.message);
      throw error;
    }
  }

  /**
   * Update an existing product
   * @param {number} productId - Shopify product ID
   * @param {Object} productPayload - Product data
   * @param {Object} options - Upsert options
   * @returns {Object} Updated product object
   */
  async updateProduct(productId, productPayload, options) {
    const { sku, quantity = 0 } = options;
    try {
      // Transform the payload to Shopify format
      const shopifyProduct = this.transformToShopifyFormat(productPayload, options);

      // Update the product
      const productResponse = await fetch(
        `${this.baseUrl}/products/${productId}.json`,
        {
          method: 'PUT',
          headers: this.headers,
          body: JSON.stringify({ product: shopifyProduct })
        }
      );

      if (!productResponse.ok) {
        const errorData = await productResponse.json();
        throw new Error(`HTTP ${productResponse.status}: ${JSON.stringify(errorData)}`);
      }

      const productData = await productResponse.json();
      const updatedProduct = productData.product;

      // Handle image upload if provided
      if (productPayload.image && productPayload.image.imageUrl) {
        const imageUrl = productPayload.image.imageUrl;
        const imageExists = updatedProduct.images?.some(img => img.src === imageUrl);

        if (!imageExists) {
          await this.uploadProductImage(productId, imageUrl);
        } else {
          this.logger.info(`Image with URL ${imageUrl} already exists for product ${productId}. Skipping upload.`);
        }
      }

      // Update inventory quantity if provided
      if (quantity > 0 && updatedProduct.variants && updatedProduct.variants.length > 0) {
        const variant = updatedProduct.variants.find(v => v.sku === sku);
        if (variant) {
          await this.updateInventoryQuantity(variant.inventory_item_id, quantity);
        }
      }

      return updatedProduct;
    } catch (error) {
      this.logger.error(`Error updating product ID: ${productId}`, error.message);
      throw error;
    }
  }

  /**
   * Transform product payload to Shopify format
   * @param {Object} productPayload - Original product data
   * @param {Object} options - Upsert options
   * @returns {Object} Shopify-formatted product object
   */
  transformToShopifyFormat(productPayload, options) {
    const {
      sku,
      status = 'active',
      inventory_policy = 'deny',
      defaultVendor = 'Default Vendor',
      productTypeSource = 'firstCategory',
      manualProductType = '',
      appendTags = [],
    } = options;

    const productType = productTypeSource === 'manual'
      ? manualProductType
      : (productPayload.categories?.[0]?.categoryName || '');

    const vendor = productPayload.seller?.username || defaultVendor;

    const shopifyProduct = {
      title: productPayload.title,
      body_html: productPayload.shortDescription || '',
      product_type: productType,
      vendor: vendor,
      status: status,
      variants: [{
        sku: sku,
        price: productPayload.price ? productPayload.price.value : '0.00',
        inventory_management: 'shopify',
        inventory_policy: inventory_policy
      }]
    };

    // Add tags if available
    const tags = [];
    if (productPayload.condition) {
      tags.push(productPayload.condition);
    }
    // if (productPayload.epid) {
    //   tags.push(`EPID:${productPayload.epid}`);
    // }
    if (productPayload.categories) {
      const categoryNames = productPayload.categories
        .map(c => c.categoryName)
        .filter(Boolean);
      tags.push(...categoryNames);
    }
    if (appendTags.length > 0) {
      tags.push(...appendTags);
    }
    if (tags.length > 0) {
      shopifyProduct.tags = tags.join(', ');
    }

    return shopifyProduct;
  }

  /**
   * Upload product image
   * @param {number} productId - Shopify product ID
   * @param {string} imageUrl - Image URL
   * @returns {Object} Created image object
   */
  async uploadProductImage(productId, imageUrl) {
    try {
      const imageData = {
        image: {
          src: imageUrl,
          alt: 'Product Image'
        }
      };

      const imageResponse = await fetch(
        `${this.baseUrl}/products/${productId}/images.json`,
        {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify(imageData)
        }
      );

      if (!imageResponse.ok) {
        const errorData = await imageResponse.json();
        this.logger.warn(`Failed to upload image for product ${productId}:`, JSON.stringify(errorData));
        return null;
      }

      const imageResult = await imageResponse.json();
      this.logger.info(`Successfully uploaded image for product ${productId}`);
      return imageResult.image;
    } catch (error) {
      this.logger.error(`Error uploading image for product ${productId}:`, error.message);
      throw error;
    }
  }

  /**
   * Update inventory quantity for a variant
   * @param {number} inventoryItemId - Shopify inventory item ID
   * @param {number} quantity - New quantity
   * @returns {Object} Inventory level object
   */
  async updateInventoryQuantity(inventoryItemId, quantity) {
    try {
      // First, get available inventory locations
      const locationsResponse = await fetch(
        `${this.baseUrl}/locations.json`,
        { headers: this.headers }
      );

      if (!locationsResponse.ok) {
        throw new Error(`HTTP ${locationsResponse.status}: ${locationsResponse.statusText}`);
      }

      const locationsData = await locationsResponse.json();
      const primaryLocation = locationsData.locations.find(loc => loc.primary) || locationsData.locations[0];

      if (!primaryLocation) {
        throw new Error('No inventory location found');
      }

      // Update inventory level
      const inventoryData = {
        location_id: primaryLocation.id,
        inventory_item_id: inventoryItemId,
        available: quantity
      };

      const inventoryResponse = await fetch(
        `${this.baseUrl}/inventory_levels/set.json`,
        {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify(inventoryData)
        }
      );

      if (!inventoryResponse.ok) {
        const errorData = await inventoryResponse.json();
        this.logger.warn(`Failed to update inventory for item ${inventoryItemId}:`, JSON.stringify(errorData));
        return null;
      }

      const inventoryResult = await inventoryResponse.json();
      this.logger.info(`Successfully updated inventory quantity to ${quantity} for item ${inventoryItemId}`);
      return inventoryResult.inventory_level;
    } catch (error) {
      this.logger.error(`Error updating inventory for item ${inventoryItemId}:`, error.message);
      throw error;
    }
  }

  /**
   * Bulk upsert multiple products
   * @param {Array} products - Array of {productPayload, sku, quantity} objects
   * @returns {Array} Array of result objects
   */
  async bulkUpsert(products) {
    const results = [];

    this.logger.info(`Starting bulk upsert for ${products.length} products`);

    for (const product of products) {
      const { productPayload, ...options } = product;
      const result = await this.upsertProduct(productPayload, options);
      results.push(result);

      // Add a small delay to respect API rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    this.logger.info(`Bulk upsert completed. Success: ${successful}, Failed: ${failed}`);

    return results;
  }
}

export default ShopifyProductUpsert;

/*
// =================================================================
//                        EXAMPLE USAGE
// =================================================================
//
// To use this class, you would import it into another file and then
// create an instance with your shop's credentials.
//
// const ShopifyProductUpsert = require('./claude.js'); // Adjust path as needed
//
// async function runUpsert() {
//   // 1. --- DEFINE SHOP CREDENTIALS ---
//   const shop = {
//     shop: 'your-shop-name.myshopify.com',      // Replace with your shop's domain
//     accessToken: 'your-admin-api-access-token' // Replace with your access token
//   };
//
//   // 2. --- DEFINE PRODUCT DATA ---
//   // This typically comes from an external source like the eBay API
//   const productPayload = {
//     title: "Apple iPhone 15 Pro Max A2849 - Good",
//     categories: [{ categoryName: "Cell Phones & Smartphones" }],
//     shortDescription: "A high-quality refurbished iPhone with great features.",
//     image: { imageUrl: "https://i.ebayimg.com/images/g/YX8AAOSwuilm4fHk/s-l1600.jpg" },
//     price: { value: "720.00" },
//     seller: { username: "your-ebay-seller" },
//     condition: "Pristine - Refurbished",
//   };
//
//   // 3. --- DEFINE UPSERT OPTIONS ---
//   // These are the settings for how the product should be created/updated in Shopify
//   const upsertOptions = {
//     sku: "IPHONE15-PRO-MAX-GOOD-REFURB", // A unique SKU for the product
//     quantity: 10,
//     status: 'active', // 'active', 'draft', or 'archived'
//     inventory_policy: 'deny', // 'deny' or 'continue'
//     defaultVendor: 'eSyncify',
//     productTypeSource: 'firstCategory', // 'firstCategory' or 'manual'
//     manualProductType: '', // Only used if productTypeSource is 'manual'
//     appendTags: ['refurbished', 'iphone-15']
//   };
//
//   // 4. --- CREATE INSTANCE AND CALL UPSERT ---
//   try {
//     const upserter = new ShopifyProductUpsert(shop);
//     console.log(`Upserting product with SKU: ${upsertOptions.sku}`);
//     const result = await upserter.upsertProduct(productPayload, upsertOptions);
//
//     if (result.success) {
//       console.log(`Product upsert successful! Action: ${result.action}`);
//       console.log('Product ID:', result.data.id);
//     } else {
//       console.error(`Product upsert failed for SKU: ${result.sku}`);
//       console.error('Error:', result.error);
//     }
//   } catch (error) {
//     console.error('An unexpected error occurred:', error);
//   }
// }
//
// runUpsert();
//
*/
