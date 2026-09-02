import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  askAdvisor,
  askAdvisorStream,
  advisorHealth,
  AdvisorServiceError,
} from "../services/advisor/advisorClient.js";
import {
  appendTurn,
  deleteConversation,
  getOwnedConversation,
  historyFromConversation,
  listConversations,
  productKeyFor,
  serializeConversation,
} from "../services/advisor/conversationService.js";

const MAX_MESSAGE_LEN = 2000;
const MAX_HISTORY = 20;
const MAX_REVIEWS = 12;
const CONTROL_CHARS = new RegExp("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]", "g");

const asString = (value, max) =>
  typeof value === "string" ? value.replace(CONTROL_CHARS, "").trim().slice(0, max) : undefined;

const asNumber = (value) => {
  const n = typeof value === "string" ? Number(value.replace(/[^\d.-]/g, "")) : Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * Whitelist + shape the product context we forward to Python. We never forward
 * the whole request body blindly, and never anything user-identifying.
 */
const sanitizeProduct = (raw) => {
  if (!raw || typeof raw !== "object") {
    throw new ApiError(400, "A product context is required to ask the advisor");
  }
  const title = asString(raw.title, 300);
  if (!title) {
    throw new ApiError(400, "The product must have a title");
  }

  const specs = {};
  if (raw.specs && typeof raw.specs === "object") {
    for (const [k, v] of Object.entries(raw.specs)) {
      if (typeof k === "string" && (typeof v === "string" || typeof v === "number")) {
        specs[k.slice(0, 40)] = String(v).slice(0, 120);
      }
    }
  }

  const reviews = Array.isArray(raw.reviews)
    ? raw.reviews
        .filter((r) => typeof r === "string" && r.trim())
        .slice(0, MAX_REVIEWS)
        .map((r) => r.trim().slice(0, 800))
    : [];

  return {
    id: asString(raw.id, 120) || null,
    title,
    brand: asString(raw.brand, 80) || null,
    price: asNumber(raw.price),
    originalPrice: asNumber(raw.originalPrice),
    discountPercent: asNumber(raw.discountPercent),
    currency: asString(raw.currency, 8) || "INR",
    image: asString(raw.image, 600) || null,
    productUrl: asString(raw.productUrl, 800) || null,
    platform: asString(raw.platform, 40) || null,
    rating: asNumber(raw.rating),
    reviewCount: asNumber(raw.reviewCount),
    availability: asString(raw.availability, 200) || null,
    deliveryInfo: asString(raw.deliveryInfo, 200) || null,
    category: asString(raw.category, 80) || null,
    specs,
    modelNumber: asString(raw.modelNumber, 80) || null,
    variant: asString(raw.variant, 120) || null,
    description: asString(raw.description, 4000) || null,
    reviews,
    source: raw.source === "listing" ? "listing" : "compare",
  };
};

const sanitizeAlternative = (raw) => ({
  title: asString(raw?.title, 300) || "Alternative",
  platform: asString(raw?.platform, 40) || null,
  price: asNumber(raw?.price),
  productUrl: asString(raw?.productUrl, 800) || null,
  rating: asNumber(raw?.rating),
  specs:
    raw?.specs && typeof raw.specs === "object"
      ? Object.fromEntries(
          Object.entries(raw.specs)
            .slice(0, 12)
            .map(([k, v]) => [String(k).slice(0, 40), String(v).slice(0, 120)])
        )
      : {},
});

const sanitizeComparison = (raw) => {
  if (!raw || typeof raw !== "object") return undefined;
  const alternatives = Array.isArray(raw.alternatives)
    ? raw.alternatives.slice(0, 8).map(sanitizeAlternative)
    : [];
  const cheapest = raw.cheapest ? sanitizeAlternative(raw.cheapest) : null;
  let priceRange = null;
  if (raw.priceRange && typeof raw.priceRange === "object") {
    const min = asNumber(raw.priceRange.min);
    const max = asNumber(raw.priceRange.max);
    if (min !== null && max !== null) priceRange = { min, max };
  }
  if (!alternatives.length && !cheapest && !priceRange && !raw.groupLabel) return undefined;
  return {
    groupLabel: asString(raw.groupLabel, 200) || null,
    priceRange,
    cheapest,
    alternatives,
  };
};

const sanitizeHistory = (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.replace(CONTROL_CHARS, "").trim().slice(0, MAX_MESSAGE_LEN) }))
    .filter((m) => m.content);
};

/** Build the sanitized body forwarded to Python, plus persistence context. */
const prepareTurn = async (req) => {
  const message = asString(req.body?.message, MAX_MESSAGE_LEN);
  if (!message) throw new ApiError(400, "A question is required");
  if (message.length < 2) throw new ApiError(400, "Your question is too short");

  const product = sanitizeProduct(req.body?.product);
  const comparisonContext = sanitizeComparison(req.body?.comparisonContext);

  // Conversation handling — only for authenticated users.
  const wantsPersist = req.user && req.body?.persist !== false;
  let conversation = null;
  let history = sanitizeHistory(req.body?.conversationHistory);

  if (req.user && req.body?.conversationId) {
    conversation = await getOwnedConversation(req.body.conversationId, req.user._id);
    // Server-side history is the source of truth once a conversation exists.
    history = historyFromConversation(conversation, MAX_HISTORY);
  }

  return {
    message,
    requestBody: { message, product, comparisonContext, conversationHistory: history },
    product,
    conversation,
    wantsPersist,
    conversationId: conversation?._id?.toString() || null,
  };
};

const assistantMetaFrom = (aiResponse = {}) => ({
  type: aiResponse.type,
  fitScore: aiResponse.fitScore ?? null,
  fitBreakdown: aiResponse.fitBreakdown ?? [],
  pros: aiResponse.pros ?? [],
  cons: aiResponse.cons ?? [],
  sources: aiResponse.sources ?? [],
  citations: aiResponse.citations ?? [],
  comparisonTable: aiResponse.comparisonTable ?? null,
  toolUsed: aiResponse.toolUsed ?? null,
  disclaimer: aiResponse.disclaimer ?? null,
  degraded: !!aiResponse.degraded,
});

const logTurn = (req, extra) => {
  // Non-sensitive: no message text, no auth header.
  const line = {
    event: "advisor.turn",
    mode: extra.mode,
    authed: !!req.user,
    ...extra,
  };
  console.log(JSON.stringify(line));
};

/**
 * POST /api/v1/advisor/chat
 * Body: { message, product, comparisonContext?, conversationHistory?, conversationId?, persist? }
 */
export const advisorChat = asyncHandler(async (req, res) => {
  const startedAt = Date.now();
  const { message, requestBody, product, conversation, wantsPersist } = await prepareTurn(req);

  let aiResponse;
  try {
    aiResponse = await askAdvisor(requestBody);
  } catch (err) {
    if (err instanceof AdvisorServiceError) throw new ApiError(err.status || 502, err.message);
    throw err;
  }

  let conversationId = conversation?._id?.toString() || null;
  if (wantsPersist) {
    try {
      const saved = await appendTurn({
        userId: req.user._id,
        conversationId,
        product,
        userMessage: message,
        assistantMessage: aiResponse.answer,
        assistantMeta: assistantMetaFrom(aiResponse),
      });
      conversationId = saved._id.toString();
    } catch (persistErr) {
      // Persistence must never break the answer.
      console.warn("advisor: failed to persist conversation:", persistErr.message);
    }
  }

  logTurn(req, {
    mode: "sync",
    type: aiResponse.type,
    tool: aiResponse.toolUsed || "none",
    degraded: !!aiResponse.degraded,
    ms: Date.now() - startedAt,
    persisted: !!conversationId && wantsPersist,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { ...aiResponse, conversationId }, "Advisor response generated"));
});

/**
 * POST /api/v1/advisor/chat/stream  → Server-Sent Events
 * Same contract as /chat. Falls back to /chat on the client if it errors.
 */
export const advisorChatStream = asyncHandler(async (req, res) => {
  const startedAt = Date.now();
  const { message, requestBody, product, conversation, wantsPersist } = await prepareTurn(req);

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const clientAbort = new AbortController();
  res.on("close", () => clientAbort.abort());

  let upstream;
  try {
    upstream = await askAdvisorStream(requestBody, clientAbort.signal);
  } catch (err) {
    const msg =
      err instanceof AdvisorServiceError ? err.message : "The AI advisor stream failed to start.";
    res.write(`event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`);
    return res.end();
  }

  const { response, cleanup } = upstream;
  let buffer = "";
  let finalPayload = null;
  const decoder = new TextDecoder();
  // Node just relays bytes; `buffer` only exists to spot the `done` event so we
  // can persist it. Keep it small — an SSE frame is never this large.
  const MAX_SNIFF_BUFFER = 256 * 1024;

  try {
    for await (const chunk of response.body) {
      if (res.writableEnded) break;
      // undici yields Uint8Array chunks — decode, never Array.toString().
      const text = decoder.decode(chunk, { stream: true });
      if (!text) continue;
      res.write(text);
      // Sniff the `done` event so we can persist it after the stream ends.
      buffer += text;
      if (buffer.length > MAX_SNIFF_BUFFER) buffer = buffer.slice(-MAX_SNIFF_BUFFER);
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const evt of events) {
        if (!evt.includes("event: done")) continue;
        const dataLine = evt.split("\n").find((l) => l.startsWith("data: "));
        if (dataLine) {
          try {
            finalPayload = JSON.parse(dataLine.slice(6));
          } catch {
            /* ignore malformed */
          }
        }
      }
    }
  } catch (streamErr) {
    if (!res.writableEnded) {
      res.write(
        `event: error\ndata: ${JSON.stringify({ message: "The AI advisor stream was interrupted." })}\n\n`
      );
    }
  } finally {
    cleanup();
  }

  let conversationId = conversation?._id?.toString() || null;
  if (finalPayload && wantsPersist) {
    try {
      const saved = await appendTurn({
        userId: req.user._id,
        conversationId,
        product,
        userMessage: message,
        assistantMessage: finalPayload.answer || "",
        assistantMeta: assistantMetaFrom(finalPayload),
      });
      conversationId = saved._id.toString();
      if (!res.writableEnded) {
        res.write(`event: saved\ndata: ${JSON.stringify({ conversationId })}\n\n`);
      }
    } catch (persistErr) {
      console.warn("advisor(stream): failed to persist conversation:", persistErr.message);
    }
  } else if (conversationId && !res.writableEnded) {
    res.write(`event: saved\ndata: ${JSON.stringify({ conversationId })}\n\n`);
  }

  logTurn(req, {
    mode: "stream",
    type: finalPayload?.type || "unknown",
    tool: finalPayload?.toolUsed || "none",
    degraded: !!finalPayload?.degraded,
    ms: Date.now() - startedAt,
    persisted: !!conversationId && wantsPersist,
  });

  if (!res.writableEnded) res.end();
});

/** GET /api/v1/advisor/health */
export const advisorStatus = asyncHandler(async (_req, res) => {
  try {
    const health = await advisorHealth();
    return res
      .status(200)
      .json(new ApiResponse(200, { reachable: true, ...health }, "AI advisor status"));
  } catch (err) {
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { reachable: false, reason: err instanceof AdvisorServiceError ? err.message : "unknown" },
          "AI advisor status"
        )
      );
  }
});

// --- persistent conversation endpoints (auth required) ---

/** GET /api/v1/advisor/conversations?productKey=&product... */
export const listAdvisorConversations = asyncHandler(async (req, res) => {
  let productKey = asString(req.query.productKey, 220);
  if (!productKey && req.query.productId) productKey = productKeyFor({ id: req.query.productId });
  const rows = await listConversations(req.user._id, { productKey });
  return res.status(200).json(new ApiResponse(200, { conversations: rows }, "Conversations"));
});

/** GET /api/v1/advisor/conversations/:id */
export const getAdvisorConversation = asyncHandler(async (req, res) => {
  const conversation = await getOwnedConversation(req.params.id, req.user._id);
  return res
    .status(200)
    .json(new ApiResponse(200, serializeConversation(conversation), "Conversation"));
});

/** DELETE /api/v1/advisor/conversations/:id */
export const removeAdvisorConversation = asyncHandler(async (req, res) => {
  await deleteConversation(req.params.id, req.user._id);
  return res.status(200).json(new ApiResponse(200, null, "Conversation deleted"));
});

/** POST /api/v1/advisor/product-key — helper so the client can group by product. */
export const resolveProductKey = asyncHandler(async (req, res) => {
  const key = productKeyFor(sanitizeProduct(req.body?.product));
  return res.status(200).json(new ApiResponse(200, { productKey: key }, "Product key"));
});
