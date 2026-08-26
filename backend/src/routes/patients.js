// src/routes/patients.js — Patient CRUD + search with duplicate detection.
// All routes scoped to req.user.clinicId (set by authenticate middleware).

const { Router } = require("express");
const prisma = require("../db");
const { authenticate, authorize } = require("../middleware/auth");
const { FRONT_DESK, CLINICAL_WRITE } = require("../middleware/roles");

const router = Router();

router.use("/patients", authenticate);

// ─── GET /api/patients ────────────────────────────────────────
// List patients for the logged-in user's clinic.
// Supports ?page=1&limit=50 pagination.
router.get("/patients", async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where: { clinicId: req.user.clinicId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.patient.count({
        where: { clinicId: req.user.clinicId },
      }),
    ]);

    res.json({
      patients,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/patients/search ─────────────────────────────────
// Search by name (partial), phone (partial), or CNIC (exact).
// Query: ?q=searchTerm
router.get("/patients/search", async (req, res, next) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) {
      return res.json({ patients: [] });
    }

    const clinicId = req.user.clinicId;

    // Determine search strategy based on input.
    // If it looks like a CNIC (digits with optional dashes, 13-15 chars), do exact match.
    const cnicPattern = /^[\d-]{5,15}$/;
    const isCnic = cnicPattern.test(q) && q.replace(/-/g, "").length >= 13;

    let patients;

    if (isCnic) {
      // Exact CNIC match.
      const normalised = q.replace(/-/g, "");
      patients = await prisma.patient.findMany({
        where: {
          clinicId,
          cnic: normalised,
        },
        take: 20,
      });
    } else {
      // Partial match on name or phone.
      patients = await prisma.patient.findMany({
        where: {
          clinicId,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
          ],
        },
        orderBy: { name: "asc" },
        take: 20,
      });
    }

    res.json({ patients });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/patients/:id ────────────────────────────────────
// Get a single patient by ID, scoped to clinic.
router.get("/patients/:id", async (req, res, next) => {
  try {
    const patient = await prisma.patient.findFirst({
      where: { id: req.params.id, clinicId: req.user.clinicId },
    });
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }
    res.json(patient);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/patients ──────────────────────────────────────
router.post("/patients", authorize(...FRONT_DESK), async (req, res, next) => {
  try {
    const {
      name, phone, cnic, dateOfBirth, gender, address, familyGroupId,
      allergies, chronicConditions, currentMedications,
    } = req.body;

    if (!name || !phone) {
      return res
        .status(400)
        .json({ error: "Name and phone are required" });
    }

    const clinicId = req.user.clinicId;

    // ── Duplicate detection ──────────────────────────────────
    const duplicates = [];

    // Check phone.
    const phoneMatch = await prisma.patient.findFirst({
      where: { clinicId, phone },
      select: { id: true, name: true, phone: true, cnic: true },
    });
    if (phoneMatch) {
      duplicates.push({
        field: "phone",
        message: `Patient "${phoneMatch.name}" already has this phone number`,
        existingPatient: phoneMatch,
      });
    }

    // Check CNIC if provided.
    if (cnic) {
      const normalised = cnic.replace(/-/g, "");
      const cnicMatch = await prisma.patient.findFirst({
        where: { clinicId, cnic: normalised },
        select: { id: true, name: true, phone: true, cnic: true },
      });
      if (cnicMatch) {
        duplicates.push({
          field: "cnic",
          message: `Patient "${cnicMatch.name}" already has this CNIC`,
          existingPatient: cnicMatch,
        });
      }
    }

    // If duplicates found and client didn't confirm, return warning.
    if (duplicates.length > 0 && !req.body.confirmDuplicate) {
      return res.status(409).json({
        error: "Potential duplicate(s) found",
        duplicates,
        hint: "Send confirmDuplicate: true to register anyway",
      });
    }

    // Validate gender if provided.
    const validGenders = ["male", "female", "other"];
    if (gender && !validGenders.includes(gender)) {
      return res
        .status(400)
        .json({ error: `Invalid gender. Must be one of: ${validGenders.join(", ")}` });
    }

    const patient = await prisma.patient.create({
      data: {
        clinicId,
        name,
        phone,
        cnic: cnic ? cnic.replace(/-/g, "") : null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender: gender || null,
        address: address || null,
        familyGroupId: familyGroupId || null,
        allergies: allergies || null,
        chronicConditions: chronicConditions || null,
        currentMedications: currentMedications || null,
      },
    });

    res.status(201).json(patient);
  } catch (err) {
    // Handle unique constraint violation on CNIC.
    if (err.code === "P2002") {
      return res.status(409).json({
        error: "A patient with this CNIC already exists in this clinic",
      });
    }
    next(err);
  }
});

// ─── PATCH /api/patients/:id ──────────────────────────────────
router.patch("/patients/:id", async (req, res, next) => {
  try {
    const clinicId = req.user.clinicId;
    const role = req.user.role;

    const existing = await prisma.patient.findFirst({
      where: { id: req.params.id, clinicId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const {
      name, phone, cnic, dateOfBirth, gender, address, familyGroupId,
      allergies, chronicConditions, currentMedications,
    } = req.body;

    const validGenders = ["male", "female", "other"];
    if (gender && !validGenders.includes(gender)) {
      return res
        .status(400)
        .json({ error: `Invalid gender. Must be one of: ${validGenders.join(", ")}` });
    }

    const data = {};

    // Front desk + admin: demographics
    if (FRONT_DESK.includes(role)) {
      if (name !== undefined) data.name = name;
      if (phone !== undefined) data.phone = phone;
      if (cnic !== undefined) data.cnic = cnic ? cnic.replace(/-/g, "") : null;
      if (dateOfBirth !== undefined)
        data.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
      if (gender !== undefined) data.gender = gender || null;
      if (address !== undefined) data.address = address || null;
      if (familyGroupId !== undefined)
        data.familyGroupId = familyGroupId || null;
    }

    // Doctor + admin: clinical chart
    if (CLINICAL_WRITE.includes(role)) {
      if (allergies !== undefined) data.allergies = allergies || null;
      if (chronicConditions !== undefined)
        data.chronicConditions = chronicConditions || null;
      if (currentMedications !== undefined)
        data.currentMedications = currentMedications || null;
    }

    if (Object.keys(data).length === 0) {
      return res.status(403).json({ error: "No permitted fields to update for your role" });
    }

    const updated = await prisma.patient.update({
      where: { id: req.params.id },
      data,
    });

    res.json(updated);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({
        error: "A patient with this CNIC already exists in this clinic",
      });
    }
    next(err);
  }
});

module.exports = router;
