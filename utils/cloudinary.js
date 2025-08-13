import {v2 as cloudinary}from "cloudinary";
import { log } from "console";
import fs from "fs"; 


cloudinary.config({ 
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
        api_key: process.env.CLOUDINARY_API_NAME, 
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });



    const uploadoncloudinary = async (localfilepath)=>{
    try {

        //if no file is provided
        if(!localfilepath)return null;

        //if file is provided
        const response = await cloudinary.uploader.upload(localfilepath,{resource_type:"auto"})

        console.log("file is successfully uploaded",cloudinary.url);
        
        return response;
        
    } catch (error) {

        fs.unlinkSync(localfilepath);
        return null;    
        
    }
}

export{uploadoncloudinary}; 