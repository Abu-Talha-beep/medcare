// src/routes/dashboard.js — Role-aware dashboard & reports.

const { Router } = require("express");
const prisma = require("../db");
const { authenticate, authorize } = require("../middleware/auth");
const { REPORTS, isDoctor, resolveStaffScope } = require("../middleware/roles");

const router = Router();

router.use("/dashboard", authenticate);

function getTodayBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

// GET /api/dashboard/today
router.get("/dashboard/today", async (req, res, next) => {
  try {
    const clinicId = req.user.clinicId;
    const { start, end } = getTodayBounds();
    const staffScope = resolveStaffScope(req.user, req.query.staffId);

    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true, city: true, settings: true },
    });

    const settings = clinic?.settings || {};
    const enabledModules = settings.enabled_modules || {
      patients: true,
      appointments: true,
      billing: true,
      inventory: true,
    };

    const apptWhere = {
      clinicId,
      scheduledAt: { gte: start, lt: end },
    };
    if (staffScope) apptWhere.staffId = staffScope;

    const todayAppointments = await prisma.appointment.findMany({
      where: apptWhere,
      include: {
        patient: { select: { id: true, name: true, phone: true } },
        staff: { select: { id: true, name: true } },
        visitNote: { select: { id: true } },
      },
      orderBy: { scheduledAt: "asc" },
    });

    let waitingNow = 0;
    let inProgressNow = 0;
    let doneToday = 0;
    for (const appt of todayAppointments) {
      if (appt.status === "waiting") waitingNow++;
      else if (appt.status === "in_progress") inProgressNow++;
      else if (appt.status === "done") doneToday++;
    }

    let revenueToday = 0;
    let lowStockAlerts = 0;

    // Revenue & inventory only for non-doctor roles
    if (!isDoctor(req.user) && enabledModules.billing !== false) {
      const todayInvoices = await prisma.invoice.findMany({
        where: {
          clinicId,
          paymentStatus: "paid",
          createdAt: { gte: start, lt: end },
        },
        select: { amount: true, amountPaid: true },
      });
      revenueToday = todayInvoices.reduce(
        (sum, inv) => sum + (inv.amountPaid || inv.amount || 0),
        0
      );
    }

    if (req.user.role === "admin" && enabledModules.inventory !== false) {
      const inventoryItems = await prisma.inventoryItem.findMany({
        where: { clinicId },
        select: { stockQty: true, lowStockThreshold: true },
      });
      lowStockAlerts = inventoryItems.filter(
        (i) => i.stockQty <= i.lowStockThreshold
      ).length;
    }

    res.json({
      clinicName: clinic?.name || "Clinic",
      date: start.toISOString().slice(0, 10),
      role: req.user.role,
      scopedToDoctor: isDoctor(req.user),
      metrics: {
        patientsToday: todayAppointments.length,
        revenueToday: Math.round(revenueToday * 100) / 100,
        waitingNow,
        inProgressNow,
        doneToday,
        lowStockAlerts,
      },
      queue: todayAppointments,
      enabledModules,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/reports — admin only
router.get("/dashboard/reports", authorize(...REPORTS), async (req, res, next) => {
  try {
    const clinicId = req.user.clinicId;
    let { startDate, endDate } = req.query;

    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);

    const appointments = await prisma.appointment.findMany({
      where: {
        clinicId,
        scheduledAt: { gte: start, lte: end },
      },
      select: { scheduledAt: true, status: true },
    });

    const invoices = await prisma.invoice.findMany({
      where: {
        clinicId,
        paymentStatus: { in: ["paid", "partially_paid"] },
        createdAt: { gte: start, lte: end },
      },
      select: { amount: true, amountPaid: true, createdAt: true },
    });

    const dayMap = {};
    const curr = new Date(start);
    while (curr <= end) {
      const dateStr = curr.toISOString().slice(0, 10);
      dayMap[dateStr] = { date: dateStr, patientCount: 0, revenue: 0 };
      curr.setDate(curr.getDate() + 1);
    }

    for (const appt of appointments) {
      const dateStr = new Date(appt.scheduledAt).toISOString().slice(0, 10);
      if (dayMap[dateStr]) dayMap[dateStr].patientCount++;
    }

    for (const inv of invoices) {
      const dateStr = new Date(inv.createdAt).toISOString().slice(0, 10);
      if (dayMap[dateStr]) {
        dayMap[dateStr].revenue += inv.amountPaid || inv.amount || 0;
      }
    }

    const days = Object.values(dayMap).map((d) => ({
      ...d,
      revenue: Math.round(d.revenue * 100) / 100,
    }));

    const totalPatients = days.reduce((sum, d) => sum + d.patientCount, 0);
    const totalRevenue = days.reduce((sum, d) => sum + d.revenue, 0);
    const avgPatientsPerDay =
      days.length > 0 ? Math.round((totalPatients / days.length) * 10) / 10 : 0;

    res.json({
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      days,
      totals: {
        totalPatients,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        avgPatientsPerDay,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
