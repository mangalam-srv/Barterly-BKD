import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import Item from "../models/item.models.js"
import{uploadoncloudinary} from "../utils/cloudinary.js";

//CREATE ITEM
const createitem = asyncHandler(async(req,res)=>{


    //get all the information
    const {title,description,listingType,location}=req.body;


    //check if the user has entered all the details
    if(!title || !description || !listingType || !location){
        throw new ApiError(400,"Every field is required");
    }


    // //check for the image 
    // const imagelocalpath = req.files?.image[0]?.path;
    // if(!imagelocalpath){
    //     throw new ApiError(400," 1 image is required");
    // }
    // console.log("IMAGE LOCAL PATH:",imagelocalpath);
    

    // const image= await uploadoncloudinary(imagelocalpath);
    // if(!image||!image.url){
    //      throw new ApiError(500,"Image upload to Cloudinary failed");
    // }

    //create the item 
    const item = await Item.create({
        title,
        description,
        listingType,
        location,
        // image: image.url, // Store Cloudinary URL
        
        owner: req.user._id // Store user who created the item
    })


    const createdItem = await Item.findById(item._id);


    //check for item creation
    if(!createdItem){
        throw new ApiError(500,"something went wrong while registering the item");
    }


    //return the item
    return res.status(201).json(
        new ApiResponse(200,createdItem,"Item registered successfully")
    )






})




// DELETE ITEM
const deleteItem = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check if ID is provided
    if (!id) {
        throw new ApiError(400, "Item ID is required");
    }

    // Find the item
    const item = await Item.findById(id);

    if (!item) {
        throw new ApiError(404, "Item not found");
    }

    // Check if the logged-in user is the owner of the item
    if (item.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this item");
    }

    // Delete the item
    await Item.findByIdAndDelete(id);

    return res.status(200).json(
        new ApiResponse(200, null, "Item deleted successfully")
    );
});

export { createitem, deleteItem };




