import express from "express";


const app = express();
app.use(express.json());


//import routes
import userRouter from "./routes/user.routes.js"
app.use("/api",userRouter );

export default app;
