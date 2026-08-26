import { useState, useEffect } from "react";
import { api } from "../api";
import "./ClinicalNotes.css";

const PRESET_MEDICAL = [
  { key: "symptoms", label: "Symptoms / Chief Complaint", type: "textarea" },
  { key: "diagnosis", label: "Diagnosis / Observations", type: "text" },
  { key: "prescription", label: "Prescription / Treatment Plan", type: "textarea" },
];

const PRESET_DENTAL = [
  { key: "chief_complaint", label: "Chief Complaint", type: "text" },
  { key: "tooth_chart", label: "Tooth Numbers & Procedure Notes", type: "tooth_chart" },
  { key: "diagnosis", label: "Dental Diagnosis", type: "text" },
  { key: "treatment_plan", label: "Treatment Plan & Materials", type: "textarea" },
];

export default function ClinicalTemplateConfig({ onClose }) {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  // New field row inputs
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState("textarea");
  const [newOptions, setNewOptions] = useState("");

  // ── Fetch current template ──────────────────────────────────
  useEffect(() => {
    async function loadTemplate() {
      setLoading(true);
      try {
        const res = await api("/clinics/template");
        const data = await res.json();
        setFields(data.template || PRESET_MEDICAL);
      } catch {
        setMsg({ type: "error", text: "Failed to fetch clinic settings" });
      }
      setLoading(false);
    }
    loadTemplate();
  }, []);

  // ── Add New Field ───────────────────────────────────────────
  const handleAddField = (e) => {
    e.preventDefault();
    if (!newLabel.trim()) return;

    const key = newKey.trim()
      ? newKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_")
      : newLabel.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");

    const exists = fields.some((f) => f.key === key);
    if (exists) {
      setMsg({ type: "error", text: `Field with key '${key}' already exists` });
      return;
    }

    const opts = newType === "select"
      ? newOptions.split(",").map((o) => o.trim()).filter(Boolean)
      : [];

    setFields([
      ...fields,
      { key, label: newLabel.trim(), type: newType, options: opts },
    ]);

    setNewKey("");
    setNewLabel("");
    setNewType("textarea");
    setNewOptions("");
    setMsg({ type: "", text: "" });
  };

  // ── Remove Field ────────────────────────────────────────────
  const handleRemoveField = (index) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  // ── Load Preset Template ────────────────────────────────────
  const handleLoadPreset = (preset) => {
    setFields(preset);
    setMsg({ type: "success", text: "Loaded template preset. Click Save to apply." });
  };

  // ── Save Template to Backend ────────────────────────────────
  const handleSaveTemplate = async () => {
    setSaving(true);
    setMsg({ type: "", text: "" });

    try {
      const res = await api("/clinics/template", {
        method: "PUT",
        body: JSON.stringify({ template: fields }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: "error", text: data.error || "Failed to update template" });
        setSaving(false);
        return;
      }

      setMsg({ type: "success", text: "Clinic Note Template saved successfully!" });
      setSaving(false);
    } catch {
      setMsg({ type: "error", text: "Cannot connect to server" });
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="cnote-loading">Loading template configurator…</div>;
  }

  return (
    <div className="cnote-modal-overlay">
      <div className="cnote-modal-card cnote-config-card">
        <div className="cnote-modal-header">
          <div>
            <h3 className="cnote-modal-title">⚙️ Clinical Notes Template Settings</h3>
            <p className="cnote-modal-sub">
              Customize dynamic fields for your clinic (Medical vs Dental vs Speciality)
            </p>
          </div>
          {onClose && (
            <button className="cnote-close-btn" onClick={onClose}>
              ✕
            </button>
          )}
        </div>

        {msg.text && (
          <div className={`pat-alert pat-alert--${msg.type}`}>{msg.text}</div>
        )}

        {/* Preset Selector */}
        <div className="cnote-preset-bar">
          <span className="cnote-preset-label">Quick Presets:</span>
          <button
            type="button"
            className="pat-btn pat-btn--ghost pat-btn--sm"
            onClick={() => handleLoadPreset(PRESET_MEDICAL)}
          >
            General Medical Template
          </button>
          <button
            type="button"
            className="pat-btn pat-btn--ghost pat-btn--sm"
            onClick={() => handleLoadPreset(PRESET_DENTAL)}
          >
            🦷 Dental Clinic Template
          </button>
        </div>

        {/* Active Fields List */}
        <div className="cnote-fields-list">
          <h4 className="cnote-section-title">Current Fields ({fields.length})</h4>
          {fields.length === 0 ? (
            <div className="pat-empty">No fields defined yet. Add a field below or load a preset.</div>
          ) : (
            fields.map((f, idx) => (
              <div key={f.key || idx} className="cnote-field-item">
                <div className="cnote-field-info">
                  <strong className="cnote-field-label">{f.label}</strong>
                  <span className="cnote-field-meta">
                    key: <code>{f.key}</code> · type: <span className="cnote-type-tag">{f.type}</span>
                  </span>
                </div>
                <button
                  type="button"
                  className="bill-remove-item-btn"
                  onClick={() => handleRemoveField(idx)}
                  title="Remove field"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add New Field Form */}
        <form onSubmit={handleAddField} className="cnote-add-field-form">
          <h4 className="cnote-section-title">+ Add New Template Field</h4>
          <div className="pat-form-row">
            <div className="pat-form-group">
              <label className="pat-form-label">Field Label *</label>
              <input
                type="text"
                className="pat-form-input"
                placeholder="e.g. Tooth Numbers / Notes"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                required
              />
            </div>

            <div className="pat-form-group">
              <label className="pat-form-label">Field Type *</label>
              <select
                className="pat-form-input pat-form-select"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
              >
                <option value="textarea">Textarea (Multi-line)</option>
                <option value="text">Text (Single-line)</option>
                <option value="number">Number</option>
                <option value="select">Dropdown Select</option>
                <option value="tooth_chart">Tooth Chart / Dental Notes</option>
              </select>
            </div>
          </div>

          {newType === "select" && (
            <div className="pat-form-group">
              <label className="pat-form-label">Options (comma separated)</label>
              <input
                type="text"
                className="pat-form-input"
                placeholder="e.g. Normal, Mild, Severe"
                value={newOptions}
                onChange={(e) => setNewOptions(e.target.value)}
              />
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" className="pat-btn pat-btn--ghost pat-btn--sm">
              + Append Field
            </button>
          </div>
        </form>

        <div className="pat-form-actions">
          {onClose && (
            <button type="button" className="pat-btn pat-btn--ghost" onClick={onClose}>
              Cancel
            </button>
          )}
          <button
            type="button"
            className="pat-btn pat-btn--primary"
            onClick={handleSaveTemplate}
            disabled={saving}
          >
            {saving ? "Saving…" : "💾 Save Template Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
