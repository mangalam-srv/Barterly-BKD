import dotenv from "dotenv"
dotenv.config({
    path:'./.env'
},{ override: true })//this does the work of importing the variabbles declared in the .envfile 
import  app  from "./app.js";


import express from "express";
import connectDB from "./db/index.js";



console.log(process.env.MONGODB_URI);

connectDB()
.then(()=>{
    app.listen(process.env.PORT||4000 ,()=>{
        console.log(`server is running at port ${process.env.PORT}`);
        
    })
})
.catch((err)=>{
    console.log("Mongo DB connection Failed",err);
    
})


