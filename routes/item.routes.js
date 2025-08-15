import {Router} from  "express";
import { createitem } from "../controllers/item.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import{upload} from "../middleware/multer.middleware.js"

const router = Router();
router.post( "/",
    protect, // only logged-in users
    upload.fields([{ name: "image", maxCount: 1 }]),
    createitem
);

export default router;