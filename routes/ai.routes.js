import express from "express";
import { generateListing } from "../controllers/ai.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// ✅ AI endpoint (protected - requires authentication)
router.post("/generate-listing", protect, generateListing);

export default router;
