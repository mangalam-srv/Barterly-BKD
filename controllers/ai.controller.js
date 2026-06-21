import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config({ 
  quiet: true,
});



const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export const generateListing = async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title && !description) {
      return res.status(400).json({
        message: "Please provide title or description",
      });
    }

    const prompt = `
You are an assistant for a barter platform.

Generate a detailed and attractive product listing.

Title: ${title || "No title provided"}

Current Description:
${description || "No description provided"}

Return only the improved listing description.
`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const aiText = completion.choices[0]?.message?.content;

    return res.status(200).json({
      success: true,
      generatedDescription: aiText,
    });
  } catch (error) {
    console.error("Groq Error:", error);

    return res.status(500).json({
      success: false,
      message: "AI generation failed",
      error: error.message,
    });
  }
};