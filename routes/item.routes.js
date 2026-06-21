import { Router } from "express";
import {
  createitem,
  deleteItem,
  getAllItems,
  getMyItems,
  getSingleItem,
  updateItem,
} from "../controllers/item.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/multer.middleware.js";

const router = Router();

router.get("/", getAllItems);
router.get("/my-items", protect, getMyItems);
router.get("/:id", getSingleItem);

router.post(
  "/listitem",
  protect,
  upload.fields([{ name: "image", maxCount: 1 }]),
  createitem
);

router.put(
  "/:id",
  protect,
  upload.fields([{ name: "image", maxCount: 1 }]),
  updateItem
);

router.delete("/:id", protect, deleteItem);

export default router;
