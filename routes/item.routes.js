// routes/item.routes.js
import { Router } from "express";
import {
  createitem,
  deleteItem,
  getAllItems,
  getItemById,
  getUserItems,
  updateItem,
} from "../controllers/item.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/multer.middleware.js";

const router = Router();

// ✅ Public routes (no auth required)
router.get("/", getAllItems); // Get all items with filters
router.get("/:id", getItemById); // Get specific item
router.get("/user/:userId", getUserItems); // Get items by user

// ✅ Protected routes (auth required)
router.post(
  "/listitem",
  protect,
  upload.fields([{ name: "image", maxCount: 1 }]),
  createitem
); // Create item

router.put(
  "/:id",
  protect,
  upload.fields([{ name: "image", maxCount: 1 }]),
  updateItem
); // Update item

router.delete("/:id", protect, deleteItem); // Delete item

export default router;
