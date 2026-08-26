// src/config.js — Centralised, env-based configuration.
// Switch between local and cloud Postgres by changing DATABASE_URL in .env.

require("dotenv").config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 4000,
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  isDev: (process.env.NODE_ENV || "development") === "development",
  jwtSecret: process.env.JWT_SECRET || "fallback-dev-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
};
