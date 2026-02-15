// controllers/item.controller.js
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import Item from "../models/item.models.js";
import { uploadoncloudinary } from "../utils/cloudinary.js";

// ✅ CREATE ITEM
const createitem = asyncHandler(async (req, res) => {
  const { title, description, listingType, location } = req.body;

  // ✅ Validate required fields
  if (!title || !description || !listingType || !location) {
    throw new ApiError(
      400,
      "Title, description, listing type, and location are required"
    );
  }

  // ✅ Validate listing type enum
  const validListingTypes = ["Barter", "Both", "Rent"];
  if (!validListingTypes.includes(listingType)) {
    throw new ApiError(
      400,
      `Listing type must be one of: ${validListingTypes.join(", ")}`
    );
  }

  // ✅ Check for uploaded image
  const imagelocalpath = req.files?.image?.[0]?.path;
  if (!imagelocalpath) {
    throw new ApiError(400, "Image is required for listing");
  }

  // ✅ Verify user is authenticated
  if (!req.user || !req.user._id) {
    throw new ApiError(401, "User authentication required");
  }

  // ✅ Upload to Cloudinary
  const image = await uploadoncloudinary(imagelocalpath);
  if (!image || !image.url) {
    throw new ApiError(500, "Failed to upload image to Cloudinary");
  }

  // ✅ Trim string fields
  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();
  const trimmedLocation = location.trim();

  // ✅ Validate field lengths
  if (trimmedTitle.length < 3 || trimmedTitle.length > 100) {
    throw new ApiError(400, "Title must be between 3 and 100 characters");
  }

  if (trimmedDescription.length < 10 || trimmedDescription.length > 2000) {
    throw new ApiError(
      400,
      "Description must be between 10 and 2000 characters"
    );
  }

  // ✅ Create item
  const item = await Item.create({
    title: trimmedTitle,
    description: trimmedDescription,
    listingType,
    location: trimmedLocation,
    image: image.url,
    owner: req.user._id,
  });

  // ✅ Populate owner details
  await item.populate("owner", "-password");

  return res
    .status(201)
    .json(new ApiResponse(201, item, "Item listing created successfully"));
});

// ✅ DELETE ITEM
const deleteItem = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // ✅ Validate item ID
  if (!id) {
    throw new ApiError(400, "Item ID is required");
  }

  // ✅ Verify user is authenticated
  if (!req.user || !req.user._id) {
    throw new ApiError(401, "User authentication required");
  }

  // ✅ Find item
  const item = await Item.findById(id);
  if (!item) {
    throw new ApiError(404, "Item not found");
  }

  // ✅ Check authorization (only owner can delete)
  if (item.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to delete this item");
  }

  // ✅ Delete item
  await Item.findByIdAndDelete(id);

  return res
    .status(200)
    .json(
      new ApiResponse(200, { deletedItemId: id }, "Item deleted successfully")
    );
});

// ✅ GET ALL ITEMS
const getAllItems = asyncHandler(async (req, res) => {
  try {
    // ✅ Query parameters for filtering and pagination
    const { page = 1, limit = 10, listingType, location, search } = req.query;

    // ✅ Build filter query
    const filter = {};
    if (listingType) filter.listingType = listingType;
    if (location) filter.location = new RegExp(location, "i"); // Case-insensitive search
    if (search) {
      filter.$or = [
        { title: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
      ];
    }

    // ✅ Calculate pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // ✅ Fetch items with pagination and populate owner details
    const items = await Item.find(filter)
      .populate("owner", "-password")
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skip);

    // ✅ Get total count for pagination
    const total = await Item.countDocuments(filter);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          items,
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
          },
        },
        "Items retrieved successfully"
      )
    );
  } catch (error) {
    throw new ApiError(500, "Failed to retrieve items: " + error.message);
  }
});

// ✅ GET ITEM BY ID
const getItemById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, "Item ID is required");
  }

  const item = await Item.findById(id).populate("owner", "-password");

  if (!item) {
    throw new ApiError(404, "Item not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, item, "Item retrieved successfully"));
});

// ✅ GET ITEMS BY USER
const getUserItems = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  if (!userId) {
    throw new ApiError(400, "User ID is required");
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;

  const items = await Item.find({ owner: userId })
    .populate("owner", "-password")
    .sort({ createdAt: -1 })
    .limit(limitNum)
    .skip(skip);

  const total = await Item.countDocuments({ owner: userId });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        items,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      },
      "User items retrieved successfully"
    )
  );
});

// ✅ UPDATE ITEM (only owner)
const updateItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, description, listingType, location } = req.body;

  if (!id) {
    throw new ApiError(400, "Item ID is required");
  }

  if (!req.user || !req.user._id) {
    throw new ApiError(401, "User authentication required");
  }

  const item = await Item.findById(id);
  if (!item) {
    throw new ApiError(404, "Item not found");
  }

  // ✅ Check authorization
  if (item.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to update this item");
  }

  // ✅ Update fields
  if (title) {
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 3 || trimmedTitle.length > 100) {
      throw new ApiError(400, "Title must be between 3 and 100 characters");
    }
    item.title = trimmedTitle;
  }

  if (description) {
    const trimmedDescription = description.trim();
    if (trimmedDescription.length < 10 || trimmedDescription.length > 2000) {
      throw new ApiError(
        400,
        "Description must be between 10 and 2000 characters"
      );
    }
    item.description = trimmedDescription;
  }

  if (listingType) {
    const validListingTypes = ["Barter", "Both", "Rent"];
    if (!validListingTypes.includes(listingType)) {
      throw new ApiError(
        400,
        `Listing type must be one of: ${validListingTypes.join(", ")}`
      );
    }
    item.listingType = listingType;
  }

  if (location) {
    item.location = location.trim();
  }

  await item.save();
  await item.populate("owner", "-password");

  return res
    .status(200)
    .json(new ApiResponse(200, item, "Item updated successfully"));
});

export {
  createitem,
  deleteItem,
  getAllItems,
  getItemById,
  getUserItems,
  updateItem,
};
