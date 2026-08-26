// src/routes/clinics.js — Clinic profile + module toggles.

const { Router } = require("express");
const prisma = require("../db");
const { authenticate, authorize } = require("../middleware/auth");

const router = Router();

router.use("/clinics", authenticate);

const DEFAULT_MODULES = {
  patients: true,
  appointments: true,
  billing: true,
  inventory: true,
};

// GET /api/clinics/me
router.get("/clinics/me", async (req, res, next) => {
  try {
    const clinic = await prisma.clinic.findUnique({
      where: { id: req.user.clinicId },
    });
    if (!clinic) return res.status(404).json({ error: "Clinic not found" });
    res.json(clinic);
  } catch (err) {
    next(err);
  }
});

// GET /api/clinics/modules
router.get("/clinics/modules", async (req, res, next) => {
  try {
    const clinic = await prisma.clinic.findUnique({
      where: { id: req.user.clinicId },
      select: { settings: true },
    });
    const settings = clinic?.settings || {};
    const modules = settings.enabled_modules || DEFAULT_MODULES;
    res.json({ modules });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/clinics/modules — admin only
router.patch("/clinics/modules", authorize("admin"), async (req, res, next) => {
  try {
    const { modules } = req.body;
    if (!modules || typeof modules !== "object") {
      return res.status(400).json({ error: "modules object is required" });
    }

    const clinic = await prisma.clinic.findUnique({
      where: { id: req.user.clinicId },
    });
    const currentSettings = clinic?.settings || {};
    const updatedSettings = {
      ...currentSettings,
      enabled_modules: {
        ...(currentSettings.enabled_modules || DEFAULT_MODULES),
        ...modules,
      },
    };

    const updated = await prisma.clinic.update({
      where: { id: req.user.clinicId },
      data: { settings: updatedSettings },
      select: { id: true, name: true, settings: true },
    });

    res.json({ modules: updated.settings.enabled_modules });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
