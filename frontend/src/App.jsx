import { useState, useEffect, useCallback } from "react";
import { api, postApi } from "./api";
import {
  canAccessPage,
  defaultPageForRole,
  pageTitle,
  pageSubtitle,
} from "./roles";
import DashboardPage from "./pages/Dashboard";
import PatientsPage from "./pages/Patients";
import AppointmentsPage from "./pages/Appointments";
import BillingPage from "./pages/Billing";
import InventoryPage from "./pages/Inventory";
import DoctorDayPage from "./pages/DoctorDay";
import ConsultationPage from "./pages/Consultation";
import StaffPage from "./pages/Staff";
import SettingsPage from "./pages/Settings";
import "./App.css";

const DEMO_CLINIC_ID = "00000000-0000-0000-0000-000000000001";

function IconCross({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7V3z" fill="currentColor" />
    </svg>
  );
}

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11.5L12 4l9 7.5" />
      <path d="M5 10.5V20h14v-9.5" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function IconInvoice() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 3h8l4 4v14H7V3z" />
      <path d="M15 3v4h4M9 12h6M9 16h6" />
    </svg>
  );
}

function IconBox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
      <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  );
}

function StatusBadge({ apiStatus }) {
  return (
    <div
      className={`login-status ${
        apiStatus === "error"
          ? "login-status--error"
          : apiStatus === "loading"
            ? "login-status--loading"
            : ""
      }`}
      id="api-status"
    >
      <span className="login-status-dot" />
      {apiStatus === "loading" && "Connecting to server…"}
      {apiStatus === "ok" && "API connected"}
      {apiStatus === "error" && "API offline — start the backend"}
    </div>
  );
}

function BrandLogo({ subtitle }) {
  return (
    <>
      <div className="login-logo">
        <div className="login-logo-icon" aria-hidden="true">
          <IconCross />
        </div>
        <span className="login-logo-text">MedClinic</span>
      </div>
      {subtitle && <p className="login-subtitle">{subtitle}</p>}
    </>
  );
}

export default function App() {
  const [page, setPage] = useState("loading");
  const [user, setUser] = useState(null);
  const [activeAppointmentId, setActiveAppointmentId] = useState(null);
  const [apiStatus, setApiStatus] = useState("loading");
  const [error, setError] = useState("");
  const [enabledModules, setEnabledModules] = useState({
    patients: true,
    appointments: true,
    billing: true,
    inventory: true,
  });

  const fetchModules = useCallback(() => {
    api("/clinics/modules")
      .then((r) => r.json())
      .then((data) => {
        if (data.modules) setEnabledModules(data.modules);
      })
      .catch(() => {});
  }, []);

  const checkSetupRequired = useCallback(() => {
    fetch(
      `${import.meta.env.VITE_API_URL || "http://localhost:4000/api"}/auth/setup-status?clinicId=${DEMO_CLINIC_ID}`
    )
      .then((r) => r.json())
      .then((data) => {
        setPage(data.setupRequired ? "setup" : "login");
      })
      .catch(() => setPage("login"));
  }, []);

  useEffect(() => {
    const token = sessionStorage.getItem("token") || localStorage.getItem("token");
    const savedUserStr = sessionStorage.getItem("user") || localStorage.getItem("user");

    fetch(
      `${import.meta.env.VITE_API_URL || "http://localhost:4000/api"}/health`
    )
      .then((r) => r.json())
      .then((d) => setApiStatus(d.status === "ok" ? "ok" : "error"))
      .catch(() => setApiStatus("error"));

    if (token && savedUserStr) {
      api("/auth/me")
        .then((r) => {
          if (r.ok) return r.json();
          throw new Error("Invalid token");
        })
        .then((data) => {
          setUser(data.user);
          setPage(defaultPageForRole(data.user.role));
          fetchModules();
        })
        .catch(() => {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          sessionStorage.removeItem("token");
          sessionStorage.removeItem("user");
          checkSetupRequired();
        });
    } else {
      checkSetupRequired();
    }
  }, [fetchModules, checkSetupRequired]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    const form = new FormData(e.target);
    const phone = form.get("phone");
    const password = form.get("password");
    const remember = form.get("remember") === "on";

    try {
      const res = await postApi("/auth/login", { phone, password });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }
      
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");

      const storage = remember ? localStorage : sessionStorage;
      storage.setItem("token", data.token);
      storage.setItem("user", JSON.stringify(data.user));

      setUser(data.user);
      setPage(defaultPageForRole(data.user.role));
      fetchModules();
    } catch {
      setError("Cannot reach the server");
    }
  };

  const handleSetup = async (e) => {
    e.preventDefault();
    setError("");
    const form = new FormData(e.target);
    const name = form.get("name");
    const phone = form.get("phone");
    const password = form.get("password");
    const confirm = form.get("confirm");

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    try {
      const res = await postApi("/auth/setup", {
        clinicId: DEMO_CLINIC_ID,
        name,
        phone,
        password,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Setup failed");
        return;
      }

      localStorage.removeItem("token");
      localStorage.removeItem("user");
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setUser(data.user);
      setPage(defaultPageForRole(data.user.role));
    } catch {
      setError("Cannot reach the server");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    setUser(null);
    setPage("login");
  };

  const navigate = (target) => {
    setPage(target);
  };

  if (page === "loading") {
    return (
      <div className="login-container">
        <div className="login-orb login-orb--1" aria-hidden="true" />
        <div className="login-orb login-orb--2" aria-hidden="true" />
        <div className="login-card">
          <BrandLogo subtitle="Loading…" />
        </div>
      </div>
    );
  }

  if (page === "setup") {
    return (
      <div className="login-container">
        <div className="login-orb login-orb--1" aria-hidden="true" />
        <div className="login-orb login-orb--2" aria-hidden="true" />
        <div className="login-orb login-orb--3" aria-hidden="true" />

        <div className="login-card">
          <BrandLogo subtitle="Create your first admin account" />

          {error && (
            <div className="login-status login-status--error" style={{ marginBottom: "var(--space-4)" }}>
              <span className="login-status-dot" />
              {error}
            </div>
          )}

          <form className="login-form" onSubmit={handleSetup} id="setup-form">
            <div className="login-field">
              <label className="login-label" htmlFor="setup-name">Full Name</label>
              <div className="login-input-wrapper">
                <input id="setup-name" name="name" className="login-input" type="text" placeholder="Dr. Ahmed Khan" required />
                <span className="login-input-icon" aria-hidden="true"><IconUser /></span>
              </div>
            </div>

            <div className="login-field">
              <label className="login-label" htmlFor="setup-phone">Phone Number</label>
              <div className="login-input-wrapper">
                <input id="setup-phone" name="phone" className="login-input" type="tel" placeholder="03001234567" required />
                <span className="login-input-icon" aria-hidden="true"><IconPhone /></span>
              </div>
            </div>

            <div className="login-field">
              <label className="login-label" htmlFor="setup-password">Password</label>
              <div className="login-input-wrapper">
                <input id="setup-password" name="password" className="login-input" type="password" placeholder="••••••••" minLength={6} required />
                <span className="login-input-icon" aria-hidden="true"><IconLock /></span>
              </div>
            </div>

            <div className="login-field">
              <label className="login-label" htmlFor="setup-confirm">Confirm Password</label>
              <div className="login-input-wrapper">
                <input id="setup-confirm" name="confirm" className="login-input" type="password" placeholder="••••••••" minLength={6} required />
                <span className="login-input-icon" aria-hidden="true"><IconLock /></span>
              </div>
            </div>

            <button type="submit" className="login-btn" id="setup-submit">
              Create Admin Account
            </button>
          </form>

          <div className="login-divider"><span>system status</span></div>
          <StatusBadge apiStatus={apiStatus} />
          <p className="login-footer">© 2026 MedClinic · v0.3.0</p>
        </div>
      </div>
    );
  }

  if (page === "login") {
    return (
      <div className="login-container">
        <div className="login-orb login-orb--1" aria-hidden="true" />
        <div className="login-orb login-orb--2" aria-hidden="true" />
        <div className="login-orb login-orb--3" aria-hidden="true" />

        <div className="login-card">
          <BrandLogo subtitle="Sign in to your clinic workspace" />

          {error && (
            <div className="login-status login-status--error" style={{ marginBottom: "var(--space-4)" }}>
              <span className="login-status-dot" />
              {error}
            </div>
          )}

          <form className="login-form" onSubmit={handleLogin} id="login-form">
            <div className="login-field">
              <label className="login-label" htmlFor="login-phone">Phone Number</label>
              <div className="login-input-wrapper">
                <input id="login-phone" name="phone" className="login-input" type="tel" placeholder="03001234567" autoComplete="tel" required />
                <span className="login-input-icon" aria-hidden="true"><IconPhone /></span>
              </div>
            </div>

            <div className="login-field">
              <label className="login-label" htmlFor="login-password">Password</label>
              <div className="login-input-wrapper">
                <input id="login-password" name="password" className="login-input" type="password" placeholder="••••••••" autoComplete="current-password" required />
                <span className="login-input-icon" aria-hidden="true"><IconLock /></span>
              </div>
            </div>

            <div className="login-options">
              <label className="login-remember" htmlFor="login-remember-cb">
                <input type="checkbox" id="login-remember-cb" name="remember" />
                Remember me on this device
              </label>
              <span className="login-forgot" style={{ cursor: "default", opacity: 0.5 }}>
                Contact admin to reset
              </span>
            </div>

            <button type="submit" className="login-btn" id="login-submit">
              Sign In
            </button>
          </form>

          <div className="login-divider"><span>system status</span></div>
          <StatusBadge apiStatus={apiStatus} />
          <p className="login-footer">© 2026 MedClinic · v0.3.0</p>
        </div>
      </div>
    );
  }

  const isAppPage = [
    "dashboard",
    "doctor-day",
    "consultation",
    "patients",
    "appointments",
    "billing",
    "inventory",
    "staff",
    "settings",
  ].includes(page);

  if (!isAppPage) return null;

  const userRole = user?.role || "admin";
  const navItems = [
    { id: "dashboard", label: userRole === "receptionist" ? "Front Desk" : "Dashboard", icon: <IconHome /> },
    { id: "doctor-day", label: "My Day", icon: <IconHome /> },
    { id: "patients", label: "Patients", icon: <IconUser /> },
    { id: "appointments", label: "Appointments", icon: <IconCalendar /> },
    { id: "billing", label: "Billing", icon: <IconInvoice /> },
    { id: "inventory", label: "Inventory", icon: <IconBox /> },
    { id: "staff", label: "Staff", icon: <IconUser /> },
    { id: "settings", label: "Settings", icon: <IconBox /> },
  ];

  return (
    <div className="dashboard">
      <aside className="dash-sidebar">
        <div className="dash-sidebar-brand">
          <div className="dash-brand-mark" aria-hidden="true">
            <IconCross size={20} />
          </div>
          <div className="dash-brand-text">
            <span className="dash-sidebar-title">MedClinic</span>
            <span className="dash-sidebar-sub">Al-Shifa Clinic</span>
          </div>
        </div>

        <nav className="dash-nav">
          {navItems
            .filter((item) => canAccessPage(userRole, item.id, enabledModules))
            .map((item) => (
              <button
                key={item.id}
                className={`dash-nav-item ${page === item.id ? "dash-nav-item--active" : ""}`}
                onClick={() => navigate(item.id)}
                id={`nav-${item.id}`}
              >
                <span className="dash-nav-icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
        </nav>

        <div className="dash-sidebar-footer">
          <StatusBadge apiStatus={apiStatus} />
        </div>
      </aside>

      <main className="dash-main">
        <header className="dash-header">
          <div>
            <h1 className="dash-title">{pageTitle(page, userRole)}</h1>
            <p className="dash-subtitle">{pageSubtitle(page, userRole)}</p>
          </div>
          <div className="dash-header-actions">
            <button type="button" className="dash-lang-btn">EN / اردو</button>
            <div className="dash-user-badge">
              <span className="dash-user-avatar">
                {user?.name?.charAt(0)?.toUpperCase() || "?"}
              </span>
              <div className="dash-user-info">
                <span className="dash-user-name">{user?.name}</span>
                <span className="dash-user-role">{user?.role}</span>
              </div>
            </div>
            <button className="dash-logout-btn" onClick={handleLogout} id="logout-btn">
              Sign Out
            </button>
          </div>
        </header>

        <div className="dash-content">
          {page === "dashboard" && (
            <DashboardPage onNavigate={(target) => navigate(target)} />
          )}
          {page === "doctor-day" && (
            <DoctorDayPage
              user={user}
              onOpenConsultation={(apptId) => {
                setActiveAppointmentId(apptId);
                setPage("consultation");
              }}
            />
          )}
          {page === "consultation" && (
            <ConsultationPage
              appointmentId={activeAppointmentId}
              onBack={() => setPage("doctor-day")}
              onDone={() => setPage("doctor-day")}
            />
          )}
          {page === "patients" && <PatientsPage />}
          {page === "appointments" && <AppointmentsPage />}
          {page === "billing" && <BillingPage />}
          {page === "inventory" && (
            <InventoryPage onModuleToggle={(mods) => setEnabledModules(mods)} />
          )}
          {page === "staff" && <StaffPage />}
          {page === "settings" && (
            <SettingsPage onModulesChange={(mods) => setEnabledModules(mods)} />
          )}
        </div>
      </main>
    </div>
  );
}
