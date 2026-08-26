import { useState, useEffect, useCallback } from "react";
import { api, patchApi } from "../api";
import ClinicalTemplateConfig from "../components/ClinicalTemplateConfig";
import "./Settings.css";

const MODULE_META = [
  { key: "patients", title: "Patients", desc: "Patient registry and search" },
  { key: "appointments", title: "Appointments", desc: "Queue, calendar, and booking" },
  { key: "billing", title: "Billing", desc: "Invoices and receipts" },
  { key: "inventory", title: "Inventory", desc: "Stock and supplies" },
];

export default function SettingsPage({ onModulesChange }) {
  const [modules, setModules] = useState({
    patients: true,
    appointments: true,
    billing: true,
    inventory: true,
  });
  const [clinic, setClinic] = useState(null);
  const [showTemplate, setShowTemplate] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [modRes, meRes] = await Promise.all([
        api("/clinics/modules"),
        api("/clinics/me"),
      ]);
      if (modRes.ok) {
        const d = await modRes.json();
        if (d.modules) setModules(d.modules);
      }
      if (meRes.ok) setClinic(await meRes.json());
    } catch {
      setError("Failed to load settings");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleModule = async (key) => {
    const next = { ...modules, [key]: !modules[key] };
    setModules(next);
    setMsg("");
    setError("");
    try {
      const res = await patchApi("/clinics/modules", { modules: { [key]: next[key] } });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Update failed");
        load();
        return;
      }
      setModules(data.modules);
      if (onModulesChange) onModulesChange(data.modules);
      setMsg("Module visibility updated");
    } catch {
      setError("Cannot reach server");
      load();
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-card">
        <h2>Clinic profile</h2>
        {clinic ? (
          <div className="settings-profile">
            <div>
              <span className="pat-detail-label">Name</span>
              <div className="pat-detail-value">{clinic.name}</div>
            </div>
            <div>
              <span className="pat-detail-label">City</span>
              <div className="pat-detail-value">{clinic.city}</div>
            </div>
          </div>
        ) : (
          <p className="consult-muted">Loading…</p>
        )}
      </div>

      <div className="settings-card">
        <h2>Enabled modules</h2>
        <p className="settings-hint">Hidden modules disappear from staff navigation clinic-wide.</p>
        {error && <div className="pat-alert pat-alert--error">{error}</div>}
        {msg && <div className="pat-alert pat-alert--success">{msg}</div>}
        <div className="inv-module-toggle-list">
          {MODULE_META.map((m) => (
            <label key={m.key} className="inv-module-toggle-item">
              <div>
                <strong>{m.title}</strong>
                <div className="inv-module-desc">{m.desc}</div>
              </div>
              <input
                type="checkbox"
                checked={modules[m.key] !== false}
                onChange={() => toggleModule(m.key)}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-row">
          <div>
            <h2>Clinical note template</h2>
            <p className="settings-hint">Fields doctors fill during consultation.</p>
          </div>
          <button
            type="button"
            className="pat-btn pat-btn--primary"
            onClick={() => setShowTemplate(true)}
          >
            Edit template
          </button>
        </div>
      </div>

      {showTemplate && (
        <ClinicalTemplateConfig onClose={() => setShowTemplate(false)} />
      )}
    </div>
  );
}
