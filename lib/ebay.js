import categories from '@/lib/categories'

/**
 * Refreshes the eBay OAuth2 access token using a refresh token.
 * It's crucial to securely store and manage your credentials and tokens.
 *
 * @returns {Promise<string>} A new eBay access token.
 * @throws {Error} If the token refresh fails.
 */
export async function getEbayToken() {
    const useSandbox = false; // <-- PRODUCTION SWITCH
    const clientId = process.env.EBAY_API_ID;
    const clientSecret = process.env.EBAY_API_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('eBay API credentials (EBAY_API_ID, EBAY_API_SECRET) are not defined in .env file.');
    }

    const authUrl = useSandbox ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token' : 'https://api.ebay.com/identity/v1/oauth2/token';
    const encodedCredentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${encodedCredentials}`,
        },
        body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Failed to get eBay token:", errorBody);
        throw new Error('Failed to get eBay token');
    }

    const data = await response.json();
    return data.access_token;
}

/**
 * Fetches all items for a given seller across specified categories, handling pagination.
 *
 * @param {object} params - The parameters for fetching items.
 * @param {string} params.sellerUsername - The eBay seller's username.
 * @param {string[]} params.categories - An array of eBay category IDs.
 * @param {string} params.sortOrder - The sort order for items (e.g., 'NEWEST_FIRST').
 * @param {number} [params.quota=250] - The maximum number of items to return.
 * @returns {Promise<Array>} A promise that resolves to an array of eBay items.
 */
export async function getPaginatedEbayItems({ sellerUsername, categories, sortOrder, quota = 250 }) {
  const ebayAccessToken = await getEbayToken();
  const limit = 200; // Max items per request
  const allItems = [];

  for (const categoryId of categories) {
    if (allItems.length >= quota) {
      break; // Stop if we've already reached the quota
    }
    let offset = 0;
    let totalForCategory = 0;

    do {
      const searchParams = new URLSearchParams({
        'category_ids': categoryId,
        'fieldgroups': 'EXTENDED',
        'filter': `sellers:{${sellerUsername}}`,
        'sort': sortOrder || '-creationDate',
        'limit': limit,
        'offset': offset
      });

      const ebayApiUrl = `https://api.ebay.com/buy/browse/v1/item_summary/search?${searchParams.toString()}`;
      const response = await fetch(ebayApiUrl, {
        headers: {
          'Authorization': `Bearer ${ebayAccessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`eBay API failed for category ${categoryId} with status ${response.status}:`, errorBody);
        break; // Stop processing this category on error
      }

      const data = await response.json();
      const items = data.itemSummaries || [];

      if (items.length > 0) {
        for (const item of items) {
          if (allItems.length < quota) {
            allItems.push(item);
          } else {
            break; // Stop adding items if quota is reached
          }
        }
      }

      totalForCategory = data.total || 0;
      offset += limit;

      if (allItems.length >= quota) {
        break; // Stop paginating this category if quota is reached
      }

      // Small delay to be respectful to the API
      await new Promise(resolve => setTimeout(resolve, 250));

    } while (offset < totalForCategory);
  }

  return process.env.TESTING ? allItems.slice(0,10) : allItems;
}

export async function getTotalsForUsername( sellerUsername ) {
  const ebayAccessToken = await getEbayToken();
  let categoryIds = [];
  let totalFound = 0;
  let sampleItem

  for (const category of categories) {
    const searchParams = new URLSearchParams({
      // 'category_ids': category.id,
      'q': 'a',
      'filter': `sellers:{${sellerUsername}}`,
      'limit': 1,
    });

    const ebayApiUrl = `https://api.ebay.com/buy/browse/v1/item_summary/search?${searchParams.toString()}`;
    const response = await fetch(ebayApiUrl, {
      headers: {
        'Authorization': `Bearer ${ebayAccessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`eBay API failed for category ${category.id} with status ${response.status}:`, errorBody);
      continue; // Skip to the next category on error
    }

    const data = await response.json();
    const categoryTotal = data.total || 0;

    sampleItem = sampleItem || data?.itemSummaries?.[0];
    console.log(category)
    if (categoryTotal > 0) {
      totalFound += categoryTotal;
      if (!categoryIds.includes(category.id)) {
        categoryIds.push(category.id);
      }
    }

    // Small delay to be respectful to the API
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  return { categoryIds, totalFound, sampleItem };
}

/**
 * Fetches a single item by its eBay legacy item ID.
 *
 * @param {string} itemId - The eBay legacy item ID.
 * @returns {Promise<object>} A promise that resolves to the eBay item object.
 * @throws {Error} If the item fetch fails.
 */
export async function getItemById(itemId) {
  if (!itemId) {
    throw new Error('Item ID is required.');
  }

  const ebayAccessToken = await getEbayToken();
  // Legacy item IDs need to be in this format for the Browse API getItem method.
  const formattedItemId = `v1|${itemId}|0`;
  const ebayApiUrl = `https://api.ebay.com/buy/browse/v1/item/${formattedItemId}`;

  const response = await fetch(ebayApiUrl, {
    headers: {
      'Authorization': `Bearer ${ebayAccessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`eBay API failed for item ${itemId} with status ${response.status}:`, errorBody);
    throw new Error(`Failed to fetch item ${itemId}.`);
  }

  const data = await response.json();
  return data;
}
