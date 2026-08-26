import { useState, useEffect, useCallback } from "react";
import { api, postApi, patchApi } from "../api";
import "./Consultation.css";

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const emptyRx = () => ({
  drug: "",
  dose: "",
  frequency: "",
  duration: "",
  instructions: "",
});

export default function ConsultationPage({ appointmentId, onBack, onDone }) {
  const [data, setData] = useState(null);
  const [template, setTemplate] = useState([]);
  const [formData, setFormData] = useState({});
  const [prescriptions, setPrescriptions] = useState([emptyRx()]);
  const [chart, setChart] = useState({
    allergies: "",
    chronicConditions: "",
    currentMedications: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const load = useCallback(async () => {
    if (!appointmentId) return;
    setLoading(true);
    setMsg({ type: "", text: "" });
    try {
      const [apptRes, tmplRes] = await Promise.all([
        api(`/appointments/${appointmentId}`),
        api("/clinics/template"),
      ]);
      if (!apptRes.ok) {
        const err = await apptRes.json();
        setMsg({ type: "error", text: err.error || "Appointment not found" });
        setLoading(false);
        return;
      }
      const appt = await apptRes.json();
      const tmpl = await tmplRes.json();
      setData(appt);
      setTemplate(tmpl.template || []);
      const td = appt.visitNote?.templateData || {};
      setFormData(td);
      setPrescriptions(
        Array.isArray(td.prescriptions) && td.prescriptions.length
          ? td.prescriptions
          : [emptyRx()]
      );
      setChart({
        allergies: appt.patient?.allergies || "",
        chronicConditions: appt.patient?.chronicConditions || "",
        currentMedications: appt.patient?.currentMedications || "",
      });
    } catch {
      setMsg({ type: "error", text: "Failed to load consultation" });
    }
    setLoading(false);
  }, [appointmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const updateRx = (idx, field, value) => {
    setPrescriptions((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    );
  };

  const addRx = () => setPrescriptions((prev) => [...prev, emptyRx()]);
  const removeRx = (idx) =>
    setPrescriptions((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

  const saveChart = async () => {
    if (!data?.patient?.id) return;
    const res = await patchApi(`/patients/${data.patient.id}`, chart);
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error || "Failed to save chart");
    }
  };

  const saveNote = async () => {
    const res = await postApi("/visit-notes", {
      appointmentId,
      templateData: formData,
      prescriptions,
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error || "Failed to save note");
    }
  };

  const handleSave = async (completeAfter = false) => {
    setSaving(true);
    setMsg({ type: "", text: "" });
    try {
      await saveChart();
      await saveNote();
      if (completeAfter && data?.status === "in_progress") {
        await patchApi(`/appointments/${appointmentId}/status`, { status: "done" });
      } else if (completeAfter && data?.status === "waiting") {
        await patchApi(`/appointments/${appointmentId}/status`, { status: "in_progress" });
        await patchApi(`/appointments/${appointmentId}/status`, { status: "done" });
      }
      setMsg({ type: "success", text: completeAfter ? "Saved and visit completed" : "Consultation saved" });
      if (completeAfter && onDone) {
        setTimeout(() => onDone(), 600);
      } else {
        load();
      }
    } catch (e) {
      setMsg({ type: "error", text: e.message || "Save failed" });
    }
    setSaving(false);
  };

  const startConsult = async () => {
    if (data?.status !== "waiting") return;
    await patchApi(`/appointments/${appointmentId}/status`, { status: "in_progress" });
    load();
  };

  if (loading) return <div className="pat-empty">Opening consultation…</div>;
  if (!data) {
    return (
      <div className="consult-page">
        <button type="button" className="pat-back-btn" onClick={onBack}>← Back</button>
        <div className="pat-alert pat-alert--error">{msg.text || "Not found"}</div>
      </div>
    );
  }

  const history = data.history || [];

  return (
    <div className="consult-page">
      <div className="consult-top">
        <button type="button" className="pat-back-btn" onClick={onBack}>← Back to My Day</button>
        <div className="consult-top-actions">
          {data.status === "waiting" && (
            <button type="button" className="pat-btn pat-btn--primary" onClick={startConsult}>
              Start Consultation
            </button>
          )}
          <button
            type="button"
            className="pat-btn pat-btn--ghost"
            disabled={saving}
            onClick={() => handleSave(false)}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            className="pat-btn pat-btn--primary"
            disabled={saving}
            onClick={() => handleSave(true)}
          >
            Save & Complete
          </button>
        </div>
      </div>

      {msg.text && (
        <div className={`pat-alert pat-alert--${msg.type === "error" ? "error" : "success"}`}>
          {msg.text}
        </div>
      )}

      <div className="consult-layout">
        <aside className="consult-sidebar">
          <div className="consult-patient-card">
            <div className="consult-avatar">{data.patient?.name?.charAt(0)}</div>
            <h2>{data.patient?.name}</h2>
            <p>{data.patient?.phone}</p>
            <p className="consult-muted">
              {data.patient?.gender || "—"} · {data.patient?.cnic || "No CNIC"}
            </p>
            <span className={`alshifa-badge alshifa-badge--${
              data.status === "in_progress" ? "progress" : data.status === "done" ? "done" : "waiting"
            }`}>
              {data.status.replace("_", " ")}
            </span>
          </div>

          <div className="consult-block">
            <h3>Clinical chart</h3>
            <label className="pat-form-label">Allergies</label>
            <textarea
              className="pat-form-input cnote-textarea"
              rows={2}
              value={chart.allergies}
              onChange={(e) => setChart((c) => ({ ...c, allergies: e.target.value }))}
              placeholder="Known allergies"
            />
            <label className="pat-form-label">Chronic conditions</label>
            <textarea
              className="pat-form-input cnote-textarea"
              rows={2}
              value={chart.chronicConditions}
              onChange={(e) => setChart((c) => ({ ...c, chronicConditions: e.target.value }))}
            />
            <label className="pat-form-label">Current medications</label>
            <textarea
              className="pat-form-input cnote-textarea"
              rows={2}
              value={chart.currentMedications}
              onChange={(e) => setChart((c) => ({ ...c, currentMedications: e.target.value }))}
            />
          </div>

          <div className="consult-block">
            <h3>Visit history</h3>
            {history.length === 0 ? (
              <p className="consult-muted">No previous notes</p>
            ) : (
              <div className="consult-history">
                {history.map((n) => (
                  <div key={n.id} className="consult-history-item">
                    <strong>{fmtDate(n.appointment?.scheduledAt || n.createdAt)}</strong>
                    <span>{n.appointment?.staff?.name}</span>
                    <p>
                      {(n.templateData?.diagnosis || n.templateData?.symptoms || "—").toString().slice(0, 120)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        <main className="consult-main">
          <div className="consult-block">
            <h3>This visit</h3>
            <p className="consult-muted">Dr. {data.staff?.name} · {fmtDate(data.scheduledAt)}</p>
            {data.notes && <p className="consult-desk-note">Front desk: {data.notes}</p>}

            {template.map((field) => (
              <div key={field.key} className="pat-form-group" style={{ marginTop: "1rem" }}>
                <label className="pat-form-label">{field.label}</label>
                {field.type === "textarea" ? (
                  <textarea
                    className="pat-form-input cnote-textarea"
                    rows={3}
                    value={formData[field.key] || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                  />
                ) : (
                  <input
                    className="pat-form-input"
                    type={field.type === "number" ? "number" : "text"}
                    value={formData[field.key] || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                  />
                )}
              </div>
            ))}
          </div>

          <div className="consult-block">
            <div className="consult-rx-header">
              <h3>Prescriptions</h3>
              <button type="button" className="pat-btn pat-btn--sm pat-btn--ghost" onClick={addRx}>
                + Add medicine
              </button>
            </div>
            <div className="consult-rx-list">
              {prescriptions.map((rx, idx) => (
                <div key={idx} className="consult-rx-row">
                  <input
                    className="pat-form-input"
                    placeholder="Medicine"
                    value={rx.drug}
                    onChange={(e) => updateRx(idx, "drug", e.target.value)}
                  />
                  <input
                    className="pat-form-input"
                    placeholder="Dose"
                    value={rx.dose}
                    onChange={(e) => updateRx(idx, "dose", e.target.value)}
                  />
                  <input
                    className="pat-form-input"
                    placeholder="Frequency"
                    value={rx.frequency}
                    onChange={(e) => updateRx(idx, "frequency", e.target.value)}
                  />
                  <input
                    className="pat-form-input"
                    placeholder="Duration"
                    value={rx.duration}
                    onChange={(e) => updateRx(idx, "duration", e.target.value)}
                  />
                  <input
                    className="pat-form-input"
                    placeholder="Instructions"
                    value={rx.instructions}
                    onChange={(e) => updateRx(idx, "instructions", e.target.value)}
                  />
                  <button
                    type="button"
                    className="bill-remove-item-btn"
                    onClick={() => removeRx(idx)}
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
