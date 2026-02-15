import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

// ✅ Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Verify Cloudinary configuration
const isCloudinaryConfigured = () => {
  return (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

if (!isCloudinaryConfigured()) {
  console.warn(
    "⚠️ Cloudinary not fully configured. Missing environment variables."
  );
}

/**
 * Upload file to Cloudinary
 * @param {string} localFilePath - Path to local file
 * @returns {Promise<Object>} Cloudinary response or null if failed
 */
export const uploadoncloudinary = async (localFilePath) => {
  try {
    // ✅ Validate input
    if (!localFilePath) {
      console.error("❌ No file path provided");
      return null;
    }

    // ✅ Check if file exists
    if (!fs.existsSync(localFilePath)) {
      console.error("❌ File not found:", localFilePath);
      return null;
    }

    // ✅ Check if Cloudinary is configured
    if (!isCloudinaryConfigured()) {
      console.error("❌ Cloudinary is not configured");
      return null;
    }

    // ✅ Upload to Cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto", // Auto-detect file type
      folder: "barterly-items", // Organize uploads in a folder
      timeout: 60000, // 60 second timeout
    });

    // ✅ Clean up local file after successful upload
    fs.unlinkSync(localFilePath);

    console.log("✅ File uploaded successfully:", response.public_id);
    return response;
  } catch (error) {
    console.error("❌ Cloudinary upload error:", error.message);

    // ✅ Clean up local file on error
    if (fs.existsSync(localFilePath)) {
      try {
        fs.unlinkSync(localFilePath);
      } catch (unlinkError) {
        console.error(
          "❌ Failed to remove temporary file:",
          unlinkError.message
        );
      }
    }

    return null;
  }
};
