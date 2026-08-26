// src/routes/inventory.js — Inventory Management & Stock Transactions.
// All endpoints scoped to req.user.clinicId.

const { Router } = require("express");
const prisma = require("../db");
const { authenticate, authorize } = require("../middleware/auth");
const { INVENTORY } = require("../middleware/roles");

const router = Router();

// Inventory is admin-only.
router.use("/inventory", authenticate, authorize(...INVENTORY));

// ─── GET /api/inventory/low-stock ─────────────────────────────
// Get items where stock_qty <= low_stock_threshold.
router.get("/inventory/low-stock", async (req, res, next) => {
  try {
    const clinicId = req.user.clinicId;
    const items = await prisma.inventoryItem.findMany({
      where: { clinicId },
      orderBy: { name: "asc" },
    });

    const lowStockItems = items.filter(
      (item) => item.stockQty <= item.lowStockThreshold
    );

    res.json({ items: lowStockItems, count: lowStockItems.length });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/inventory ───────────────────────────────────────
// List all inventory items for clinic.
router.get("/inventory", async (req, res, next) => {
  try {
    const clinicId = req.user.clinicId;
    const items = await prisma.inventoryItem.findMany({
      where: { clinicId },
      orderBy: { name: "asc" },
    });

    res.json({ items });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/inventory ──────────────────────────────────────
// Create new inventory item.
router.post("/inventory", async (req, res, next) => {
  try {
    const { name, unit, stockQty, lowStockThreshold } = req.body;
    const clinicId = req.user.clinicId;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Item name is required" });
    }

    const item = await prisma.inventoryItem.create({
      data: {
        clinicId,
        name: name.trim(),
        unit: (unit || "piece").trim(),
        stockQty: parseInt(stockQty, 10) || 0,
        lowStockThreshold: parseInt(lowStockThreshold, 10) || 10,
      },
    });

    // Log initial stock transaction if stockQty > 0
    if (item.stockQty > 0) {
      await prisma.inventoryTransaction.create({
        data: {
          clinicId,
          itemId: item.id,
          changeQty: item.stockQty,
          reason: "Initial stock setup",
        },
      });
    }

    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/inventory/:id ───────────────────────────────────
// Update inventory item details.
router.put("/inventory/:id", async (req, res, next) => {
  try {
    const { name, unit, lowStockThreshold } = req.body;
    const clinicId = req.user.clinicId;

    const existing = await prisma.inventoryItem.findFirst({
      where: { id: req.params.id, clinicId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Inventory item not found" });
    }

    const updated = await prisma.inventoryItem.update({
      where: { id: req.params.id },
      data: {
        name: name ? name.trim() : existing.name,
        unit: unit ? unit.trim() : existing.unit,
        lowStockThreshold:
          lowStockThreshold !== undefined
            ? parseInt(lowStockThreshold, 10)
            : existing.lowStockThreshold,
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/inventory/:id ────────────────────────────────
// Delete inventory item.
router.delete("/inventory/:id", async (req, res, next) => {
  try {
    const clinicId = req.user.clinicId;
    const existing = await prisma.inventoryItem.findFirst({
      where: { id: req.params.id, clinicId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Inventory item not found" });
    }

    await prisma.inventoryItem.delete({
      where: { id: req.params.id },
    });

    res.json({ message: "Inventory item deleted" });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/inventory/:id/transaction ─────────────────────
// Record stock change (positive for restock, negative for usage).
router.post("/inventory/:id/transaction", async (req, res, next) => {
  try {
    const { changeQty, reason } = req.body;
    const clinicId = req.user.clinicId;

    const qty = parseInt(changeQty, 10);
    if (isNaN(qty) || qty === 0) {
      return res.status(400).json({ error: "changeQty must be a non-zero integer" });
    }

    const item = await prisma.inventoryItem.findFirst({
      where: { id: req.params.id, clinicId },
    });
    if (!item) {
      return res.status(404).json({ error: "Inventory item not found" });
    }

    const newStock = item.stockQty + qty;
    if (newStock < 0) {
      return res.status(400).json({
        error: `Cannot reduce stock by ${Math.abs(qty)}. Current stock is ${item.stockQty}.`,
      });
    }

    // Execute atomic update & transaction log
    const [updatedItem, transaction] = await prisma.$transaction([
      prisma.inventoryItem.update({
        where: { id: item.id },
        data: { stockQty: newStock },
      }),
      prisma.inventoryTransaction.create({
        data: {
          clinicId,
          itemId: item.id,
          changeQty: qty,
          reason: reason || (qty > 0 ? "Stock Restock" : "Stock Usage"),
        },
      }),
    ]);

    res.json({ item: updatedItem, transaction });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
