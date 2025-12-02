import {onDocumentUpdated} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import {initializeApp, getApps} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";

// Initialize Firebase Admin SDK if not already initialized
if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

/**
 * Cloud Function that triggers when an order is updated.
 *
 * It checks if a tracking number was newly added and, if so, sends the
 * complete order data to a configured webhook URL.
 */
export const sendTrackingWebhookOnOrderUpdate = onDocumentUpdated(
  "orders/{countryCode}/orders/{orderId}",
  async (event) => {
    logger.info(`Processing update for order: ${event.params.orderId}`);

    if (!event.data) {
      logger.warn("No data associated with the event. Exiting function.");
      return;
    }

    const dataBefore = event.data.before.data();
    const dataAfter = event.data.after.data();

    // Check if data is undefined (can happen on document deletion)
    if (!dataBefore || !dataAfter) {
      logger.info("Document data not available, likely a deletion. No webhook sent.");
      return;
    }
    
    const trackingBefore = dataBefore.trackingNumber;
    const trackingAfter = dataAfter.trackingNumber;

    // Condition: Proceed only if tracking number was added (was empty, now has a value)
    if (trackingAfter && !trackingBefore) {
      logger.info(
        `Tracking number added for order ${event.params.orderId}. ` +
        `New tracking number: ${trackingAfter}. Preparing to send webhook.`
      );

      try {
        // 1. Fetch the webhook URL from Firestore
        const settingsDocRef = db.collection("settings").doc("tracking");
        const settingsDoc = await settingsDocRef.get();

        if (!settingsDoc.exists || !settingsDoc.data()?.url) {
          logger.error(
            "Webhook sending failed: 'settings/tracking' document or " +
            "'url' field not found."
          );
          return;
        }

        const webhookUrl = settingsDoc.data()?.url;
        logger.info(`Webhook URL found: ${webhookUrl}`);

        // 2. Send the POST request using fetch
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(dataAfter), // Send all updated order data
        });

        if (response.ok) {
          logger.info(
            `Successfully sent webhook for order ${event.params.orderId} ` +
            `to ${webhookUrl}. Status: ${response.status}`
          );
        } else {
          const responseBody = await response.text();
          logger.error(
            `Failed to send webhook for order ${event.params.orderId}. ` +
            `Status: ${response.status}. Body: ${responseBody}`
          );
        }
      } catch (error) {
        logger.error(
          `An unexpected error occurred while sending webhook for order ` +
          `${event.params.orderId}:`,
          error
        );
      }
    } else {
      logger.info(
        "No new tracking number added. No webhook will be sent. " +
        `(Before: '${trackingBefore}', After: '${trackingAfter}')`
      );
    }
  }
);
