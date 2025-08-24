import {v2 as cloudinary}from "cloudinary";
import fs from "fs"; //this helps t read write remove the file
import { log } from "console";
import dotenv from "dotenv";


dotenv.config();



cloudinary.config({ 
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
        api_key: process.env.CLOUDINARY_API_KEY, 
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });


    console.log("Cloudinary loaded:", {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY ? "loaded" : "missing"
});



    const uploadoncloudinary = async (localfilepath)=>{
    
     
     try {
         //if no file is provided
            if(!localfilepath)return null;


            console.log("Uploading file:", localfilepath);
            console.log("Cloudinary config:", cloudinary.config());


       

        //if file is provided
        const response = await cloudinary.uploader.upload(localfilepath,{resource_type:"auto"})

        console.log("file is successfully uploaded",cloudinary.url);
        
        return response;
        
    } catch (error) {

        fs.unlinkSync(localfilepath);//remove the locally saved file  as the upload got failed
        return null;    
        
    }
}

export{uploadoncloudinary}; 