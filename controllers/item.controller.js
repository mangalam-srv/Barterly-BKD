import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import Item from "../models/item.models.js";
import { uploadoncloudinary } from "../utils/cloudinary.js";
import User from "../models/user.models.js";

const ITEM_LISTING_TYPES = ["Barter", "Both", "Rent"];

const isValidItemId = (id) => mongoose.Types.ObjectId.isValid(id);

const buildPaginationMeta = (totalItems, page, limit) => {
  if (!limit) {
    return {
      totalItems,
      page: 1,
      limit: null,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    };
  }

  const totalPages = Math.max(Math.ceil(totalItems / limit), 1);

  return {
    totalItems,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

const parsePagination = (query) => {
  const hasPage = query.page !== undefined;
  const hasLimit = query.limit !== undefined;

  if (!hasPage && !hasLimit) {
    return { page: 1, limit: null };
  }

  const page = hasPage ? Number.parseInt(query.page, 10) : 1;
  const limit = hasLimit ? Number.parseInt(query.limit, 10) : null;

  if (
    (hasPage && (!Number.isInteger(page) || page < 1)) ||
    (hasLimit && (!Number.isInteger(limit) || limit < 1))
  ) {
    throw new ApiError(400, "Invalid pagination parameters");
  }

  return { page, limit };
};

const populateOwner = (query) => query.populate("owner", "-password");

const collectItemUpdates = (body) => {
  const updates = {};

  if (body.title !== undefined) {
    const title = body.title.trim();
    if (!title) {
      throw new ApiError(400, "Title cannot be empty");
    }
    updates.title = title;
  }

  if (body.description !== undefined) {
    const description = body.description.trim();
    if (!description) {
      throw new ApiError(400, "Description cannot be empty");
    }
    updates.description = description;
  }

  if (body.listingType !== undefined) {
    const listingType = body.listingType.trim();
    if (!listingType) {
      throw new ApiError(400, "Listing type cannot be empty");
    }
    if (!ITEM_LISTING_TYPES.includes(listingType)) {
      throw new ApiError(
        400,
        "Listing type must be one of Barter, Both, or Rent"
      );
    }
    updates.listingType = listingType;
  }

  if (body.location !== undefined) {
    const location = body.location.trim();
    if (!location) {
      throw new ApiError(400, "Location cannot be empty");
    }
    updates.location = location;
  }

  return updates;
};

const createitem = asyncHandler(async (req, res) => {
  const { title, description, listingType, location, ownerId } = req.body;

  if (!title || !description || !listingType || !location) {
    throw new ApiError(
      400,
      "Title, description, listing type, and location are required"
    );
  }

  const normalizedTitle = title.trim();
  const normalizedDescription = description.trim();
  const normalizedListingType = listingType.trim();
  const normalizedLocation = location.trim();

  if (
    !normalizedTitle ||
    !normalizedDescription ||
    !normalizedListingType ||
    !normalizedLocation
  ) {
    throw new ApiError(
      400,
      "Title, description, listing type, and location are required"
    );
  }

  if (!ITEM_LISTING_TYPES.includes(normalizedListingType)) {
    throw new ApiError(
      400,
      "Listing type must be one of Barter, Both, or Rent"
    );
  }

  const existingItem = await Item.findOne({ title: normalizedTitle });
  if (existingItem) {
    throw new ApiError(
      400,
      `An item with the title "${normalizedTitle}" already exists`
    );
  }

  const imageLocalPath = req.files?.image?.[0]?.path;
  if (!imageLocalPath) {
    throw new ApiError(400, "1 image is required");
  }

  const image = await uploadoncloudinary(imageLocalPath);
  if (!image?.url) {
    throw new ApiError(500, "Image upload to Cloudinary failed");
  }

  const owner = req.user?._id || ownerId;
  if (!owner) {
    throw new ApiError(400, "Owner ID missing (login required)");
  }

  const item = await Item.create({
    title: normalizedTitle,
    description: normalizedDescription,
    listingType: normalizedListingType,
    location: normalizedLocation,
    image: image.url,
    owner,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, item, "Item registered successfully"));
});

const getAllItems = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const filter = {};
  const totalItems = await Item.countDocuments(filter);

  const query = populateOwner(Item.find(filter).sort({ createdAt: -1 }));

  if (limit) {
    query.skip((page - 1) * limit).limit(limit);
  }

  const items = await query;
 




  return res.status(200).json(
    new ApiResponse(
      200,
      {
        items,
        pagination: buildPaginationMeta(totalItems, page, limit),
      },
      "Items fetched successfully"
    )
  );
});

const getSingleItem = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, "Item ID is required");
  }

  if (!isValidItemId(id)) {
    throw new ApiError(400, "Invalid item ID");
  }

  const item = await populateOwner(Item.findById(id));

  if (!item) {
    throw new ApiError(404, "Item not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, item, "Item fetched successfully"));
});

const getMyItems = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const filter = { owner: req.user._id };
  const totalItems = await Item.countDocuments(filter);

  const query = populateOwner(Item.find(filter).sort({ createdAt: -1 }));

  if (limit) {
    query.skip((page - 1) * limit).limit(limit);
  }

  const items = await query;
  

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        items,
        pagination: buildPaginationMeta(totalItems, page, limit),
      },
      "My items fetched successfully"
    )
  );
});

const updateItem = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, "Item ID is required");
  }

  if (!isValidItemId(id)) {
    throw new ApiError(400, "Invalid item ID");
  }

  const item = await Item.findById(id);
  if (!item) {
    throw new ApiError(404, "Item not found");
  }

  if (item.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to update this item");
  }

  const updates = collectItemUpdates(req.body);
  const imageLocalPath = req.files?.image?.[0]?.path;

  if (!Object.keys(updates).length && !imageLocalPath) {
    throw new ApiError(400, "At least one field must be provided for update");
  }

  if (updates.title && updates.title !== item.title) {
    const existingItem = await Item.findOne({
      title: updates.title,
      _id: { $ne: item._id },
    });

    if (existingItem) {
      throw new ApiError(
        400,
        `An item with the title "${updates.title}" already exists`
      );
    }
  }

  if (imageLocalPath) {
    const image = await uploadoncloudinary(imageLocalPath);
    if (!image?.url) {
      throw new ApiError(500, "Image upload to Cloudinary failed");
    }
    updates.image = image.url;
  }

  const updatedItem = await populateOwner(
    Item.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    })
  );

  if (!updatedItem) {
    throw new ApiError(404, "Item not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedItem, "Item updated successfully"));
});

const deleteItem = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, "Item ID is required");
  }

  if (!isValidItemId(id)) {
    throw new ApiError(400, "Invalid item ID");
  }

  const item = await Item.findById(id);
  if (!item) {
    throw new ApiError(404, "Item not found");
  }

  if (item.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to delete this item");
  }

  await Item.findByIdAndDelete(id);

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Item deleted successfully"));
});

export {
  createitem,
  getAllItems,
  getSingleItem,
  getMyItems,
  updateItem,
  deleteItem,
};
