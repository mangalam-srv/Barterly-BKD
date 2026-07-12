import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import Conversation from "../models/conversation.models.js";
import Message from "../models/message.models.js";
import User from "../models/user.models.js";
import Item from "../models/item.models.js";

// Create or find an existing conversation for participants (and optional product)
const createConversation = asyncHandler(async (req, res) => {
  const { participantIds, productId } = req.body;

  if (
    !participantIds ||
    !Array.isArray(participantIds) ||
    participantIds.length < 2
  ) {
    throw new ApiError(
      400,
      "participantIds must be an array of at least two user ids"
    );
  }

  // Remove duplicate participant ids
  const uniqueParticipants = [...new Set(participantIds)];

  let conversation = await Conversation.findOne({
    participants: { $all: uniqueParticipants },
    $expr: {
      $eq: [{ $size: "$participants" }, uniqueParticipants.length],
    },
    ...(productId && { product: productId }),
  }).populate("participants product");

  if (!conversation) {
    conversation = await Conversation.create({
      participants: uniqueParticipants,
      product: productId || null,
    });

    conversation = await Conversation.findById(conversation._id).populate(
      "participants product"
    );
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      conversation,
      "Conversation ready"
    )
  );
});

// Get conversations for authenticated user
const getUserConversations = asyncHandler(async (req, res) => {
  const userId = req.user && req.user._id;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const conversations = await Conversation.find({ participants: userId })
    .populate("participants product")
    .sort({ lastMessageTimestamp: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, conversations, "Conversations fetched"));
});

// Get conversation by id and its messages
const getConversationById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new ApiError(400, "Conversation id is required");

  const conversation = await Conversation.findById(id).populate(
    "participants product"
  );
  if (!conversation) throw new ApiError(404, "Conversation not found");

  const messages = await Message.find({ conversation: conversation._id })
    .populate("sender")
    .sort({ timestamp: 1 });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { ...conversation.toObject(), messages },
        "Conversation fetched"
      )
    );
});

// Send (persist) a message to a conversation

 const sendMessage = asyncHandler(async (req, res) => {


  const { id } = req.params;
  const { text } = req.body;

  

  if (!id) throw new ApiError(400, "Conversation id is required");
  if (!text || typeof text !== "string")
    throw new ApiError(400, "Message text is required");

  const conversation = await Conversation.findById(id);
  if (!conversation) throw new ApiError(404, "Conversation not found");

  const message = await Message.create({
    conversation: conversation._id,
    sender: req.user._id,
    text,
    timestamp: new Date(),
  });

  conversation.lastMessage = text;
  conversation.lastMessageTimestamp = message.timestamp;
  await conversation.save();

  const populatedMessage = await Message.findById(message._id).populate(
    "sender"
  );

  const io = req.app.get("io");
  
io.to(id).emit("new-message", {
  id: populatedMessage._id,
  senderId: populatedMessage.sender._id,
  text: populatedMessage.text,
  timestamp: populatedMessage.timestamp,
});

  return res
    .status(201)
    .json(new ApiResponse(201, populatedMessage, "Message sent"));
});

export {
  createConversation,
  getUserConversations,
  getConversationById,
  sendMessage,
};
