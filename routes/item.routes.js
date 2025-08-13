import {Router} from  "express";
import { createitem } from "../controllers/item.controller";
import{upload} from "../middleware/multer.middleware.js"

const router = Router();
router.route("/listitem").post(
    upload.fields([
        {
            name:"image",
            maxCount:2,
        }
    ]),
    createitem
);

export default router;