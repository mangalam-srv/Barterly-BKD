import mongoose from "mongoose";

const itemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    listingType: {
      type: String,
      enum: ["Barter", "Both", "Rent"], // Possible types
      default: "Barter",
      required: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
      image: {
    type: String, // Single image URL
    required: true
},


    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Item", itemSchema);
