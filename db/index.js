import mongoose from "mongoose";

const connectDB = async () => {
  try {

    const connectionInstance = await mongoose.connect(
      process.env.MONGODB_URI,
      {
        serverSelectionTimeoutMS: 10000,
      }
    );

console.log("✅ MongoDB Connected");
  } catch (error) {
    console.error("FULL ERROR:");
    console.error(error);
  }
};

export default connectDB;