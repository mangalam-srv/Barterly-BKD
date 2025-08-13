import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  registerUser,
  
} from "../controllers/user.controller.js";

const router = Router();

router.post("/register",registerUser);



export default router;
