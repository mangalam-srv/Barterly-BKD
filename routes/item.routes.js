import {Router} from  "express";
import { createitem ,deleteItem} from "../controllers/item.controller.js";
// import { protect } from "../middleware/auth.middleware.js";
import{upload} from "../middleware/multer.middleware.js"

const router = Router();
router.post( "/listitem",
    // protect, // only logged-in users 
    upload.fields([{ name: "image", maxCount: 1 }]),
    createitem
);

router.delete("/:id",  deleteItem);



export default router;