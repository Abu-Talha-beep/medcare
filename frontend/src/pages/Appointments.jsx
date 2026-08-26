import { useState, useEffect, useCallback } from "react";
import { api, postApi, patchApi } from "../api";
import ClinicalNoteForm from "../components/ClinicalNoteForm";
import ClinicalTemplateConfig from "../components/ClinicalTemplateConfig";
import "./Appointments.css";

// Helper: format ISO time to 12-hour format e.g. "02:30 PM"
function fmtTime(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  return d.toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// Helper: format date to YYYY-MM-DD for date input
function toYYYYMMDD(d) {
  const date = d || new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AppointmentsPage() {
  const [activeTab, setActiveTab] = useState("queue"); // "queue" | "calendar"
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState("");

  // Clinical Notes Modal State
  const [activeNoteAppt, setActiveNoteAppt] = useState(null);
  const [showTemplateConfig, setShowTemplateConfig] = useState(false);

  // Queue state
  const [queue, setQueue] = useState([]);
  const [queueLoading, setQueueLoading] = useState(false);

  // Calendar state
  const [calDate, setCalDate] = useState(toYYYYMMDD(new Date()));
  const [calAppts, setCalAppts] = useState([]);
  const [calLoading, setCalLoading] = useState(false);

  // Modal / Booking flow state
  const [showModal, setShowModal] = useState(false);
  const [bookingType, setBookingType] = useState("walkin"); // "walkin" | "future"
  const [patientTab, setPatientTab] = useState("search"); // "search" | "new"

  // Patient search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);

  // New patient inline state
  const [newPatName, setNewPatName] = useState("");
  const [newPatPhone, setNewPatPhone] = useState("");
  const [newPatGender, setNewPatGender] = useState("");

  // Booking fields
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [bookingDate, setBookingDate] = useState(toYYYYMMDD(new Date()));
  const [bookingTime, setBookingTime] = useState("10:00");
  const [notes, setNotes] = useState("");
  const [modalError, setModalError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── Load Doctors ─────────────────────────────────────────────
  useEffect(() => {
    api("/appointments/doctors")
      .then((r) => r.json())
      .then((docs) => {
        setDoctors(docs || []);
        if (docs && docs.length > 0) {
          setSelectedDoctor(docs[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // ── Load Today's Queue ───────────────────────────────────────
  const fetchQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const url = selectedDoctorFilter
        ? `/appointments/today?staffId=${selectedDoctorFilter}`
        : "/appointments/today";
      const res = await api(url);
      const data = await res.json();
      setQueue(data.appointments || []);
    } catch {
      // silent
    }
    setQueueLoading(false);
  }, [selectedDoctorFilter]);

  useEffect(() => {
    if (activeTab === "queue") {
      fetchQueue();
    }
  }, [activeTab, fetchQueue]);

  // ── Load Calendar / Day View ─────────────────────────────────
  const fetchCalendar = useCallback(async () => {
    setCalLoading(true);
    try {
      let url = `/appointments/by-date?date=${calDate}`;
      if (selectedDoctorFilter) {
        url += `&staffId=${selectedDoctorFilter}`;
      }
      const res = await api(url);
      const data = await res.json();
      setCalAppts(data.appointments || []);
    } catch {
      // silent
    }
    setCalLoading(false);
  }, [calDate, selectedDoctorFilter]);

  useEffect(() => {
    if (activeTab === "calendar") {
      fetchCalendar();
    }
  }, [activeTab, fetchCalendar]);

  // ── Patient search in modal ──────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      api(`/patients/search?q=${encodeURIComponent(searchQuery.trim())}`)
        .then((r) => r.json())
        .then((data) => setSearchResults(data.patients || []))
        .catch(() => setSearchResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── Advance Appointment Status ──────────────────────────────
  const handleStatusChange = async (id, newStatus) => {
    try {
      const res = await patchApi(`/appointments/${id}/status`, { status: newStatus });
      if (res.ok) {
        if (activeTab === "queue") fetchQueue();
        if (activeTab === "calendar") fetchCalendar();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update status");
      }
    } catch {
      alert("Network error updating status");
    }
  };

  // ── Open Booking Modal ───────────────────────────────────────
  const openBookingModal = (defaultType = "walkin") => {
    setBookingType(defaultType);
    setPatientTab("search");
    setSearchQuery("");
    setSearchResults([]);
    setSelectedPatient(null);
    setNewPatName("");
    setNewPatPhone("");
    setNewPatGender("");
    setNotes("");
    setModalError("");
    setBookingDate(toYYYYMMDD(new Date()));
    setBookingTime("10:00");
    if (doctors.length > 0 && !selectedDoctor) {
      setSelectedDoctor(doctors[0].id);
    }
    setShowModal(true);
  };

  // ── Submit Booking Form ──────────────────────────────────────
  const handleBookSubmit = async (e) => {
    e.preventDefault();
    setModalError("");
    setSubmitting(true);

    try {
      let patientId = selectedPatient?.id;

      // Inline create patient if on "new" tab
      if (patientTab === "new") {
        if (!newPatName || !newPatPhone) {
          setModalError("Patient name and phone are required");
          setSubmitting(false);
          return;
        }

        const patRes = await postApi("/patients", {
          name: newPatName,
          phone: newPatPhone,
          gender: newPatGender || undefined,
          confirmDuplicate: true,
        });

        const patData = await patRes.json();
        if (!patRes.ok) {
          setModalError(patData.error || "Failed to create patient");
          setSubmitting(false);
          return;
        }
        patientId = patData.id;
      }

      if (!patientId) {
        setModalError("Please select or register a patient");
        setSubmitting(false);
        return;
      }

      if (!selectedDoctor) {
        setModalError("Please select a doctor");
        setSubmitting(false);
        return;
      }

      let scheduledAt;
      if (bookingType === "walkin") {
        scheduledAt = new Date().toISOString();
      } else {
        const combinedStr = `${bookingDate}T${bookingTime}:00`;
        scheduledAt = new Date(combinedStr).toISOString();
      }

      const apptRes = await postApi("/appointments", {
        patientId,
        staffId: selectedDoctor,
        scheduledAt,
        notes: notes || undefined,
      });

      const apptData = await apptRes.json();
      if (!apptRes.ok) {
        setModalError(apptData.error || "Failed to create appointment");
        setSubmitting(false);
        return;
      }

      setShowModal(false);
      setSubmitting(false);

      // Refresh view
      if (activeTab === "queue") fetchQueue();
      if (activeTab === "calendar") fetchCalendar();
    } catch {
      setModalError("Cannot connect to server");
      setSubmitting(false);
    }
  };

  // ── Status badge renderer ─────────────────────────────────────
  const renderStatusBadge = (status) => {
    const statusMap = {
      waiting: { label: "Waiting", class: "appt-status--waiting" },
      in_progress: { label: "In Progress", class: "appt-status--progress" },
      done: { label: "Done", class: "appt-status--done" },
      cancelled: { label: "Cancelled", class: "appt-status--cancelled" },
      no_show: { label: "No Show", class: "appt-status--noshow" },
    };
    const s = statusMap[status] || { label: status, class: "" };
    return (
      <span className={`appt-status-badge ${s.class}`}>
        <span className="appt-status-dot" />
        {s.label}
      </span>
    );
  };

  return (
    <div className="appt-page">
      {/* ── Top Bar ────────────────────────────────────────── */}
      <div className="appt-topbar">
        <div className="appt-topbar-left">
          <div className="appt-tabs">
            <button
              className={`appt-tab ${activeTab === "queue" ? "appt-tab--active" : ""}`}
              onClick={() => setActiveTab("queue")}
            >
              📋 Today's Queue
            </button>
            <button
              className={`appt-tab ${activeTab === "calendar" ? "appt-tab--active" : ""}`}
              onClick={() => setActiveTab("calendar")}
            >
              Schedule / Calendar
            </button>
          </div>
        </div>

        <div className="appt-topbar-right">
          {/* Doctor filter dropdown */}
          <select
            className="appt-filter-select"
            value={selectedDoctorFilter}
            onChange={(e) => setSelectedDoctorFilter(e.target.value)}
          >
            <option value="">All Doctors</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <button
            className="pat-btn pat-btn--ghost pat-btn--sm"
            onClick={() => setShowTemplateConfig(true)}
            title="Configure clinical note template"
          >
            ⚙️ Note Template
          </button>

          <button
            className="pat-btn pat-btn--primary"
            onClick={() => openBookingModal("walkin")}
            id="appt-walkin-btn"
          >
            ⚡ Walk-in Check-in
          </button>

          <button
            className="pat-btn pat-btn--ghost"
            onClick={() => openBookingModal("future")}
            id="appt-book-btn"
          >
            + Book Future
          </button>
        </div>
      </div>

      {/* ── QUEUE VIEW ──────────────────────────────────────── */}
      {activeTab === "queue" && (
        <div className="appt-view-container">
          <div className="appt-view-header">
            <h2 className="appt-view-title">Front Desk Queue — Today</h2>
            <span className="appt-count-badge">{queue.length} Patients Today</span>
          </div>

          {queueLoading ? (
            <div className="pat-empty">Loading today's queue…</div>
          ) : queue.length === 0 ? (
            <div className="pat-empty">
              No patients in the queue for today. Click "Walk-in Check-in" to register a patient.
            </div>
          ) : (
            <div className="appt-queue-list">
              {queue.map((appt, idx) => (
                <div key={appt.id} className="appt-card">
                  <div className="appt-queue-num">#{idx + 1}</div>

                  <div className="appt-card-main">
                    <div className="appt-patient-info">
                      <span className="appt-patient-name">{appt.patient?.name}</span>
                      <span className="appt-patient-phone">{appt.patient?.phone}</span>
                    </div>

                    <div className="appt-meta-info">
                      <span className="appt-doctor-name">{appt.staff?.name}</span>
                      <span className="appt-time">{fmtTime(appt.scheduledAt)}</span>
                      {appt.notes && <span className="appt-notes">{appt.notes}</span>}
                    </div>
                  </div>

                  <div className="appt-card-right">
                    {renderStatusBadge(appt.status)}

                    {/* Quick action buttons */}
                    <div className="appt-actions">
                      <button
                        className="pat-btn pat-btn--sm pat-btn--ghost"
                        onClick={() => setActiveNoteAppt(appt)}
                        title="Doctor Clinical Notes"
                      >
                        Clinical Note
                      </button>

                      {appt.status === "waiting" && (
                        <>
                          <button
                            className="pat-btn pat-btn--sm pat-btn--primary"
                            onClick={() => handleStatusChange(appt.id, "in_progress")}
                          >
                            Call In
                          </button>
                          <button
                            className="pat-btn pat-btn--sm pat-btn--ghost"
                            onClick={() => handleStatusChange(appt.id, "no_show")}
                          >
                            No Show
                          </button>
                        </>
                      )}

                      {appt.status === "in_progress" && (
                        <>
                          <button
                            className="pat-btn pat-btn--sm pat-btn--success"
                            onClick={() => handleStatusChange(appt.id, "done")}
                          >
                            Complete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Render Clinical Note Form Modal */}
      {activeNoteAppt && (
        <ClinicalNoteForm
          appointmentId={activeNoteAppt.id}
          patientName={activeNoteAppt.patient?.name}
          doctorName={activeNoteAppt.staff?.name}
          onClose={() => setActiveNoteAppt(null)}
          onSaved={() => {
            if (activeTab === "queue") fetchQueue();
            if (activeTab === "calendar") fetchCalendar();
          }}
        />
      )}

      {/* Render Clinical Template Configurator Modal */}
      {showTemplateConfig && (
        <ClinicalTemplateConfig onClose={() => setShowTemplateConfig(false)} />
      )}

      {/* ── CALENDAR / DAY VIEW ─────────────────────────────── */}
      {activeTab === "calendar" && (
        <div className="appt-view-container">
          <div className="appt-cal-controls">
            <div className="appt-date-picker-group">
              <label htmlFor="cal-date" className="pat-form-label">
                Select Date:
              </label>
              <input
                id="cal-date"
                type="date"
                className="pat-form-input"
                value={calDate}
                onChange={(e) => setCalDate(e.target.value)}
                style={{ width: "auto" }}
              />
              <button
                className="pat-btn pat-btn--ghost pat-btn--sm"
                onClick={() => setCalDate(toYYYYMMDD(new Date()))}
              >
                Today
              </button>
            </div>
            <span className="appt-count-badge">{calAppts.length} Scheduled</span>
          </div>

          {calLoading ? (
            <div className="pat-empty">Loading schedule…</div>
          ) : calAppts.length === 0 ? (
            <div className="pat-empty">No appointments scheduled for {calDate}.</div>
          ) : (
            <div className="appt-queue-list">
              {calAppts.map((appt) => (
                <div key={appt.id} className="appt-card">
                  <div className="appt-card-main">
                    <div className="appt-patient-info">
                      <span className="appt-patient-name">{appt.patient?.name}</span>
                      <span className="appt-patient-phone">{appt.patient?.phone}</span>
                    </div>

                    <div className="appt-meta-info">
                      <span className="appt-doctor-name">{appt.staff?.name}</span>
                      <span className="appt-time">{fmtTime(appt.scheduledAt)}</span>
                      {appt.notes && <span className="appt-notes">{appt.notes}</span>}
                    </div>
                  </div>

                  <div className="appt-card-right">
                    {renderStatusBadge(appt.status)}
                    <div className="appt-actions">
                      {appt.status === "waiting" && (
                        <button
                          className="pat-btn pat-btn--sm pat-btn--primary"
                          onClick={() => handleStatusChange(appt.id, "in_progress")}
                        >
                          Call In
                        </button>
                      )}
                      {appt.status === "in_progress" && (
                        <button
                          className="pat-btn pat-btn--sm pat-btn--success"
                          onClick={() => handleStatusChange(appt.id, "done")}
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── BOOKING / WALK-IN MODAL ─────────────────────────── */}
      {showModal && (
        <div className="appt-modal-overlay">
          <div className="appt-modal-card">
            <div className="appt-modal-header">
              <h3 className="appt-modal-title">
                {bookingType === "walkin" ? "New Walk-in Check-in" : "Book Future Appointment"}
              </h3>
              <button className="appt-modal-close" onClick={() => setShowModal(false)}>
                ✕
              </button>
            </div>

            {modalError && <div className="pat-alert pat-alert--error">{modalError}</div>}

            <form onSubmit={handleBookSubmit} className="appt-modal-form">
              {/* Type Switcher */}
              <div className="appt-type-switcher">
                <button
                  type="button"
                  className={`appt-type-btn ${bookingType === "walkin" ? "appt-type-btn--active" : ""}`}
                  onClick={() => setBookingType("walkin")}
                >
                  ⚡ Walk-in (Now)
                </button>
                <button
                  type="button"
                  className={`appt-type-btn ${bookingType === "future" ? "appt-type-btn--active" : ""}`}
                  onClick={() => setBookingType("future")}
                >
                  Future Date/Time
                </button>
              </div>

              {/* Patient Selection Tabs */}
              <div className="appt-patient-section">
                <label className="pat-form-label">Patient <span className="pat-required">*</span></label>
                <div className="appt-patient-tabs">
                  <button
                    type="button"
                    className={`appt-ptab ${patientTab === "search" ? "appt-ptab--active" : ""}`}
                    onClick={() => setPatientTab("search")}
                  >
                    🔍 Existing Patient
                  </button>
                  <button
                    type="button"
                    className={`appt-ptab ${patientTab === "new" ? "appt-ptab--active" : ""}`}
                    onClick={() => {
                      setPatientTab("new");
                      setSelectedPatient(null);
                    }}
                  >
                    + Register New Patient
                  </button>
                </div>

                {patientTab === "search" && (
                  <div className="appt-psearch-block">
                    {selectedPatient ? (
                      <div className="appt-selected-patient">
                        <div>
                          <strong>{selectedPatient.name}</strong> ({selectedPatient.phone})
                        </div>
                        <button
                          type="button"
                          className="pat-btn pat-btn--ghost pat-btn--sm"
                          onClick={() => setSelectedPatient(null)}
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          type="text"
                          className="pat-form-input"
                          placeholder="Search patient by name or phone…"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          autoFocus
                        />
                        {searchResults.length > 0 && (
                          <div className="appt-psearch-results">
                            {searchResults.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                className="appt-psearch-item"
                                onClick={() => setSelectedPatient(p)}
                              >
                                <span className="appt-psearch-name">{p.name}</span>
                                <span className="appt-psearch-phone">{p.phone}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {patientTab === "new" && (
                  <div className="appt-pnew-block">
                    <div className="pat-form-row">
                      <div className="pat-form-group">
                        <label className="pat-form-label">Full Name *</label>
                        <input
                          type="text"
                          className="pat-form-input"
                          placeholder="Patient Name"
                          value={newPatName}
                          onChange={(e) => setNewPatName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="pat-form-group">
                        <label className="pat-form-label">Phone *</label>
                        <input
                          type="tel"
                          className="pat-form-input"
                          placeholder="03001234567"
                          value={newPatPhone}
                          onChange={(e) => setNewPatPhone(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Doctor Picker */}
              <div className="pat-form-group">
                <label className="pat-form-label">Assign Doctor <span className="pat-required">*</span></label>
                {doctors.length === 0 ? (
                  <div className="pat-alert pat-alert--warning">
                    No doctors available in staff records. Create a doctor account first.
                  </div>
                ) : (
                  <select
                    className="pat-form-input pat-form-select"
                    value={selectedDoctor}
                    onChange={(e) => setSelectedDoctor(e.target.value)}
                    required
                  >
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Date & Time if Future */}
              {bookingType === "future" && (
                <div className="pat-form-row">
                  <div className="pat-form-group">
                    <label className="pat-form-label">Date *</label>
                    <input
                      type="date"
                      className="pat-form-input"
                      value={bookingDate}
                      onChange={(e) => setBookingDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="pat-form-group">
                    <label className="pat-form-label">Time *</label>
                    <input
                      type="time"
                      className="pat-form-input"
                      value={bookingTime}
                      onChange={(e) => setBookingTime(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="pat-form-group">
                <label className="pat-form-label">Reason / Notes (Optional)</label>
                <input
                  type="text"
                  className="pat-form-input"
                  placeholder="e.g. Fever, Follow-up, Routine checkup"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="pat-form-actions">
                <button
                  type="button"
                  className="pat-btn pat-btn--ghost"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="pat-btn pat-btn--primary"
                  disabled={submitting}
                >
                  {submitting ? "Saving…" : bookingType === "walkin" ? "Check In Now" : "Confirm Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
