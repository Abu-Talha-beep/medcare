// src/index.js — Express application entry point.

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const config = require("./config");
const healthRoutes = require("./routes/health");
const authRoutes = require("./routes/auth");
const clinicRoutes = require("./routes/clinics");
const staffRoutes = require("./routes/staff");
const patientRoutes = require("./routes/patients");
const appointmentRoutes = require("./routes/appointments");
const invoiceRoutes = require("./routes/invoices");
const clinicalNoteRoutes = require("./routes/clinicalNotes");
const inventoryRoutes = require("./routes/inventory");
const dashboardRoutes = require("./routes/dashboard");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// ── Middleware ────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
if (config.isDev) app.use(morgan("dev"));

// ── Routes ───────────────────────────────────────────────────
app.use("/api", healthRoutes);   // Public
app.use("/api", authRoutes);     // Public (login, setup) + authenticated (me)
app.use("/api", clinicRoutes);   // Authenticated
app.use("/api", staffRoutes);    // Admin-only
app.use("/api", patientRoutes);      // Authenticated
app.use("/api", appointmentRoutes);  // Authenticated
app.use("/api", invoiceRoutes);      // Authenticated
app.use("/api", clinicalNoteRoutes); // Authenticated
app.use("/api", inventoryRoutes);    // Authenticated
app.use("/api", dashboardRoutes);    // Authenticated

// ── Error handling ───────────────────────────────────────────
app.use(errorHandler);

// ── Start ────────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(
    `🏥 Clinic API running → http://localhost:${config.port}  [${config.nodeEnv}]`
  );
});

module.exports = app;
