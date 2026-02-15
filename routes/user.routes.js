import { Router } from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  updateUserProfile,
} from "../controllers/user.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

// ✅ Authentication endpoints (public)
router.post("/register", registerUser); // Register user
router.post("/login", loginUser); // Login user

// ✅ Protected endpoints (auth required)
router.post("/logout", protect, logoutUser); // Logout user
router.get("/profile/me", protect, getCurrentUser); // Get current user profile
router.patch("/profile", protect, updateUserProfile); // Update user profile

export default router;
