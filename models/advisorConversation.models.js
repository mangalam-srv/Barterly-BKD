import mongoose from "mongoose";

/**
 * Persistent AI Product Advisor conversations for authenticated users.
 *
 * Kept separate from the marketplace `Conversation` model (which is user-to-user
 * chat about an Item). This stores a user's chat with Barterly AI about a
 * specific product — which may be a scraped AI-Compare product (no Item id) or a
 * native listing. We therefore key on a stable string `productKey`, not an
 * ObjectId, and keep a small snapshot for display. No secrets are stored.
 */

const advisorMessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true, maxlength: 8000 },
    // small, non-sensitive render hints (type, fitScore, sources, ...)
    meta: { type: mongoose.Schema.Types.Mixed, default: undefined },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const advisorConversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    productKey: { type: String, required: true, index: true },
    productSnapshot: {
      title: { type: String, required: true },
      brand: String,
      image: String,
      platform: String,
      price: Number,
      currency: { type: String, default: "INR" },
      productUrl: String,
      source: { type: String, enum: ["compare", "listing"], default: "compare" },
    },
    title: { type: String, default: "New conversation", maxlength: 200 },
    messages: {
      type: [advisorMessageSchema],
      default: [],
      validate: [(v) => v.length <= 200, "Conversation is too long"],
    },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

advisorConversationSchema.index({ user: 1, productKey: 1, updatedAt: -1 });

export default mongoose.model("AdvisorConversation", advisorConversationSchema);
