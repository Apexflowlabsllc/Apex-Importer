// lib/sessionHandler.js

import { Session } from "@shopify/shopify-api";
import prisma from "./prisma.js";

/**
 * Stores the session data into the database.
 * Now ensures the Shop exists before creating/updating the session.
 *
 * @param {Session} session - The Shopify session object.
 * @returns {Promise<boolean>} Returns true if the operation was successful.
 */
const storeSession = async (session) => {
  // 1. 👇 Ensure the Shop record exists first. This is the most important change.
  //    The upsert operation is perfect here as it will create the shop if it's the first time
  //    we see it, or do nothing if it already exists.
  await prisma.Shop.upsert({
    where: {
      domain: session.shop,
    },
    update: {}, // No fields to update, we just need to ensure it exists.
    create: {
      domain: session.shop,
      // Set initial quota reset date for new shops
      quotaResetDate: (() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        return d;
      })(),
    },
  });

  // 2. 👇 Prepare the data for the Session model, using the new `shopDomain` field.
  const data = {
    id: session.id,
    state: session.state,
    isOnline: session.isOnline,
    scope: session.scope,
    expires: session.expires,
    accessToken: session.accessToken,
    userId: session.userId ? BigInt(session.userId) : null,
    shopDomain: session.shop, // Use `shopDomain` to link the session to the shop
  };

  // 3. 👇 Now, upsert the session. This is safe because we know the Shop record exists.
  await prisma.Session.upsert({
    where: { id: session.id },
    update: data,
    create: data,
  });

  // The Shopify library expects this function to return a boolean.
  return true;
};

/**
 * Loads the session data from the database.
 *
 * @param {string} id - The session ID.
 * @returns {Promise<Session|undefined>} Returns the Shopify session object or undefined if not found.
 */
const loadSession = async (id) => {
  const sessionData = await prisma.Session.findUnique({ where: { id } });

  if (!sessionData) {
    return undefined;
  }

  // 👇 The Shopify `Session` class constructor expects a `shop` property,
  //    but our database now stores `shopDomain`. We must map it back.
  const sessionObject = {
    id: sessionData.id,
    state: sessionData.state,
    isOnline: sessionData.isOnline,
    scope: sessionData.scope,
    expires: sessionData.expires,
    accessToken: sessionData.accessToken,
    userId: sessionData.userId ? Number(sessionData.userId) : undefined,
    shop: sessionData.shopDomain, // Map shopDomain back to shop
  };

  return new Session(sessionObject);
};

/**
 * Deletes the session data from the database.
 * This function does not need any changes.
 *
 * @param {string} id - The session ID.
 * @returns {Promise<boolean>} Returns true if the operation was successful.
 */
const deleteSession = async (id) => {
  await prisma.Session.deleteMany({ where: { id } });
  return true;
};

/**
 * Session handler object containing the corrected functions.
 */
const sessionHandler = { storeSession, loadSession, deleteSession };

export default sessionHandler;