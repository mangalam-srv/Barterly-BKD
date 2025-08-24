import express from "express";


const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


import aiRoutes from "./routes/ai.routes.js";

app.use("/api/ai", aiRoutes);


//import routes
import userRouter from "./routes/user.routes.js"
app.use("/api/v1/users", userRouter);


import itemRouter from "./routes/item.routes.js"
app.use("/api/v1/items", itemRouter);

export default app;
