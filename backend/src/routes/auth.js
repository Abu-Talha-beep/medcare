// src/routes/auth.js — Login, setup (first admin), and session routes.

const { Router } = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../db");
const config = require("../config");
const { authenticate } = require("../middleware/auth");

const router = Router();
const SALT_ROUNDS = 10;

/**
 * Helper: sign a JWT for a staff member.
 */
function signToken(staff) {
  return jwt.sign(
    { sub: staff.id, clinicId: staff.clinicId, role: staff.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

/**
 * Helper: return a safe user profile (no password hash).
 */
function toProfile(staff) {
  return {
    id: staff.id,
    clinicId: staff.clinicId,
    name: staff.name,
    phone: staff.phone,
    role: staff.role,
  };
}

// ─── POST /api/auth/login ─────────────────────────────────────
// Public. Authenticate via phone + password, return JWT.
router.post("/auth/login", async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: "Phone and password are required" });
    }

    // Find staff by phone (across any clinic — single-tenant for now).
    const staff = await prisma.staff.findFirst({
      where: { phone },
    });

    if (!staff) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, staff.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = signToken(staff);

    res.json({ token, user: toProfile(staff) });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────
// Authenticated. Return the current user's profile.
router.get("/auth/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});

// ─── POST /api/auth/setup ─────────────────────────────────────
// Public (one-time). Create the first admin for a clinic.
// Blocked (409) if any staff already exist in that clinic.
router.post("/auth/setup", async (req, res, next) => {
  try {
    const { clinicId, name, phone, password } = req.body;

    if (!clinicId || !name || !phone || !password) {
      return res.status(400).json({
        error: "clinicId, name, phone, and password are all required",
      });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    // Verify the clinic exists.
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
    });
    if (!clinic) {
      return res.status(404).json({ error: "Clinic not found" });
    }

    // Block if staff already exist for this clinic.
    const existing = await prisma.staff.count({
      where: { clinicId },
    });
    if (existing > 0) {
      return res.status(409).json({
        error:
          "Setup already completed — staff members exist. Use login instead.",
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const admin = await prisma.staff.create({
      data: {
        clinicId,
        name,
        phone,
        role: "admin",
        passwordHash,
      },
    });

    const token = signToken(admin);

    res.status(201).json({ token, user: toProfile(admin) });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/auth/setup-status ───────────────────────────────
// Public. Check if setup is needed (no staff exist for the given clinic).
router.get("/auth/setup-status", async (req, res, next) => {
  try {
    const { clinicId } = req.query;
    if (!clinicId) {
      return res.status(400).json({ error: "clinicId query param required" });
    }

    const count = await prisma.staff.count({ where: { clinicId } });

    res.json({ setupRequired: count === 0 });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
