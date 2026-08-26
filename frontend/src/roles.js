// src/roles.js — Frontend role capabilities & navigation.

export const ROLES = {
  admin: "admin",
  doctor: "doctor",
  receptionist: "receptionist",
};

/** Nav items each role can see (module flags still apply where noted). */
export const NAV_BY_ROLE = {
  admin: [
    "dashboard",
    "patients",
    "appointments",
    "billing",
    "inventory",
    "staff",
    "settings",
  ],
  doctor: ["doctor-day", "patients", "consultation"],
  receptionist: ["dashboard", "patients", "appointments", "billing"],
};

export function canAccessPage(role, page, enabledModules = {}) {
  const allowed = NAV_BY_ROLE[role] || [];
  if (!allowed.includes(page)) return false;

  // Module toggles (clinic-wide) for shared modules
  const moduleMap = {
    patients: "patients",
    appointments: "appointments",
    billing: "billing",
    inventory: "inventory",
  };
  const mod = moduleMap[page];
  if (mod && enabledModules[mod] === false) return false;

  // Consultation is opened from doctor-day; not a sidebar item
  if (page === "consultation") return role === "doctor" || role === "admin";

  return true;
}

export function defaultPageForRole(role) {
  if (role === "doctor") return "doctor-day";
  return "dashboard";
}

export function pageTitle(page, role) {
  const titles = {
    dashboard: role === "receptionist" ? "Front Desk" : "Dashboard",
    "doctor-day": "My Day",
    consultation: "Consultation",
    patients: "Patients",
    appointments: "Appointments",
    billing: "Billing & Invoices",
    inventory: "Inventory & Supplies",
    staff: "Staff",
    settings: "Clinic Settings",
  };
  return titles[page] || "MedClinic";
}

export function pageSubtitle(page, role) {
  const map = {
    dashboard:
      role === "receptionist"
        ? "Queue, check-ins, and today’s front desk"
        : "Clinic overview and activity",
    "doctor-day": "Your patients and consultations today",
    consultation: "Clinical note, chart, and prescriptions",
    patients: "Search and manage patient records",
    appointments: "Bookings, walk-ins, and calendar",
    billing: "Invoices, payments, and receipts",
    inventory: "Stock levels and supplies",
    staff: "Doctors, receptionists, and admins",
    settings: "Modules and clinical note template",
  };
  return map[page] || "";
}

export function canWriteNotes(role) {
  return role === "admin" || role === "doctor";
}

export function canManagePatients(role) {
  return role === "admin" || role === "receptionist";
}

export function canBookAppointments(role) {
  return role === "admin" || role === "receptionist";
}
