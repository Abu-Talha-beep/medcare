// src/middleware/roles.js — Role helpers for clinic RBAC.

/** Roles that can manage front-desk ops (book, bill, register). */
const FRONT_DESK = ["admin", "receptionist"];

/** Roles that can write clinical notes. */
const CLINICAL_WRITE = ["admin", "doctor"];

/** Roles that can manage inventory. */
const INVENTORY = ["admin"];

/** Roles that can view clinic-wide reports / revenue. */
const REPORTS = ["admin"];

function isDoctor(user) {
  return user?.role === "doctor";
}

function isAdmin(user) {
  return user?.role === "admin";
}

/**
 * For doctors, force staffId filter to their own id unless admin overrides.
 * Receptionists/admins may optionally pass staffId.
 */
function resolveStaffScope(user, queryStaffId) {
  if (isDoctor(user)) return user.id;
  return queryStaffId || undefined;
}

/**
 * Doctors may only mutate appointments assigned to them.
 */
function canAccessAppointment(user, appointment) {
  if (!appointment) return false;
  if (user.role === "admin" || user.role === "receptionist") return true;
  if (user.role === "doctor") return appointment.staffId === user.id;
  return false;
}

module.exports = {
  FRONT_DESK,
  CLINICAL_WRITE,
  INVENTORY,
  REPORTS,
  isDoctor,
  isAdmin,
  resolveStaffScope,
  canAccessAppointment,
};
