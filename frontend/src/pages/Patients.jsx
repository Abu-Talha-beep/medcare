import { useState, useEffect, useRef, useCallback } from "react";
import { api, postApi } from "../api";
import "./Patients.css";

// ─── Debounce hook ────────────────────────────────────────────
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Date formatter ───────────────────────────────────────────
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function PatientsPage({ canRegister = true }) {
  // View state: "list" | "register" | "detail"
  const [view, setView] = useState("list");
  const [patients, setPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [totalPatients, setTotalPatients] = useState(0);
  const [loading, setLoading] = useState(false);

  // Registration
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const searchRef = useRef(null);
  const debouncedQuery = useDebounce(searchQuery, 250);

  // ── Load patients (initial + search) ────────────────────────
  const loadPatients = useCallback(async () => {
    setLoading(true);
    try {
      if (debouncedQuery.trim()) {
        const res = await api(
          `/patients/search?q=${encodeURIComponent(debouncedQuery.trim())}`
        );
        const data = await res.json();
        setPatients(data.patients || []);
      } else {
        const res = await api("/patients?limit=50");
        const data = await res.json();
        setPatients(data.patients || []);
        setTotalPatients(data.pagination?.total || 0);
      }
    } catch {
      // silent
    }
    setLoading(false);
  }, [debouncedQuery]);

  useEffect(() => {
    if (view === "list") loadPatients();
  }, [view, loadPatients]);

  // Patient detail clinical history notes
  const [pastNotes, setPastNotes] = useState([]);

  const openDetail = async (patient) => {
    setSelectedPatient(patient);
    setView("detail");
    setPastNotes([]);
    try {
      const res = await api(`/visit-notes/patient/${patient.id}`);
      if (res.ok) {
        const data = await res.json();
        setPastNotes(data.notes || []);
      }
    } catch {
      // silent
    }
  };

  // ── Register patient ────────────────────────────────────────
  const handleRegister = async (e, confirmDuplicate = false) => {
    e.preventDefault();
    setRegError("");
    setRegSuccess("");
    setDuplicateWarning(null);
    setSubmitting(true);

    const form = new FormData(e.target);
    const body = {
      name: form.get("name"),
      phone: form.get("phone"),
      cnic: form.get("cnic") || undefined,
      dateOfBirth: form.get("dob") || undefined,
      gender: form.get("gender") || undefined,
      address: form.get("address") || undefined,
      confirmDuplicate,
    };

    try {
      const res = await postApi("/patients", body);
      const data = await res.json();

      if (res.status === 409 && data.duplicates && !confirmDuplicate) {
        setDuplicateWarning(data);
        setSubmitting(false);
        return;
      }

      if (!res.ok) {
        setRegError(data.error || "Registration failed");
        setSubmitting(false);
        return;
      }

      setRegSuccess(`Patient "${data.name}" registered successfully`);
      setSubmitting(false);

      // Auto-switch to detail view after 1s.
      setTimeout(() => {
        setSelectedPatient(data);
        setView("detail");
        setRegSuccess("");
      }, 1200);
    } catch {
      setRegError("Cannot reach the server");
      setSubmitting(false);
    }
  };

  // ── Open patient detail ─────────────────────────────────────
  const openPatient = async (id) => {
    try {
      const res = await api(`/patients/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedPatient(data);
        setView("detail");

        // Load past visit notes history
        const notesRes = await api(`/visit-notes/patient/${id}`);
        if (notesRes.ok) {
          const notesData = await notesRes.json();
          setPastNotes(notesData.notes || []);
        }
      }
    } catch {
      // silent
    }
  };

  // ═══════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════

  // ── Patient Detail View ─────────────────────────────────────
  if (view === "detail" && selectedPatient) {
    const p = selectedPatient;
    return (
      <div className="pat-page">
        <div className="pat-topbar">
          <button className="pat-back-btn" onClick={() => setView("list")} id="pat-back">
            ← Back to Patients
          </button>
        </div>

        <div className="pat-detail-card">
          <div className="pat-detail-avatar">
            {p.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <h2 className="pat-detail-name">{p.name}</h2>
          <span className="pat-detail-id">ID: {p.id.slice(0, 8)}…</span>

          <div className="pat-detail-grid">
            <div className="pat-detail-field">
              <span className="pat-detail-label">Phone</span>
              <span className="pat-detail-value">{p.phone}</span>
            </div>
            <div className="pat-detail-field">
              <span className="pat-detail-label">CNIC</span>
              <span className="pat-detail-value">{p.cnic || "—"}</span>
            </div>
            <div className="pat-detail-field">
              <span className="pat-detail-label">Date of Birth</span>
              <span className="pat-detail-value">{fmtDate(p.dateOfBirth)}</span>
            </div>
            <div className="pat-detail-field">
              <span className="pat-detail-label">Gender</span>
              <span className="pat-detail-value" style={{ textTransform: "capitalize" }}>
                {p.gender || "—"}
              </span>
            </div>
            <div className="pat-detail-field pat-detail-field--full">
              <span className="pat-detail-label">Address</span>
              <span className="pat-detail-value">{p.address || "—"}</span>
            </div>
            <div className="pat-detail-field">
              <span className="pat-detail-label">Registered</span>
              <span className="pat-detail-value">{fmtDate(p.createdAt)}</span>
            </div>
            {p.familyGroupId && (
              <div className="pat-detail-field">
                <span className="pat-detail-label">Family Group</span>
                <span className="pat-detail-value">{p.familyGroupId.slice(0, 8)}…</span>
              </div>
            )}
          </div>

          {/* Past Visit Notes & Clinical History */}
          <div className="pat-detail-section">
            <h3 className="pat-detail-section-title">📜 Clinical Visit History & Notes</h3>
            {pastNotes.length === 0 ? (
              <p className="pat-detail-placeholder">
                No past clinical notes recorded for this patient yet.
              </p>
            ) : (
              <div className="cnote-history-list">
                {pastNotes.map((note) => (
                  <div key={note.id} className="cnote-history-card">
                    <div className="cnote-history-header">
                      <span className="cnote-history-date">
                        {fmtDate(note.appointment?.scheduledAt || note.createdAt)}
                      </span>
                      <span className="cnote-history-doc">
                        Dr. {note.appointment?.staff?.name || "Doctor"}
                      </span>
                    </div>

                    <div className="cnote-history-grid">
                      {Object.entries(note.templateData || {}).map(([key, val]) => (
                        <div key={key} className="cnote-history-field">
                          <span className="cnote-history-field-label">
                            {key.replace(/_/g, " ").toUpperCase()}:
                          </span>{" "}
                          <span className="cnote-history-field-val">
                            {val ? String(val) : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Registration View ───────────────────────────────────────
  if (view === "register") {
    return (
      <div className="pat-page">
        <div className="pat-topbar">
          <button className="pat-back-btn" onClick={() => { setView("list"); setDuplicateWarning(null); setRegError(""); setRegSuccess(""); }} id="pat-reg-back">
            ← Back to Patients
          </button>
          <h2 className="pat-topbar-title">Register New Patient</h2>
        </div>

        {regError && (
          <div className="pat-alert pat-alert--error">{regError}</div>
        )}
        {regSuccess && (
          <div className="pat-alert pat-alert--success">{regSuccess}</div>
        )}
        {duplicateWarning && (
          <div className="pat-alert pat-alert--warning">
            <strong>Possible duplicate(s) found:</strong>
            <ul style={{ margin: "0.5rem 0 0.5rem 1.25rem" }}>
              {duplicateWarning.duplicates.map((d, i) => (
                <li key={i}>
                  {d.message} (Phone: {d.existingPatient.phone})
                </li>
              ))}
            </ul>
            <button
              className="pat-btn pat-btn--sm pat-btn--warning"
              type="button"
              onClick={(e) => {
                // Re-submit the form with confirmDuplicate
                const form = document.getElementById("pat-register-form");
                if (form) {
                  const ev = new Event("submit", { bubbles: true, cancelable: true });
                  form._confirmDuplicate = true;
                  form.dispatchEvent(ev);
                }
              }}
            >
              Register Anyway
            </button>
          </div>
        )}

        <form
          className="pat-register-form"
          id="pat-register-form"
          onSubmit={(e) => {
            e.preventDefault();
            const confirm = e.target._confirmDuplicate || false;
            e.target._confirmDuplicate = false;
            handleRegister(e, confirm);
          }}
        >
          {/* Row 1: Name + Phone */}
          <div className="pat-form-row">
            <div className="pat-form-group pat-form-group--grow">
              <label className="pat-form-label" htmlFor="pat-name">
                Patient Name <span className="pat-required">*</span>
              </label>
              <input
                id="pat-name"
                name="name"
                className="pat-form-input"
                type="text"
                placeholder="Muhammad Ahmed"
                autoComplete="off"
                required
                autoFocus
              />
            </div>
            <div className="pat-form-group pat-form-group--grow">
              <label className="pat-form-label" htmlFor="pat-phone">
                Phone <span className="pat-required">*</span>
              </label>
              <input
                id="pat-phone"
                name="phone"
                className="pat-form-input"
                type="tel"
                placeholder="03001234567"
                autoComplete="off"
                required
              />
            </div>
          </div>

          {/* Row 2: CNIC + DOB + Gender */}
          <div className="pat-form-row">
            <div className="pat-form-group">
              <label className="pat-form-label" htmlFor="pat-cnic">CNIC</label>
              <input
                id="pat-cnic"
                name="cnic"
                className="pat-form-input"
                type="text"
                placeholder="3520212345671"
                maxLength={15}
                autoComplete="off"
              />
            </div>
            <div className="pat-form-group">
              <label className="pat-form-label" htmlFor="pat-dob">Date of Birth</label>
              <input
                id="pat-dob"
                name="dob"
                className="pat-form-input"
                type="date"
              />
            </div>
            <div className="pat-form-group">
              <label className="pat-form-label" htmlFor="pat-gender">Gender</label>
              <select id="pat-gender" name="gender" className="pat-form-input pat-form-select">
                <option value="">— Select —</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Row 3: Address */}
          <div className="pat-form-row">
            <div className="pat-form-group pat-form-group--full">
              <label className="pat-form-label" htmlFor="pat-address">Address</label>
              <input
                id="pat-address"
                name="address"
                className="pat-form-input"
                type="text"
                placeholder="House #, Street, Area, City"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="pat-form-actions">
            <button
              type="button"
              className="pat-btn pat-btn--ghost"
              onClick={() => { setView("list"); setDuplicateWarning(null); setRegError(""); }}
            >
              Cancel
            </button>
            <button type="submit" className="pat-btn pat-btn--primary" disabled={submitting} id="pat-submit">
              {submitting ? "Saving…" : "Register Patient"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ── Patient List / Search View (default) ────────────────────
  return (
    <div className="pat-page">
      <div className="pat-topbar">
        <div className="pat-topbar-left">
          <h2 className="pat-topbar-title">Patients</h2>
          <span className="pat-topbar-count">{totalPatients} total</span>
        </div>
        <button
          className="pat-btn pat-btn--primary"
          onClick={() => { setView("register"); setRegError(""); setRegSuccess(""); setDuplicateWarning(null); }}
          id="pat-new-btn"
        >
          + New Patient
        </button>
      </div>

      {/* Search */}
      <div className="pat-search-wrapper">
        <span className="pat-search-icon" aria-hidden="true">🔍</span>
        <input
          ref={searchRef}
          id="pat-search"
          className="pat-search-input"
          type="text"
          placeholder="Search by name, phone, or CNIC…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoComplete="off"
        />
        {searchQuery && (
          <button
            className="pat-search-clear"
            onClick={() => setSearchQuery("")}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="pat-empty">Searching…</div>
      ) : patients.length === 0 ? (
        <div className="pat-empty">
          {searchQuery ? "No patients match your search" : "No patients registered yet"}
        </div>
      ) : (
        <div className="pat-list">
          {patients.map((p) => (
            <button
              key={p.id}
              className="pat-list-item"
              onClick={() => openPatient(p.id)}
            >
              <div className="pat-list-avatar">
                {p.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div className="pat-list-info">
                <span className="pat-list-name">{p.name}</span>
                <span className="pat-list-meta">
                  {p.phone}
                  {p.cnic && ` · CNIC: ${p.cnic}`}
                </span>
              </div>
              <div className="pat-list-date">{fmtDate(p.createdAt)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
