import { useState, useEffect, useCallback } from "react";
import { api, patchApi } from "../api";
import "./DoctorDay.css";

function fmtTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function DoctorDayPage({ user, onOpenConsultation }) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState({
    waitingNow: 0,
    inProgressNow: 0,
    doneToday: 0,
    patientsToday: 0,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api("/dashboard/today");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setQueue(data.queue || []);
      setMetrics(data.metrics || {});
    } catch {
      setError("Could not load your schedule. Is the API running?");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatus = async (id, status) => {
    try {
      const res = await patchApi(`/appointments/${id}/status`, { status });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || "Status update failed");
        return;
      }
      load();
    } catch {
      alert("Cannot reach server");
    }
  };

  return (
    <div className="doc-day">
      <div className="doc-day-hero">
        <div>
          <p className="doc-day-eyebrow">Doctor workspace</p>
          <h2 className="doc-day-greeting">
            Assalam o Alaikum, {user?.name?.split(" ")[0] || "Doctor"}
          </h2>
          <p className="doc-day-date">
            {new Date().toLocaleDateString("en-PK", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <button type="button" className="pat-btn pat-btn--ghost" onClick={load}>
          Refresh
        </button>
      </div>

      <div className="doc-day-metrics">
        <div className="doc-metric doc-metric--accent">
          <span className="doc-metric-label">Patients today</span>
          <span className="doc-metric-value">{metrics.patientsToday || 0}</span>
        </div>
        <div className="doc-metric">
          <span className="doc-metric-label">Waiting</span>
          <span className="doc-metric-value">{metrics.waitingNow || 0}</span>
        </div>
        <div className="doc-metric">
          <span className="doc-metric-label">In progress</span>
          <span className="doc-metric-value">{metrics.inProgressNow || 0}</span>
        </div>
        <div className="doc-metric">
          <span className="doc-metric-label">Completed</span>
          <span className="doc-metric-value">{metrics.doneToday || 0}</span>
        </div>
      </div>

      {error && <div className="pat-alert pat-alert--error">{error}</div>}

      <section className="doc-queue-panel">
        <div className="doc-queue-header">
          <h3>My queue</h3>
          <span className="appt-count-badge">{queue.length} patients</span>
        </div>

        {loading ? (
          <div className="pat-empty">Loading your schedule…</div>
        ) : queue.length === 0 ? (
          <div className="pat-empty">No patients assigned to you today.</div>
        ) : (
          <div className="doc-queue-list">
            {queue.map((appt, idx) => (
              <div key={appt.id} className={`doc-queue-card doc-queue-card--${appt.status}`}>
                <div className="doc-queue-left">
                  <span className="appt-queue-num">#{idx + 1}</span>
                  <div>
                    <div className="doc-queue-name">{appt.patient?.name}</div>
                    <div className="doc-queue-meta">
                      {appt.patient?.phone} · {fmtTime(appt.scheduledAt)}
                      {appt.notes ? ` · ${appt.notes}` : ""}
                    </div>
                  </div>
                </div>
                <div className="doc-queue-actions">
                  <span className={`alshifa-badge alshifa-badge--${
                    appt.status === "in_progress" ? "progress" : appt.status === "done" ? "done" : "waiting"
                  }`}>
                    {appt.status.replace("_", " ")}
                  </span>

                  {appt.status === "waiting" && (
                    <button
                      type="button"
                      className="pat-btn pat-btn--sm pat-btn--primary"
                      onClick={() => handleStatus(appt.id, "in_progress")}
                    >
                      Call In
                    </button>
                  )}

                  {(appt.status === "waiting" || appt.status === "in_progress") && (
                    <button
                      type="button"
                      className="pat-btn pat-btn--sm pat-btn--ghost"
                      onClick={() => onOpenConsultation(appt.id)}
                    >
                      Open Consultation
                    </button>
                  )}

                  {appt.status === "in_progress" && (
                    <button
                      type="button"
                      className="pat-btn pat-btn--sm pat-btn--success"
                      onClick={() => handleStatus(appt.id, "done")}
                    >
                      Complete
                    </button>
                  )}

                  {appt.status === "done" && (
                    <button
                      type="button"
                      className="pat-btn pat-btn--sm pat-btn--ghost"
                      onClick={() => onOpenConsultation(appt.id)}
                    >
                      View Note
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
