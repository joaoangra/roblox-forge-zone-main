import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

async function handleApiRequest(request: Request): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;

  if (pathname.startsWith("/admin-api/")) {
    const { handleAdminApi } = await import("./admin/api");
    return handleAdminApi(request);
  }

  if (pathname === "/create-checkout-session") {
    const { handleCreateCheckoutSession } = await import("./stripe/checkout");
    return handleCreateCheckoutSession(request);
  }

  if (pathname === "/webhook") {
    const { handleStripeWebhook } = await import("./stripe/webhook");
    return handleStripeWebhook(request);
  }

  if (pathname === "/verify-subscription") {
    const { handleVerifySubscription } = await import("./stripe/webhook");
    return handleVerifySubscription(request);
  }

  if (pathname === "/marketplace/create-checkout-session") {
    const { handleCreateMarketplaceCheckoutSession } = await import("./stripe/checkout");
    return handleCreateMarketplaceCheckoutSession(request);
  }

  if (pathname === "/marketplace/create-seller-account") {
    const { handleCreateSellerAccount } = await import("./marketplace/transactions");
    return handleCreateSellerAccount(request);
  }

  if (pathname === "/marketplace/sync-seller-account") {
    const { handleSyncSellerAccount } = await import("./marketplace/transactions");
    return handleSyncSellerAccount(request);
  }

  if (pathname === "/marketplace/mark-delivered") {
    const { handleMarkDelivered } = await import("./marketplace/transactions");
    return handleMarkDelivered(request);
  }

  if (pathname === "/marketplace/release-order") {
    const { handleReleaseOrder } = await import("./marketplace/transactions");
    return handleReleaseOrder(request);
  }

  if (pathname === "/marketplace/release-due-payouts") {
    const { handleReleaseDuePayouts } = await import("./marketplace/payouts");
    return handleReleaseDuePayouts(request);
  }

  if (pathname === "/tickets/open-dispute") {
    const { handleOpenDispute } = await import("./tickets/disputes");
    return handleOpenDispute(request);
  }

  if (pathname === "/tickets/resolve-dispute") {
    const { handleResolveDispute } = await import("./tickets/disputes");
    return handleResolveDispute(request);
  }

  return null;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const apiResponse = await handleApiRequest(request);
      if (apiResponse) return apiResponse;

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
