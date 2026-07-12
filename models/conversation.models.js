  import mongoose from "mongoose";

  const conversationSchema = new mongoose.Schema(
    {
      participants: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
      ],
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Item",
      },
      lastMessage: {
        type: String,
        default: "",
      },
      lastMessageTimestamp: {
        type: Date,
        default: Date.now,
      },
    },
    { timestamps: true }
  );

  export default mongoose.model("Conversation", conversationSchema);
