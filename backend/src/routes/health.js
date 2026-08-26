// src/routes/health.js — Health-check route.

const { Router } = require("express");
const prisma = require("../db");

const router = Router();

router.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "connected",
    });
  } catch (err) {
    // API is online even if DB is still warming up
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "connecting",
      warning: err.message,
    });
  }
});

module.exports = router;
