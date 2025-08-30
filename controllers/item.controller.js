// controllers/item.controller.js
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import Item from "../models/item.models.js";
import { uploadoncloudinary } from "../utils/cloudinary.js";

// CREATE ITEM
const createitem = asyncHandler(async (req, res) => {
  try {
    const { title, description, listingType, location, ownerId } = req.body;

    // Validate required fields
    if (!title || !description || !listingType || !location) {
      throw new ApiError(
        400,
        "Title, description, listing type, and location are required"
      );
    }

    // Validate image
    const imagelocalpath = req.files?.image?.[0]?.path;
    if (!imagelocalpath) {
      throw new ApiError(400, "1 image is required");
    }
    console.log("IMAGE LOCAL PATH:", imagelocalpath);

    // Upload to Cloudinary
    const image = await uploadoncloudinary(imagelocalpath);
    if (!image || !image.url) {
      throw new ApiError(500, "Image upload to Cloudinary failed");
    }

    // ✅ Owner comes from logged-in user, or fallback for Postman testing
    const owner = req.user?._id || ownerId;
    if (!owner) {
      throw new ApiError(400, "Owner ID missing (login required)");
    }

    // Create item
    const item = await Item.create({
      title,
      description,
      listingType,
      location,
      image: image.url,
      owner,
    });

    return res
      .status(201)
      .json(new ApiResponse(201, item, "Item registered successfully"));
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.title) {
      throw new ApiError(
        400,
        `An item with the title "${req.body.title}" already exists`
      );
    }

    console.error("Error creating item:", error);
    throw new ApiError(500, "Something went wrong while registering the item");
  }
});

// DELETE ITEM
const deleteItem = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, "Item ID is required");
  }

  const item = await Item.findById(id);
  if (!item) {
    throw new ApiError(404, "Item not found");
  }

  // ✅ Check authorization
  if (req.user && item.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to delete this item");
  }

  await Item.findByIdAndDelete(id);

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Item deleted successfully"));
});

export { createitem, deleteItem };
