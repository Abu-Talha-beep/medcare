// src/routes/appointments.js — Appointment CRUD, today's queue, status transitions.

const { Router } = require("express");
const prisma = require("../db");
const { authenticate, authorize } = require("../middleware/auth");
const {
  FRONT_DESK,
  resolveStaffScope,
  canAccessAppointment,
  isDoctor,
} = require("../middleware/roles");

const router = Router();

router.use("/appointments", authenticate);

const VALID_STATUSES = ["waiting", "in_progress", "done", "cancelled", "no_show"];

const TRANSITIONS = {
  waiting: ["in_progress", "cancelled", "no_show"],
  in_progress: ["done", "cancelled"],
  done: [],
  cancelled: [],
  no_show: [],
};

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

async function loadAppointment(id, clinicId) {
  return prisma.appointment.findFirst({
    where: { id, clinicId },
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          phone: true,
          cnic: true,
          dateOfBirth: true,
          gender: true,
          address: true,
          allergies: true,
          chronicConditions: true,
          currentMedications: true,
        },
      },
      staff: { select: { id: true, name: true, role: true } },
      visitNote: true,
    },
  });
}

// GET /api/appointments/today
router.get("/appointments/today", async (req, res, next) => {
  try {
    const { start, end } = todayRange();
    const clinicId = req.user.clinicId;
    const staffId = resolveStaffScope(req.user, req.query.staffId);

    const where = {
      clinicId,
      scheduledAt: { gte: start, lt: end },
    };
    if (staffId) where.staffId = staffId;

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: { select: { id: true, name: true, phone: true } },
        staff: { select: { id: true, name: true, role: true } },
        visitNote: { select: { id: true } },
      },
      orderBy: { scheduledAt: "asc" },
    });

    res.json({
      appointments,
      date: start.toISOString().slice(0, 10),
      scopedToDoctor: isDoctor(req.user),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/appointments/by-date
router.get("/appointments/by-date", async (req, res, next) => {
  try {
    const dateStr = req.query.date;
    if (!dateStr) {
      return res.status(400).json({ error: "date query param is required (YYYY-MM-DD)" });
    }

    const start = new Date(dateStr + "T00:00:00");
    const end = new Date(dateStr + "T00:00:00");
    end.setDate(end.getDate() + 1);

    if (isNaN(start.getTime())) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }

    const clinicId = req.user.clinicId;
    const staffId = resolveStaffScope(req.user, req.query.staffId);
    const where = {
      clinicId,
      scheduledAt: { gte: start, lt: end },
    };
    if (staffId) where.staffId = staffId;

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: { select: { id: true, name: true, phone: true } },
        staff: { select: { id: true, name: true, role: true } },
        visitNote: { select: { id: true } },
      },
      orderBy: { scheduledAt: "asc" },
    });

    res.json({ appointments, date: dateStr, scopedToDoctor: isDoctor(req.user) });
  } catch (err) {
    next(err);
  }
});

// GET /api/appointments/doctors
router.get("/appointments/doctors", async (req, res, next) => {
  try {
    const doctors = await prisma.staff.findMany({
      where: { clinicId: req.user.clinicId, role: "doctor" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    res.json(doctors);
  } catch (err) {
    next(err);
  }
});

// GET /api/appointments/:id — consultation payload
router.get("/appointments/:id", async (req, res, next) => {
  try {
    const appt = await loadAppointment(req.params.id, req.user.clinicId);
    if (!appt) return res.status(404).json({ error: "Appointment not found" });
    if (!canAccessAppointment(req.user, appt)) {
      return res.status(403).json({ error: "You can only view your own appointments" });
    }

    // Patient visit history (recent notes)
    const history = await prisma.visitNote.findMany({
      where: {
        clinicId: req.user.clinicId,
        appointment: { patientId: appt.patientId },
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
      take: 20,
    });

    res.json({ ...appt, history });
  } catch (err) {
    next(err);
  }
});

// POST /api/appointments — front desk only
router.post("/appointments", authorize(...FRONT_DESK), async (req, res, next) => {
  try {
    const { patientId, staffId, scheduledAt, notes } = req.body;
    const clinicId = req.user.clinicId;

    if (!patientId || !staffId) {
      return res.status(400).json({ error: "patientId and staffId are required" });
    }

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, clinicId },
    });
    if (!patient) {
      return res.status(404).json({ error: "Patient not found in this clinic" });
    }

    const doctor = await prisma.staff.findFirst({
      where: { id: staffId, clinicId, role: "doctor" },
    });
    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found in this clinic" });
    }

    const scheduleTime = scheduledAt ? new Date(scheduledAt) : new Date();
    if (isNaN(scheduleTime.getTime())) {
      return res.status(400).json({ error: "Invalid scheduledAt datetime" });
    }

    const appointment = await prisma.appointment.create({
      data: {
        clinicId,
        patientId,
        staffId,
        scheduledAt: scheduleTime,
        status: "waiting",
        notes: notes || null,
      },
      include: {
        patient: { select: { id: true, name: true, phone: true } },
        staff: { select: { id: true, name: true } },
      },
    });

    res.status(201).json(appointment);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/appointments/:id/status
router.patch("/appointments/:id/status", async (req, res, next) => {
  try {
    const { status } = req.body;
    const clinicId = req.user.clinicId;

    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
      });
    }

    const existing = await prisma.appointment.findFirst({
      where: { id: req.params.id, clinicId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    if (!canAccessAppointment(req.user, existing)) {
      return res.status(403).json({ error: "You can only update your own appointments" });
    }

    const allowed = TRANSITIONS[existing.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: `Cannot change status from '${existing.status}' to '${status}'. Allowed: ${allowed.join(", ") || "none"}`,
      });
    }

    const updated = await prisma.appointment.update({
      where: { id: req.params.id },
      data: { status },
      include: {
        patient: { select: { id: true, name: true, phone: true } },
        staff: { select: { id: true, name: true } },
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/appointments/:id — front desk (or doctor notes on own)
router.patch("/appointments/:id", async (req, res, next) => {
  try {
    const clinicId = req.user.clinicId;

    const existing = await prisma.appointment.findFirst({
      where: { id: req.params.id, clinicId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    if (!canAccessAppointment(req.user, existing)) {
      return res.status(403).json({ error: "You can only update your own appointments" });
    }

    // Doctors may only update notes; front desk can reassign/reschedule.
    const data = {};
    if (req.body.notes !== undefined) data.notes = req.body.notes;

    if (FRONT_DESK.includes(req.user.role)) {
      if (req.body.scheduledAt) data.scheduledAt = new Date(req.body.scheduledAt);
      if (req.body.staffId) {
        const doc = await prisma.staff.findFirst({
          where: { id: req.body.staffId, clinicId, role: "doctor" },
        });
        if (!doc) return res.status(404).json({ error: "Doctor not found" });
        data.staffId = req.body.staffId;
      }
    }

    const updated = await prisma.appointment.update({
      where: { id: req.params.id },
      data,
      include: {
        patient: { select: { id: true, name: true, phone: true } },
        staff: { select: { id: true, name: true } },
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
