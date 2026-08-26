// src/middleware/errorHandler.js — Global Express error handler.

module.exports = function errorHandler(err, _req, res, _next) {
  console.error("Unhandled error:", err);

  const status = err.status || 500;
  res.status(status).json({
    error: {
      message:
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : err.message,
      ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    },
  });
};
