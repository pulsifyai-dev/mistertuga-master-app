import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// ---------------------------------------------------------------------
// Inicialização segura do Firebase Admin
// ---------------------------------------------------------------------
if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

// ---------------------------------------------------------------------
// Cache em memória do webhook (evita ler Firestore em cada trigger)
// ---------------------------------------------------------------------
let cachedTrackingWebhookUrl: string | null = null;

// ---------------------------------------------------------------------
// Função utilitária: lê settings/tracking.url (com cache)
// ---------------------------------------------------------------------
async function getTrackingWebhookUrl(): Promise<string | null> {
  if (cachedTrackingWebhookUrl) {
    return cachedTrackingWebhookUrl;
  }

  try {
    const snap = await db.doc("settings/tracking").get();

    if (!snap.exists) {
      logger.error("❌ Documento settings/tracking não existe");
      return null;
    }

    const url = snap.data()?.url;

    if (typeof url === "string" && url.trim() !== "") {
      cachedTrackingWebhookUrl = url.trim();
      return cachedTrackingWebhookUrl;
    }

    logger.error("❌ Campo settings/tracking.url vazio ou inválido");
    return null;
  } catch (error) {
    logger.error("❌ Erro ao ler settings/tracking", error);
    return null;
  }
}

// ---------------------------------------------------------------------
// Cloud Function: envia webhook quando tracking é ADICIONADO
// ---------------------------------------------------------------------
export const sendTrackingWebhookOnOrderUpdate = onDocumentUpdated(
  {
    document: "orders/{countryCode}/orders/{orderId}",
    region: "europe-west1",
    timeoutSeconds: 15,
    memory: "256MiB",
  },
  async (event) => {
    if (!event.data) {
      logger.warn("⚠️ Evento sem dados. A sair.");
      return;
    }

    const before = event.data.before.data();
    const after = event.data.after.data();

    if (!before || !after) {
      logger.info("ℹ️ Documento criado ou removido. Ignorado.");
      return;
    }

    const orderId = event.params.orderId;
    const countryCode = event.params.countryCode;

    // -----------------------------------------------------------------
    // Normalização segura do tracking
    // -----------------------------------------------------------------
    const trackingBefore = String(before.trackingNumber ?? "").trim();
    const trackingAfter = String(after.trackingNumber ?? "").trim();

    // -----------------------------------------------------------------
    // REGRA DE OURO:
    // só dispara quando passa de vazio -> preenchido
    // -----------------------------------------------------------------
    if (!(trackingBefore === "" && trackingAfter !== "")) {
      logger.info("🔁 Nenhuma transição válida de tracking. Ignorado.", {
        orderId,
        trackingBefore,
        trackingAfter,
      });
      return;
    }

    // -----------------------------------------------------------------
    // Obter webhook das settings
    // -----------------------------------------------------------------
    const webhookUrl = await getTrackingWebhookUrl();

    if (!webhookUrl) {
      logger.error("❌ Webhook não definido em settings/tracking.url", {
        orderId,
      });
      return;
    }

    logger.info("📦 Tracking adicionado. A enviar webhook.", {
      orderId,
      countryCode,
      tracking: trackingAfter,
      webhookUrl,
    });

    // -----------------------------------------------------------------
    // Payload explícito e estável
    // -----------------------------------------------------------------
    const payload = {
      event: "tracking_added",
      orderId,
      countryCode,
      trackingNumber: trackingAfter,
      status: after.status ?? "Shipped",
      customer: {
        name: after.customer?.name ?? "",
        address: after.customer?.address ?? "",
        phone: after.customer?.phone ?? "",
      },
      items: after.items ?? [],
      createdAt: after.date ?? null,
      updatedAt: Date.now(),
    };

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.text();
        logger.error("❌ Webhook falhou", {
          orderId,
          status: response.status,
          body,
        });
        return;
      }

      logger.info("✅ Webhook enviado com sucesso", {
        orderId,
        status: response.status,
      });
    } catch (error) {
      logger.error("❌ Erro inesperado ao enviar webhook", {
        orderId,
        error,
      });
    }
  }
);
