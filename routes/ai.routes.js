import express from "express";
import { generateListing } from "../controllers/ai.controller.js";

const router = express.Router();

router.post("/generate-listing", generateListing);

export default router;
