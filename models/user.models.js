const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true
    },
    password: {
      type: String,
      // password will be null for Google login users
    },
    googleId: {
      type: String, // For Google OAuth users
    },
    location:{
        type: String, 
        default: "",//initially it is set to empty later it will change in the profile settings 
    }
    
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
