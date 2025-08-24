import { GoogleGenerativeAI } from "@google/generative-ai";

console.log("Gemini API Key:", process.env.GEMINI_API_KEY ? "Loaded" : "Not Loaded");


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// AI Generate Listing
export const generateListing = async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title && !description) {
      return res.status(400).json({ message: "Please provide title or description" });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
      You are an assistant for a barter platform.
      Generate a detailed and attractive description for an item listing.
      Title: ${title || "No title provided"}
      Current Description: ${description || "No description provided"}
    `;

    const result = await model.generateContent(prompt);
    const aiText = result.response.text();

    res.json({
      success: true,
      generatedDescription: aiText
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "AI generation failed", error: error.message });
  }
};
