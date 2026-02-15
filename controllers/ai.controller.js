import { GoogleGenerativeAI } from "@google/generative-ai";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import dotenv from "dotenv";

dotenv.config();

// ✅ Check if Gemini API key is configured
if (!process.env.GEMINI_API_KEY) {
  console.warn("⚠️ GEMINI_API_KEY not configured. AI features will not work.");
}

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

// ✅ AI Generate Listing with proper error handling
export const generateListing = asyncHandler(async (req, res) => {
  if (!genAI) {
    throw new ApiError(503, "AI service is not configured");
  }

  const { title, description } = req.body;

  // Validate input
  if (!title && !description) {
    throw new ApiError(400, "Please provide at least title or description");
  }

  // Limit input length to prevent abuse
  if ((title?.length || 0) > 500 || (description?.length || 0) > 2000) {
    throw new ApiError(400, "Title or description too long");
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `You are an assistant for a barter platform.
Generate a detailed and attractive description for an item listing.
Keep it concise (2-3 sentences), professional, and appealing.

Title: ${title || "No title provided"}
Current Description: ${description || "No description provided"}

Generate only the enhanced description without any additional text.`;

    const result = await model.generateContent(prompt);
    const aiText = result.response.text();

    if (!aiText) {
      throw new ApiError(500, "Failed to generate description from AI");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { generatedDescription: aiText },
          "Description generated successfully"
        )
      );
  } catch (error) {
    console.error("❌ AI Generation Error:", error);

    // Handle specific AI errors
    if (error.message?.includes("API key")) {
      throw new ApiError(500, "AI service authentication failed");
    }

    if (error.message?.includes("quota") || error.message?.includes("rate")) {
      throw new ApiError(
        429,
        "AI service rate limit exceeded. Please try again later."
      );
    }

    if (
      error.message?.includes("network") ||
      error.message?.includes("timeout")
    ) {
      throw new ApiError(503, "AI service temporarily unavailable");
    }

    throw new ApiError(500, "Failed to generate description: " + error.message);
  }
});
