// src/middleware/auth.js — JWT authentication & role-based authorisation.

const jwt = require("jsonwebtoken");
const prisma = require("../db");
const config = require("../config");

/**
 * authenticate — verifies Bearer token, attaches req.user.
 *
 * req.user = { id, clinicId, role, name, phone }
 *
 * All downstream routes MUST use req.user.clinicId for DB queries —
 * never trust a clinic_id sent from the frontend.
 */
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }

    const token = header.slice(7);
    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch (err) {
      const message =
        err.name === "TokenExpiredError" ? "Token expired" : "Invalid token";
      return res.status(401).json({ error: message });
    }

    // Fetch the staff record to ensure it still exists and get fresh data.
    const staff = await prisma.staff.findUnique({
      where: { id: payload.sub },
      select: { id: true, clinicId: true, role: true, name: true, phone: true },
    });

    if (!staff) {
      return res.status(401).json({ error: "User no longer exists" });
    }

    req.user = staff;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * authorize(...roles) — restricts access to the listed roles.
 *
 * Usage: router.get("/admin-only", authenticate, authorize("admin"), handler)
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Role '${req.user.role}' is not permitted. Required: ${roles.join(", ")}`,
      });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
