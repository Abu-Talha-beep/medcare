// src/routes/invoices.js — Invoice CRUD, Line items, Payment tracking, Today's collections summary.
// All endpoints scoped to req.user.clinicId.

const { Router } = require("express");
const prisma = require("../db");
const { authenticate, authorize } = require("../middleware/auth");
const { FRONT_DESK } = require("../middleware/roles");

const router = Router();

router.use("/invoices", authenticate, authorize(...FRONT_DESK));

const VALID_METHODS = ["cash", "jazzcash", "easypaisa", "card", "other"];
const VALID_STATUSES = ["paid", "unpaid", "partially_paid"];

// ─── Helper: date range for today ─────────────────────────────
function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

// ─── GET /api/invoices/today-summary ──────────────────────────
// End-of-day summary: total revenue today, payment method breakdown, unpaid count.
router.get("/invoices/today-summary", async (req, res, next) => {
  try {
    const { start, end } = todayRange();
    const clinicId = req.user.clinicId;

    // Fetch all invoices created today for this clinic
    const todayInvoices = await prisma.invoice.findMany({
      where: {
        clinicId,
        createdAt: { gte: start, lt: end },
      },
      select: {
        id: true,
        amount: true,
        paymentMethod: true,
        paymentStatus: true,
      },
    });

    let totalRevenue = 0;
    const methodBreakdown = {
      cash: 0,
      jazzcash: 0,
      easypaisa: 0,
      card: 0,
      other: 0,
    };
    let unpaidCount = 0;

    for (const inv of todayInvoices) {
      if (inv.paymentStatus === "paid") {
        totalRevenue += inv.amount;
        const method = inv.paymentMethod || "cash";
        if (methodBreakdown[method] !== undefined) {
          methodBreakdown[method] += inv.amount;
        } else {
          methodBreakdown.other += inv.amount;
        }
      } else {
        unpaidCount++;
      }
    }

    res.json({
      date: start.toISOString().slice(0, 10),
      totalRevenueToday: Math.round(totalRevenue * 100) / 100,
      methodBreakdown,
      unpaidCount,
      totalInvoicesToday: todayInvoices.length,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/invoices/unpaid ─────────────────────────────────
// Get all unpaid or partially_paid invoices for the clinic (or patient).
router.get("/invoices/unpaid", async (req, res, next) => {
  try {
    const clinicId = req.user.clinicId;
    const where = {
      clinicId,
      paymentStatus: { in: ["unpaid", "partially_paid"] },
    };

    if (req.query.patientId) {
      where.patientId = req.query.patientId;
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        patient: { select: { id: true, name: true, phone: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ invoices });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/invoices ────────────────────────────────────────
// List invoices for the clinic (paginated).
router.get("/invoices", async (req, res, next) => {
  try {
    const clinicId = req.user.clinicId;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const where = { clinicId };
    if (req.query.patientId) where.patientId = req.query.patientId;
    if (req.query.paymentStatus && VALID_STATUSES.includes(req.query.paymentStatus)) {
      where.paymentStatus = req.query.paymentStatus;
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          patient: { select: { id: true, name: true, phone: true } },
          items: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({
      invoices,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/invoices/:id ────────────────────────────────────
// Single invoice with full details (clinic, patient, items, appointment).
router.get("/invoices/:id", async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, clinicId: req.user.clinicId },
      include: {
        clinic: { select: { id: true, name: true, city: true, settings: true } },
        patient: { select: { id: true, name: true, phone: true, cnic: true, address: true } },
        appointment: {
          select: {
            id: true,
            scheduledAt: true,
            staff: { select: { id: true, name: true } },
          },
        },
        items: true,
      },
    });

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    res.json(invoice);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/invoices ───────────────────────────────────────
// Create new invoice with line items. Auto-calculates total amount.
router.post("/invoices", async (req, res, next) => {
  try {
    const { patientId, appointmentId, items, paymentMethod, paymentStatus } = req.body;
    const clinicId = req.user.clinicId;

    if (!patientId) {
      return res.status(400).json({ error: "patientId is required" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "At least one invoice line item is required" });
    }

    // Verify patient belongs to clinic
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, clinicId },
    });
    if (!patient) {
      return res.status(404).json({ error: "Patient not found in this clinic" });
    }

    // Calculate total amount from line items
    let totalAmount = 0;
    const processedItems = items.map((item) => {
      const amt = parseFloat(item.amount) || 0;
      totalAmount += amt;
      return {
        description: item.description || "Medical Service",
        amount: amt,
      };
    });

    // Validate payment method & status if provided
    const status = VALID_STATUSES.includes(paymentStatus) ? paymentStatus : "unpaid";
    const method = VALID_METHODS.includes(paymentMethod) ? paymentMethod : (status === "paid" ? "cash" : null);
    let amountPaid = parseFloat(req.body.amountPaid);
    if (isNaN(amountPaid)) {
      amountPaid = status === "paid" ? Math.round(totalAmount * 100) / 100 : 0;
    }
    amountPaid = Math.min(Math.max(0, amountPaid), totalAmount);
    let finalStatus = status;
    if (amountPaid <= 0) finalStatus = "unpaid";
    else if (amountPaid < totalAmount) finalStatus = "partially_paid";
    else finalStatus = "paid";

    const invoice = await prisma.invoice.create({
      data: {
        clinicId,
        patientId,
        appointmentId: appointmentId || null,
        amount: Math.round(totalAmount * 100) / 100,
        amountPaid: Math.round(amountPaid * 100) / 100,
        paymentStatus: finalStatus,
        paymentMethod: method,
        items: {
          create: processedItems,
        },
      },
      include: {
        clinic: { select: { name: true, city: true } },
        patient: { select: { name: true, phone: true } },
        items: true,
      },
    });

    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/invoices/:id/payment ──────────────────────────
// Mark invoice as paid / unpaid / partially_paid with amountPaid.
router.patch("/invoices/:id/payment", async (req, res, next) => {
  try {
    const { paymentStatus, paymentMethod, amountPaid } = req.body;
    const clinicId = req.user.clinicId;

    const existing = await prisma.invoice.findFirst({
      where: { id: req.params.id, clinicId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    const data = {};
    if (paymentMethod && VALID_METHODS.includes(paymentMethod)) {
      data.paymentMethod = paymentMethod;
    }

    if (amountPaid !== undefined) {
      let paid = parseFloat(amountPaid);
      if (isNaN(paid) || paid < 0) {
        return res.status(400).json({ error: "amountPaid must be a non-negative number" });
      }
      paid = Math.min(paid, existing.amount);
      data.amountPaid = Math.round(paid * 100) / 100;
      if (paid <= 0) data.paymentStatus = "unpaid";
      else if (paid < existing.amount) data.paymentStatus = "partially_paid";
      else data.paymentStatus = "paid";
    } else if (paymentStatus && VALID_STATUSES.includes(paymentStatus)) {
      data.paymentStatus = paymentStatus;
      if (paymentStatus === "paid") data.amountPaid = existing.amount;
      if (paymentStatus === "unpaid") data.amountPaid = 0;
    }

    const updated = await prisma.invoice.update({
      where: { id: req.params.id },
      data,
      include: {
        patient: { select: { name: true, phone: true } },
        items: true,
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
