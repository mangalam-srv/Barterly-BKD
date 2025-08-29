import express from "express";


const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
import session from "express-session";
import passport from "passport";
import GoogleStrategy from "passport-google-oauth20"

app.use(session({
    secret:"secret",
    resave:false,
    saveUninitialized:true,

}))

passport.use(new GoogleStrategy ({
    clientID : process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:'http://localhost:4000/auth/google/callback',

},(accessToken,refreshToken,profile,done)=>{
    return done(null,profile);
}
))



app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user,done)=>done(null,user));

passport.deserializeUser((user,done)=>done(null,user));
import aiRoutes from "./routes/ai.routes.js";

app.use("/api/ai", aiRoutes);


//import routes
import userRouter from "./routes/user.routes.js"
app.use("/api/v1/users", userRouter);


import itemRouter from "./routes/item.routes.js"
app.use("/api/v1/items", itemRouter);


import authRoutes from "./routes/auth.routes.js";
app.use("/auth", authRoutes);

export default app;
