import { ApiError } from "../utils/ApiError.js";

/**
 * Guards endpoints that only the Python AI service is allowed to call.
 *
 * - If AI_INTERNAL_API_KEY is configured, the caller MUST present a matching
 *   `x-internal-key` header (constant-time-ish compare).
 * - If it is NOT configured (local dev), only loopback callers are allowed, so
 *   the endpoint is never reachable from the public internet by default.
 *
 * The key is never logged.
 */
const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

const safeEqual = (a = "", b = "") => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export const internalOnly = (req, _res, next) => {
  const expected = process.env.AI_INTERNAL_API_KEY || "";

  if (expected) {
    const provided = req.headers["x-internal-key"] || "";
    if (!safeEqual(String(provided), expected)) {
      return next(new ApiError(401, "Not authorised for internal API"));
    }
    return next();
  }

  // No shared secret set — restrict to same-host callers.
  const ip = (req.ip || req.socket?.remoteAddress || "").replace(/^::ffff:/, "");
  if (LOOPBACK.has(req.ip) || LOOPBACK.has(ip) || ip.startsWith("127.")) {
    return next();
  }
  return next(new ApiError(401, "Internal API is restricted"));
};
