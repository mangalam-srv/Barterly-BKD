import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import User from "../models/user.models.js";
import { generateToken } from "../utils/jwt.js";

const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

const buildLoginRedirectUrl = (params = {}) => {
  const search = new URLSearchParams(params);
  return `${clientUrl}/#/login?${search.toString()}`;
};

const normalizeGoogleProfile = (profile) => ({
  googleId: profile?.id,
  email: profile?.emails?.[0]?.value?.trim().toLowerCase(),
  name: profile?.displayName?.trim() || "Google User",
  avatar: profile?.photos?.[0]?.value || "",
});

const completeGoogleLogin = asyncHandler(async (req, res) => {
  try {


    if (!req.user) {
      throw new ApiError(401, "Google authentication failed");
    }

    const { googleId, email, name, avatar } =
      normalizeGoogleProfile(req.user);

    if (!googleId || !email) {
      throw new ApiError(400, "Google account email not found");
    }

    let user = await User.findOne({
      $or: [
        { googleId },
        { email },
      ],
    });

    if (!user) {

      user = await User.create({
        name,
        email,
        googleId,
        avatar,
        provider: "google",
      });
    } else {

      const updates = {};

      if (!user.googleId)
        updates.googleId = googleId;

      if (user.provider !== "google")
        updates.provider = "google";

      if (!user.avatar && avatar)
        updates.avatar = avatar;

      if (Object.keys(updates).length) {
        user = await User.findByIdAndUpdate(
          user._id,
          updates,
          { new: true }
        );
      }
    }

    const token = generateToken(user._id);

    const responseUser = {
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      provider: user.provider,
      googleId: user.googleId,
    };


    return res.redirect(
      buildLoginRedirectUrl({
        oauthToken: token,
        oauthUser: JSON.stringify(responseUser),
      })
    );
  } catch (err) {
    console.error("GOOGLE LOGIN ERROR");
    console.error(err);

    return res.redirect(
      buildLoginRedirectUrl({
        oauthError: "google_login_failed",
      })
    );
  }
});

const getGoogleLoginFailure = asyncHandler(async (req, res) => {
  return res.redirect(
    buildLoginRedirectUrl({
      oauthError: "google_login_failed",
    })
  );
});

export {
  completeGoogleLogin,
  getGoogleLoginFailure,
};