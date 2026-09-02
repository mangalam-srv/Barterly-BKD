import crypto from "crypto";
import mongoose from "mongoose";
import AdvisorConversation from "../../models/advisorConversation.models.js";
import { ApiError } from "../../utils/ApiError.js";

const MAX_STORED_MESSAGES = 200;

/** Stable key for a product across sessions (id → url → title hash). */
export const productKeyFor = (product = {}) => {
  if (product.id) return String(product.id).slice(0, 200);
  if (product.productUrl) return `url:${String(product.productUrl).split("?")[0].slice(0, 200)}`;
  const hash = crypto
    .createHash("sha1")
    .update(`${product.title || "unknown"}|${product.platform || ""}`)
    .digest("hex")
    .slice(0, 16);
  return `t:${hash}`;
};

const snapshotOf = (product = {}) => ({
  title: (product.title || "Product").slice(0, 200),
  brand: product.brand || undefined,
  image: product.image || undefined,
  platform: product.platform || undefined,
  price: typeof product.price === "number" ? product.price : undefined,
  currency: product.currency || "INR",
  productUrl: product.productUrl || undefined,
  source: product.source === "listing" ? "listing" : "compare",
});

const deriveTitle = (message = "") => {
  const t = message.trim().replace(/\s+/g, " ");
  return t.length > 80 ? `${t.slice(0, 77)}…` : t || "New conversation";
};

const assertObjectId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid conversation id");
};

/** Load a conversation and assert the requesting user owns it. */
export const getOwnedConversation = async (id, userId) => {
  assertObjectId(id);
  const conversation = await AdvisorConversation.findById(id);
  if (!conversation) throw new ApiError(404, "Conversation not found");
  if (conversation.user.toString() !== userId.toString()) {
    throw new ApiError(403, "You do not have access to this conversation");
  }
  return conversation;
};

export const listConversations = async (userId, { productKey, limit = 20 } = {}) => {
  const filter = { user: userId };
  if (productKey) filter.productKey = productKey;
  const rows = await AdvisorConversation.find(filter)
    .sort({ updatedAt: -1 })
    .limit(Math.min(Number(limit) || 20, 50))
    .select("productKey productSnapshot title lastMessageAt updatedAt messages")
    .lean();

  return rows.map((r) => ({
    id: r._id,
    productKey: r.productKey,
    productSnapshot: r.productSnapshot,
    title: r.title,
    messageCount: r.messages?.length ?? 0,
    lastMessageAt: r.lastMessageAt ?? r.updatedAt,
  }));
};

export const serializeConversation = (c) => ({
  id: c._id,
  productKey: c.productKey,
  productSnapshot: c.productSnapshot,
  title: c.title,
  messages: (c.messages || []).map((m) => ({
    role: m.role,
    content: m.content,
    meta: m.meta,
    createdAt: m.createdAt,
  })),
  lastMessageAt: c.lastMessageAt,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

/**
 * Append a user turn + assistant turn to a conversation, creating it if needed.
 * Returns the (updated) conversation document.
 */
export const appendTurn = async ({
  userId,
  conversationId,
  product,
  userMessage,
  assistantMessage,
  assistantMeta,
}) => {
  let conversation = null;

  if (conversationId) {
    conversation = await getOwnedConversation(conversationId, userId);
  } else {
    conversation = await AdvisorConversation.create({
      user: userId,
      productKey: productKeyFor(product),
      productSnapshot: snapshotOf(product),
      title: deriveTitle(userMessage),
      messages: [],
    });
  }

  conversation.messages.push({ role: "user", content: userMessage.slice(0, 8000) });
  conversation.messages.push({
    role: "assistant",
    content: assistantMessage.slice(0, 8000),
    meta: assistantMeta,
  });

  if (conversation.messages.length > MAX_STORED_MESSAGES) {
    conversation.messages = conversation.messages.slice(-MAX_STORED_MESSAGES);
  }
  conversation.lastMessageAt = new Date();
  await conversation.save();
  return conversation;
};

export const deleteConversation = async (id, userId) => {
  const conversation = await getOwnedConversation(id, userId);
  await conversation.deleteOne();
};

/** History array (role/content) for feeding back into the advisor. */
export const historyFromConversation = (conversation, max = 20) =>
  (conversation.messages || [])
    .slice(-max)
    .map((m) => ({ role: m.role, content: m.content }));
