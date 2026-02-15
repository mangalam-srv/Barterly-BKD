import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

// ✅ Configure mongoose settings
mongoose.set("strictQuery", true);

const connectDB = async () => {
  try {
    // ✅ Validate MongoDB URI
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI environment variable is not set");
    }

    const mongoURI = `${process.env.MONGODB_URI}/${DB_NAME}`;

    console.log(`📡 Connecting to MongoDB: ${mongoURI.split("://")[0]}://...`);

    // ✅ Connect to MongoDB with proper options
    const connectionInstance = await mongoose.connect(mongoURI, {
      retryWrites: true,
      w: "majority",
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`✅ MongoDB connected successfully`);
    console.log(`   Host: ${connectionInstance.connection.host}`);
    console.log(`   Database: ${DB_NAME}`);

    return connectionInstance;
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);

    if (error.message.includes("ECONNREFUSED")) {
      console.error(
        "💡 Make sure MongoDB is running. You can start it with: mongod"
      );
    }

    if (error.message.includes("authentication failed")) {
      console.error(
        "💡 Check your MongoDB credentials in the MONGODB_URI environment variable"
      );
    }

    process.exit(1);
  }
};

export default connectDB;
