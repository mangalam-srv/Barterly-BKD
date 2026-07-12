import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import {
  createConversation,
  getUserConversations,
  getConversationById,
  sendMessage,
} from "../controllers/chat.controller.js";

const router = express.Router();

// Create or get conversation
router.post("/", protect, createConversation);

// Get user's conversations
router.get("/", protect, getUserConversations);

// Get a conversation by id (includes messages)
router.get("/:id", protect, getConversationById);

// Send a message in a conversation
router.post("/:id/messages", protect, sendMessage);

export default router;
