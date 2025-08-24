import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testGemini() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent("Hello, Gemini! Write one sentence.");
    console.log("✅ Gemini Response:", result.response.text());
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

testGemini();
