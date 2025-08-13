import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {Item} from "../models/item.models.js"
import{uploadoncloudinary} from "../utils/cloudinary.js";


const createitem = asyncHandler(async(req,res)=>{


    //get all the information
    const {title,description,listingType,location}=req.body;


    //check if the user has entered all the details
    if(!title || !description || !listingType || !location){
        throw new ApiError(400,"Every field is required");
    }


    //check for the image 
    const imagelocalpath = req.files?.image[0]?.path;
    if(!imagelocalpath){
        throw new ApiError(400,"image is required");
    }

    const image = await uploadoncloudinary(imagelocalpath);
    if(!image){
        throw new ApiError(400,"image is requried");
    }

    //create the item 
    const item = await Item.create({
        title,
        description,
        listingType,
        location,
        image: image.url, // Store Cloudinary URL
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


export{createitem};