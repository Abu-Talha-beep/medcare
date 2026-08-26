import { useState, useEffect, useCallback } from "react";
import { api, patchApi } from "../api";
import ClinicalNoteForm from "../components/ClinicalNoteForm";
import "./Dashboard.css";

function fmtCurrency(amt) {
  const num = parseFloat(amt) || 0;
  return `Rs ${num.toLocaleString("en-PK")}`;
}

function fmtTime(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function toYYYYMMDD(d) {
  const date = d || new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function DashboardPage({ onNavigate, user, onOpenConsultation }) {
  const [activeSubTab, setActiveSubTab] = useState("overview"); // "overview" | "reports"
  const canReports = user?.role === "admin";
  const canClinical = user?.role === "admin" || user?.role === "doctor";
  const isReceptionist = user?.role === "receptionist";

  // Overview Today State
  const [todayData, setTodayData] = useState(null);
  const [loadingToday, setLoadingToday] = useState(true);

  // Clinical Note Modal State
  const [activeNoteAppt, setActiveNoteAppt] = useState(null);

  // Reports State
  const [reportStartDate, setReportStartDate] = useState(
    toYYYYMMDD(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000))
  );
  const [reportEndDate, setReportEndDate] = useState(toYYYYMMDD(new Date()));
  const [reportData, setReportData] = useState(null);
  const [loadingReports, setLoadingReports] = useState(false);

  // ── Load Today's Dashboard ───────────────────────────────────
  const fetchTodayDashboard = useCallback(async () => {
    setLoadingToday(true);
    try {
      const res = await api("/dashboard/today");
      if (res.ok) {
        const data = await res.json();
        setTodayData(data);
      }
    } catch {
      // silent
    }
    setLoadingToday(false);
  }, []);

  // ── Load Date-Range Report ───────────────────────────────────
  const fetchReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const res = await api(
        `/dashboard/reports?startDate=${reportStartDate}&endDate=${reportEndDate}`
      );
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      }
    } catch {
      // silent
    }
    setLoadingReports(false);
  }, [reportStartDate, reportEndDate]);

  useEffect(() => {
    fetchTodayDashboard();
  }, [fetchTodayDashboard]);

  useEffect(() => {
    if (activeSubTab === "reports") {
      fetchReports();
    }
  }, [activeSubTab, fetchReports]);

  // ── Appointment Status Update ────────────────────────────────
  const handleStatusChange = async (appointmentId, newStatus) => {
    try {
      const res = await patchApi(`/appointments/${appointmentId}/status`, {
        status: newStatus,
      });
      if (res.ok) {
        fetchTodayDashboard();
      }
    } catch {
      alert("Failed to update appointment status");
    }
  };

  // Quick Preset Helper for Reports
  const setDatePreset = (daysAgo) => {
    const end = new Date();
    const start = new Date(end.getTime() - (daysAgo - 1) * 24 * 60 * 60 * 1000);
    setReportStartDate(toYYYYMMDD(start));
    setReportEndDate(toYYYYMMDD(end));
  };

  const metrics = todayData?.metrics || {
    patientsToday: 0,
    revenueToday: 0,
    waitingNow: 0,
    lowStockAlerts: 0,
  };

  const enabledModules = todayData?.enabledModules || {
    patients: true,
    appointments: true,
    billing: true,
    inventory: true,
  };

  const queue = todayData?.queue || [];

  return (
    <div className="dash-landing-page">
      {/* Subtab Navigation Bar */}
      <div className="dash-subnav">
        <button
          className={`dash-subnav-btn ${activeSubTab === "overview" ? "dash-subnav-btn--active" : ""}`}
          onClick={() => setActiveSubTab("overview")}
        >
          Today's Overview
        </button>
        {canReports && (
          <button
            className={`dash-subnav-btn ${activeSubTab === "reports" ? "dash-subnav-btn--active" : ""}`}
            onClick={() => setActiveSubTab("reports")}
          >
            Reports & Analytics
          </button>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════
         SUBTAB 1: TODAY'S OVERVIEW & QUEUE
         ═════════════════════════════════════════════════════════ */}
      {activeSubTab === "overview" && (
        <>
          {/* Dynamic Al-Shifa Metric Row (Scoped to Enabled Modules) */}
          <div className="alshifa-metrics-row">
            {/* Patients Today Metric */}
            {enabledModules.patients !== false && (
              <div
                className="alshifa-metric-col"
                onClick={() => onNavigate && onNavigate("patients")}
                style={{ cursor: "pointer" }}
              >
                <span className="alshifa-metric-label">
                  Patients
                  <br />
                  today
                </span>
                <span className="alshifa-metric-value">{metrics.patientsToday}</span>
              </div>
            )}

            {/* Revenue Today Metric (Only if Billing module enabled) */}
            {enabledModules.billing !== false && user?.role !== "doctor" && (
              <div
                className="alshifa-metric-col"
                onClick={() => onNavigate && onNavigate("billing")}
                style={{ cursor: "pointer" }}
              >
                <span className="alshifa-metric-label">
                  Revenue
                  <br />
                  today
                </span>
                <div className="alshifa-metric-value-wrap">
                  <span className="alshifa-currency">Rs</span>
                  <span className="alshifa-metric-value">
                    {metrics.revenueToday.toLocaleString("en-PK")}
                  </span>
                </div>
              </div>
            )}

            {/* Waiting Now Metric (Only if Appointments module enabled) */}
            {enabledModules.appointments !== false && (
              <div
                className="alshifa-metric-col"
                onClick={() => onNavigate && onNavigate("appointments")}
                style={{ cursor: "pointer" }}
              >
                <span className="alshifa-metric-label">
                  Waiting
                  <br />
                  now
                </span>
                <span className="alshifa-metric-value">{metrics.waitingNow}</span>
              </div>
            )}

            {/* Low Stock Alerts Metric (Only if Inventory module enabled) */}
            {enabledModules.inventory !== false && user?.role === "admin" && (
              <div
                className="alshifa-metric-col"
                onClick={() => onNavigate && onNavigate("inventory")}
                style={{ cursor: "pointer" }}
              >
                <span className="alshifa-metric-label">
                  Low Stock
                  <br />
                  alerts
                </span>
                <div className="alshifa-metric-value-wrap">
                  <span className="alshifa-metric-value" style={{ color: metrics.lowStockAlerts > 0 ? "#b91c1c" : "inherit" }}>
                    {metrics.lowStockAlerts}
                  </span>
                  {metrics.lowStockAlerts > 0 && (
                    <span className="dash-low-stock-alert">Restock needed</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Today's Queue Section */}
          <div className="alshifa-queue-section">
            <div className="alshifa-queue-header">
              <h2 className="alshifa-queue-title">Queue — Today's Patients ({queue.length})</h2>
            </div>

            {loadingToday ? (
              <div className="pat-empty">Loading today's live queue…</div>
            ) : queue.length === 0 ? (
              <div className="pat-empty">
                No appointments in queue for today. Click "Appointments" to check in a walk-in patient.
              </div>
            ) : (
              <div className="alshifa-queue-list">
                {queue.map((appt, idx) => (
                  <div key={appt.id} className="alshifa-queue-card" style={{ cursor: "default" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      <span className="appt-queue-num">#{idx + 1}</span>
                      <div>
                        <span className="alshifa-queue-name">{appt.patient?.name}</span>
                        <div style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>
                          {appt.patient?.phone} · Dr. {appt.staff?.name} · {fmtTime(appt.scheduledAt)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      {/* Clinical Note Action */}
                      {canClinical && (
                        <button
                          className="pat-btn pat-btn--sm pat-btn--ghost"
                          onClick={() => {
                            if (onOpenConsultation) onOpenConsultation(appt.id);
                            else setActiveNoteAppt(appt);
                          }}
                          title="Add/View Clinical Consultation Note"
                        >
                          Clinical Note
                        </button>
                      )}

                      {/* Status Badges & Action Buttons */}
                      {appt.status === "waiting" && (
                        <>
                          <span className="alshifa-badge alshifa-badge--waiting">Waiting</span>
                          <button
                            className="pat-btn pat-btn--sm pat-btn--primary"
                            onClick={() => handleStatusChange(appt.id, "in_progress")}
                          >
                            Call In
                          </button>
                        </>
                      )}

                      {appt.status === "in_progress" && (
                        <>
                          <span className="alshifa-badge alshifa-badge--progress">In Progress</span>
                          <button
                            className="pat-btn pat-btn--sm pat-btn--success"
                            onClick={() => handleStatusChange(appt.id, "done")}
                          >
                            Complete
                          </button>
                        </>
                      )}

                      {appt.status === "done" && (
                        <span className="alshifa-badge alshifa-badge--done">Done</span>
                      )}

                      {(appt.status === "cancelled" || appt.status === "no_show") && (
                        <span className="alshifa-badge" style={{ background: "#f3f4f6", color: "#6b7280" }}>
                          {appt.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Render Clinical Note Form Modal */}
          {activeNoteAppt && (
            <ClinicalNoteForm
              appointmentId={activeNoteAppt.id}
              patientName={activeNoteAppt.patient?.name}
              doctorName={activeNoteAppt.staff?.name}
              onClose={() => setActiveNoteAppt(null)}
              onSaved={() => fetchTodayDashboard()}
            />
          )}
        </>
      )}

      {/* ═════════════════════════════════════════════════════════
         SUBTAB 2: DATE-RANGE REPORTS & ANALYTICS
         ═════════════════════════════════════════════════════════ */}
      {canReports && activeSubTab === "reports" && (
        <div className="dash-report-container">
          {/* Controls Bar */}
          <div className="dash-report-controls">
            <div className="dash-report-dates">
              <div className="pat-form-group">
                <label className="pat-form-label">Start Date</label>
                <input
                  type="date"
                  className="pat-form-input"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                />
              </div>

              <div className="pat-form-group">
                <label className="pat-form-label">End Date</label>
                <input
                  type="date"
                  className="pat-form-input"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="dash-report-presets">
              <span className="cnote-preset-label">Presets:</span>
              <button
                className="pat-btn pat-btn--ghost pat-btn--sm"
                onClick={() => setDatePreset(7)}
              >
                Last 7 Days
              </button>
              <button
                className="pat-btn pat-btn--ghost pat-btn--sm"
                onClick={() => setDatePreset(30)}
              >
                Last 30 Days
              </button>
            </div>
          </div>

          {loadingReports ? (
            <div className="pat-empty">Generating date-range report…</div>
          ) : !reportData ? (
            <div className="pat-empty">No report data loaded.</div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="bill-summary-banner" style={{ margin: "1rem 0" }}>
                <div className="bill-sum-card">
                  <span className="bill-sum-label">Total Patients (Date Range)</span>
                  <span className="bill-sum-val">{reportData.totals?.totalPatients} Patients</span>
                </div>
                <div className="bill-sum-card">
                  <span className="bill-sum-label">Total Revenue (Date Range)</span>
                  <span className="bill-sum-val">{fmtCurrency(reportData.totals?.totalRevenue)}</span>
                </div>
                <div className="bill-sum-card">
                  <span className="bill-sum-label">Avg Patients / Day</span>
                  <span className="bill-sum-val">{reportData.totals?.avgPatientsPerDay} / day</span>
                </div>
              </div>

              {/* Visual CSS Bar Chart */}
              <div className="dash-chart-card">
                <h3 className="dash-chart-title">Daily Revenue & Patient Volume</h3>
                <div className="dash-chart-bars">
                  {reportData.days?.map((d) => {
                    const maxRev = Math.max(...reportData.days.map((x) => x.revenue || 1), 1000);
                    const heightPct = Math.min(100, Math.max(12, (d.revenue / maxRev) * 100));
                    return (
                      <div key={d.date} className="dash-chart-col">
                        <div className="dash-chart-bar-wrap" style={{ height: "140px" }}>
                          <div
                            className="dash-chart-bar"
                            style={{ height: `${heightPct}%` }}
                            title={`${d.date}: ${fmtCurrency(d.revenue)} (${d.patientCount} patients)`}
                          >
                            <span className="dash-bar-val">
                              {d.revenue > 0 ? `${Math.round(d.revenue / 1000)}k` : "0"}
                            </span>
                          </div>
                        </div>
                        <span className="dash-chart-label">{d.date.slice(5)}</span>
                        <span className="dash-chart-sublabel">{d.patientCount} pts</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Daily Breakdown Table */}
              <div className="dash-report-table-card">
                <h3 className="dash-chart-title">Itemized Daily Breakdown</h3>
                <table className="bill-receipt-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Patients Seen</th>
                      <th style={{ textAlign: "right" }}>Daily Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.days?.map((d) => (
                      <tr key={d.date}>
                        <td>{d.date}</td>
                        <td>{d.patientCount} patients</td>
                        <td style={{ textAlign: "right" }}>{fmtCurrency(d.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
