import {v2 as cloudinary}from "cloudinary";
import fs from "fs"; //this helps t read write remove the file
import { log } from "console";
import dotenv from "dotenv";





cloudinary.config({ 
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
        api_key: process.env.CLOUDINARY_API_KEY, 
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });


console.log("✅ Cloudinary Connected");



    const uploadoncloudinary = async (localfilepath)=>{
    
     
     try {
         //if no file is provided
            if(!localfilepath)return null;




       

        //if file is provided
        const response = await cloudinary.uploader.upload(localfilepath,{resource_type:"auto"})

       
        
        return response;
        
    } catch (error) {

        fs.unlinkSync(localfilepath);//remove the locally saved file  as the upload got failed
        return null;    
        
    }
}

export{uploadoncloudinary}; 