// src/routes/clinicalNotes.js — Configurable Clinical Notes & Template Management.
// All endpoints scoped to req.user.clinicId.

const { Router } = require("express");
const prisma = require("../db");
const { authenticate, authorize } = require("../middleware/auth");
const { CLINICAL_WRITE, canAccessAppointment } = require("../middleware/roles");

const router = Router();

const DEFAULT_MEDICAL_TEMPLATE = [
  { key: "symptoms", label: "Symptoms / Chief Complaint", type: "textarea" },
  { key: "diagnosis", label: "Diagnosis / Observations", type: "text" },
  { key: "prescription", label: "Prescription notes", type: "textarea" },
];

const VALID_FIELD_TYPES = ["text", "textarea", "number", "select", "tooth_chart"];

// ─── GET /api/clinics/template ────────────────────────────────
// Get logged-in clinic's note template.
router.get("/clinics/template", authenticate, async (req, res, next) => {
  try {
    const clinic = await prisma.clinic.findUnique({
      where: { id: req.user.clinicId },
      select: { settings: true },
    });

    const settings = clinic?.settings || {};
    const template = settings.note_template || DEFAULT_MEDICAL_TEMPLATE;

    res.json({ template });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/clinics/template ────────────────────────────────
// Admin-only: Update clinic's note template.
router.put("/clinics/template", authenticate, authorize("admin"), async (req, res, next) => {
  try {
    const { template } = req.body;

    if (!Array.isArray(template)) {
      return res.status(400).json({ error: "template must be an array of field definitions" });
    }

    // Validate each field in template
    const validatedTemplate = [];
    for (const field of template) {
      if (!field.key || !field.label || !field.type) {
        return res.status(400).json({ error: "Each template field requires key, label, and type" });
      }
      if (!VALID_FIELD_TYPES.includes(field.type)) {
        return res.status(400).json({
          error: `Invalid field type '${field.type}'. Allowed: ${VALID_FIELD_TYPES.join(", ")}`,
        });
      }

      validatedTemplate.push({
        key: String(field.key).toLowerCase().replace(/[^a-z0-9_]/g, "_"),
        label: String(field.label).trim(),
        type: field.type,
        options: Array.isArray(field.options) ? field.options.map(String) : [],
      });
    }

    // Get existing settings and merge note_template
    const clinic = await prisma.clinic.findUnique({
      where: { id: req.user.clinicId },
    });

    const currentSettings = clinic?.settings || {};
    const updatedSettings = {
      ...currentSettings,
      note_template: validatedTemplate,
    };

    const updated = await prisma.clinic.update({
      where: { id: req.user.clinicId },
      data: { settings: updatedSettings },
      select: { id: true, name: true, settings: true },
    });

    res.json({ template: updated.settings.note_template });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/visit-notes/appointment/:appointmentId ─────────
// Fetch visit note for a specific appointment.
router.get("/visit-notes/appointment/:appointmentId", authenticate, async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const clinicId = req.user.clinicId;

    const note = await prisma.visitNote.findFirst({
      where: { appointmentId, clinicId },
    });

    res.json(note || { appointmentId, templateData: {} });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/visit-notes ────────────────────────────────────
// Create or update visit note — doctors (own appts) + admins.
router.post("/visit-notes", authenticate, authorize(...CLINICAL_WRITE), async (req, res, next) => {
  try {
    const { appointmentId, templateData, prescriptions } = req.body;
    const clinicId = req.user.clinicId;

    if (!appointmentId) {
      return res.status(400).json({ error: "appointmentId is required" });
    }

    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, clinicId },
    });
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found in this clinic" });
    }
    if (!canAccessAppointment(req.user, appointment)) {
      return res.status(403).json({ error: "You can only write notes for your own appointments" });
    }

    const dataObj =
      typeof templateData === "object" && templateData !== null ? { ...templateData } : {};

    // Structured prescriptions array (optional)
    if (Array.isArray(prescriptions)) {
      dataObj.prescriptions = prescriptions
        .filter((p) => p && (p.drug || p.medicine))
        .map((p) => ({
          drug: String(p.drug || p.medicine || "").trim(),
          dose: String(p.dose || "").trim(),
          frequency: String(p.frequency || "").trim(),
          duration: String(p.duration || "").trim(),
          instructions: String(p.instructions || p.notes || "").trim(),
        }));
    }

    const note = await prisma.visitNote.upsert({
      where: { appointmentId },
      update: { templateData: dataObj },
      create: {
        clinicId,
        appointmentId,
        templateData: dataObj,
      },
    });

    res.status(200).json(note);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/visit-notes/patient/:patientId ─────────────────
// Get all past visit notes for a patient.
router.get("/visit-notes/patient/:patientId", authenticate, async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const clinicId = req.user.clinicId;

    const notes = await prisma.visitNote.findMany({
      where: {
        clinicId,
        appointment: { patientId },
      },
      include: {
        appointment: {
          select: {
            id: true,
            scheduledAt: true,
            status: true,
            staff: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ notes });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
