// src/routes/health.js — Health-check route.

const { Router } = require("express");
const prisma = require("../db");

const router = Router();

router.get("/health", async (_req, res) => {
  try {
    // Quick DB connectivity check.
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "connected",
    });
  } catch (err) {
    res.status(503).json({
      status: "error",
      timestamp: new Date().toISOString(),
      database: "disconnected",
      message: err.message,
    });
  }
});

module.exports = router;
