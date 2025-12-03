import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin SDK if not already initialized
if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

/**
 * Cloud Function that triggers when an order is updated.
 *
 * Sends a webhook ONLY when trackingNumber changes.
 */
export const sendTrackingWebhookOnOrderUpdate = onDocumentUpdated(
  {
    document: "orders/{countryCode}/orders/{orderId}",
    region: "us-central1",
    timeoutSeconds: 15,
    memory: "256MiB",
  },
  async (event) => {
    const orderId = event.params.orderId;

    logger.info(`Processing update for order: ${orderId}`);

    if (!event.data) {
      logger.warn("No data associated with the event. Exiting function.");
      return;
    }

    const before = event.data.before.data();
    const after = event.data.after.data();

    if (!before || !after) {
      logger.info("Document appears deleted; skipping.");
      return;
    }

    const trackingBefore = before.trackingNumber;
    const trackingAfter = after.trackingNumber;

    const webhookUrl = after.webhook;

    // ❗ This is the CORRECT behavior:
    // Only proceed if tracking changed
    if (trackingBefore === trackingAfter) {
      logger.info("Tracking did not change. No webhook sent.");
      return;
    }

    if (!trackingAfter) {
      logger.info("Tracking removed or still empty. Skipping webhook.");
      return;
    }

    if (!webhookUrl) {
      logger.error(`Order ${orderId} does not contain a 'webhook' field.`);
      return;
    }

    logger.info(
      `Tracking changed for order ${orderId}. Sending webhook to: ${webhookUrl}`
    );

    try {
      const payload = {
        orderId,
        trackingNumber: trackingAfter,
        previousTracking: trackingBefore || null,
        updatedAt: Date.now(),
        ...after, // include all order data
      };

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        logger.info(
          `Webhook sent successfully for order ${orderId}. Status: ${response.status}`
        );
      } else {
        const body = await response.text();
        logger.error(
          `Webhook failed for ${orderId}. Status: ${response.status}. Body: ${body}`
        );
      }
    } catch (err) {
      logger.error(`Unexpected error sending webhook for ${orderId}:`, err);
    }
  }
);
