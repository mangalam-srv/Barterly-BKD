import { ApiError } from "../utils/ApiError.js";

/**
 * Central error handler. Converts thrown ApiError instances (and any stray
 * errors) into the project's standard JSON envelope instead of leaking HTML
 * stack traces to the client.
 *
 * Registered as the LAST middleware in app.js.
 */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  const isApiError = err instanceof ApiError;
  const statusCode = Number.isInteger(err?.statusCode) ? err.statusCode : 500;

  const payload = {
    statusCode,
    success: false,
    message: isApiError || err?.message ? err.message : "Internal server error",
    errors: err?.errors || [],
  };

  if (process.env.NODE_ENV !== "production" && !isApiError) {
    payload.stack = err?.stack;
    // Log unexpected (non-ApiError) failures for debugging.
    console.error("Unhandled error:", err);
  }

  res.status(statusCode).json(payload);
};

/** 404 fallback for unmatched routes, kept consistent with the error envelope. */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    statusCode: 404,
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    errors: [],
  });
};
