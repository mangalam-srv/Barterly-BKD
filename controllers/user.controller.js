import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {User} from "../models/user.models.js"


const registerUser = asyncHandler(async(req,res)=>{

//get user details from the frontend 
const {name,email,password,googleId }= req.body;
console.log("email",email);


//anything should not be empty
if(!name || !email || !password || !googleId){
    throw new ApiError(400,"fields are mandatory");
}
//check if the email and googleid contains @
if(!email.includes("@") || !googleId.includes("@")){
    throw new ApiError(400,"invalid mail");
}


//check if the username or email already exists
const existeduser = await User.findOne({
    $or:[{name},{email}]//this or helps that we can get as many as values
})
if(existeduser){
    throw new ApiError(409,"user already exist");
}


//create the user
const user = await User.create({
    name,
    email,
    password,
    googleId,
})


//remove the password
const createduser = await User.findById(user._id).select("-password");



//check if the user is created
if(!createduser){
    throw new ApiError(500,"server issue while creating the user")
}


//return the user
return res.status(201).json(
    new ApiResponse(200,createduser,"user registered successfully"),
)





})

export{registerUser};

