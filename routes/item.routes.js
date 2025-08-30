// routes/item.routes.js
import { Router } from "express";
import { createitem, deleteItem } from "../controllers/item.controller.js";
import { protect } from "../middleware/auth.middleware.js";  // ✅ correct path
import { upload } from "../middleware/multer.middleware.js";

const router = Router();

// Create item (protected, needs login)
router.post(
  "/listitem",
  protect,
  upload.fields([{ name: "image", maxCount: 1 }]),
  createitem
);

// Delete item (protected, only owner can delete)
router.delete("/:id", protect, deleteItem);

export default router;
