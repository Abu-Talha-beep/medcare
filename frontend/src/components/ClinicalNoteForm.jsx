import { useState, useEffect } from "react";
import { api, postApi } from "../api";
import "./ClinicalNotes.css";

export default function ClinicalNoteForm({ appointmentId, patientName, doctorName, onClose, onSaved }) {
  const [template, setTemplate] = useState([]);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ── Load Template & Existing Note Data ───────────────────────
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // 1. Fetch clinic's dynamic template
        const tmplRes = await api("/clinics/template");
        const tmplData = await tmplRes.json();
        const fields = tmplData.template || [];
        setTemplate(fields);

        // 2. Fetch existing note for this appointment if any
        if (appointmentId) {
          const noteRes = await api(`/visit-notes/appointment/${appointmentId}`);
          if (noteRes.ok) {
            const noteData = await noteRes.json();
            setFormData(noteData.templateData || {});
          }
        }
      } catch {
        setError("Failed to load clinical template");
      }
      setLoading(false);
    }

    loadData();
  }, [appointmentId]);

  // ── Field Value Change ───────────────────────────────────────
  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  // ── Save Clinical Note ───────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const res = await postApi("/visit-notes", {
        appointmentId,
        templateData: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save clinical note");
        setSaving(false);
        return;
      }

      setSuccess("Clinical note saved successfully!");
      setSaving(false);
      if (onSaved) onSaved();
      setTimeout(() => {
        if (onClose) onClose();
      }, 800);
    } catch {
      setError("Cannot connect to server");
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="cnote-loading">Loading clinical note template…</div>;
  }

  return (
    <div className="cnote-modal-overlay">
      <div className="cnote-modal-card">
        <div className="cnote-modal-header">
          <div>
            <h3 className="cnote-modal-title">Clinical Note & Consultation</h3>
            <p className="cnote-modal-sub">
              Patient: <strong>{patientName}</strong> · Doctor: <strong>{doctorName}</strong>
            </p>
          </div>
          {onClose && (
            <button className="cnote-close-btn" onClick={onClose}>
              ✕
            </button>
          )}
        </div>

        {error && <div className="pat-alert pat-alert--error">{error}</div>}
        {success && <div className="pat-alert pat-alert--success">{success}</div>}

        <form onSubmit={handleSubmit} className="cnote-form">
          {template.length === 0 ? (
            <div className="pat-alert pat-alert--warning">
              No clinical fields configured for this clinic. Ask an admin to configure the template in settings.
            </div>
          ) : (
            template.map((field) => (
              <div key={field.key} className="pat-form-group">
                <label className="pat-form-label">
                  {field.label}
                  {field.type === "tooth_chart" && (
                    <span className="cnote-field-badge"> Tooth Chart</span>
                  )}
                </label>

                {/* Render Dynamic Field Input Type */}
                {field.type === "textarea" && (
                  <textarea
                    className="pat-form-input cnote-textarea"
                    rows={3}
                    placeholder={`Enter ${field.label.toLowerCase()}…`}
                    value={formData[field.key] || ""}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                  />
                )}

                {field.type === "text" && (
                  <input
                    type="text"
                    className="pat-form-input"
                    placeholder={`Enter ${field.label.toLowerCase()}…`}
                    value={formData[field.key] || ""}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                  />
                )}

                {field.type === "number" && (
                  <input
                    type="number"
                    className="pat-form-input"
                    placeholder={`Enter ${field.label.toLowerCase()}…`}
                    value={formData[field.key] || ""}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                  />
                )}

                {field.type === "select" && (
                  <select
                    className="pat-form-input pat-form-select"
                    value={formData[field.key] || ""}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                  >
                    <option value="">-- Select {field.label} --</option>
                    {(field.options || []).map((opt, i) => (
                      <option key={i} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}

                {field.type === "tooth_chart" && (
                  <input
                    type="text"
                    className="pat-form-input cnote-tooth-input"
                    placeholder="e.g. Tooth 18: Caries, Tooth 24: Crown, Tooth 36: Extracted"
                    value={formData[field.key] || ""}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                  />
                )}
              </div>
            ))
          )}

          <div className="pat-form-actions">
            {onClose && (
              <button type="button" className="pat-btn pat-btn--ghost" onClick={onClose}>
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="pat-btn pat-btn--primary"
              disabled={saving || template.length === 0}
            >
              {saving ? "Saving…" : "Save Clinical Note"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
