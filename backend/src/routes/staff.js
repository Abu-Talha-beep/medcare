// src/routes/staff.js — Staff management (admin-only).

const { Router } = require("express");
const bcrypt = require("bcryptjs");
const prisma = require("../db");
const { authenticate, authorize } = require("../middleware/auth");

const router = Router();
const SALT_ROUNDS = 10;

// All staff management routes require admin role.
router.use("/staff", authenticate, authorize("admin"));

// ─── GET /api/staff ───────────────────────────────────────────
// List all staff in the admin's clinic.
router.get("/staff", async (req, res, next) => {
  try {
    const staff = await prisma.staff.findMany({
      where: { clinicId: req.user.clinicId },
      select: {
        id: true,
        clinicId: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        synced: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(staff);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/staff ──────────────────────────────────────────
// Create a new staff member in the admin's clinic.
router.post("/staff", async (req, res, next) => {
  try {
    const { name, phone, role, password } = req.body;

    if (!name || !phone || !role || !password) {
      return res
        .status(400)
        .json({ error: "name, phone, role, and password are required" });
    }

    const validRoles = ["admin", "doctor", "receptionist"];
    if (!validRoles.includes(role)) {
      return res
        .status(400)
        .json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    // Check phone uniqueness within the clinic.
    const existing = await prisma.staff.findUnique({
      where: {
        clinicId_phone: {
          clinicId: req.user.clinicId,
          phone,
        },
      },
    });
    if (existing) {
      return res
        .status(409)
        .json({ error: "A staff member with this phone already exists in this clinic" });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const staff = await prisma.staff.create({
      data: {
        clinicId: req.user.clinicId,
        name,
        phone,
        role,
        passwordHash,
      },
      select: {
        id: true,
        clinicId: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    res.status(201).json(staff);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/staff/:id/reset-password ──────────────────────
// Admin resets another staff member's password.
router.patch("/staff/:id/reset-password", async (req, res, next) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "newPassword is required (min 6 characters)" });
    }

    // Ensure the target staff belongs to the admin's clinic.
    const target = await prisma.staff.findFirst({
      where: { id: req.params.id, clinicId: req.user.clinicId },
    });

    if (!target) {
      return res.status(404).json({ error: "Staff member not found" });
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.staff.update({
      where: { id: target.id },
      data: { passwordHash },
    });

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/staff/:id ─────────────────────────────────────
// Update staff name / role (not phone unique change for simplicity).
router.patch("/staff/:id", async (req, res, next) => {
  try {
    const { name, role } = req.body;
    const target = await prisma.staff.findFirst({
      where: { id: req.params.id, clinicId: req.user.clinicId },
    });
    if (!target) {
      return res.status(404).json({ error: "Staff member not found" });
    }

    const data = {};
    if (name !== undefined) data.name = String(name).trim();
    if (role !== undefined) {
      const validRoles = ["admin", "doctor", "receptionist"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` });
      }
      // Prevent removing the last admin
      if (target.role === "admin" && role !== "admin") {
        const adminCount = await prisma.staff.count({
          where: { clinicId: req.user.clinicId, role: "admin" },
        });
        if (adminCount <= 1) {
          return res.status(400).json({ error: "Cannot demote the last admin" });
        }
      }
      data.role = role;
    }

    const updated = await prisma.staff.update({
      where: { id: target.id },
      data,
      select: {
        id: true,
        clinicId: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
