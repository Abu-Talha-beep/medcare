import { useState, useEffect, useCallback } from "react";
import { api, postApi, patchApi } from "../api";
import "./Staff.css";

export default function StaffPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    role: "doctor",
    password: "",
  });
  const [resetId, setResetId] = useState(null);
  const [newPassword, setNewPassword] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api("/staff");
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Failed to load staff");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setStaff(Array.isArray(data) ? data : []);
    } catch {
      setError("Cannot reach server");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const res = await postApi("/staff", form);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Create failed");
        return;
      }
      setSuccess(`Created ${data.name} (${data.role})`);
      setForm({ name: "", phone: "", role: "doctor", password: "" });
      setShowForm(false);
      load();
    } catch {
      setError("Cannot reach server");
    }
  };

  const handleRoleChange = async (id, role) => {
    setError("");
    try {
      const res = await patchApi(`/staff/${id}`, { role });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Update failed");
        return;
      }
      setSuccess(`Updated ${data.name} → ${data.role}`);
      load();
    } catch {
      setError("Cannot reach server");
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (!resetId) return;
    setError("");
    try {
      const res = await patchApi(`/staff/${resetId}/reset-password`, { newPassword });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Reset failed");
        return;
      }
      setSuccess("Password reset successfully");
      setResetId(null);
      setNewPassword("");
    } catch {
      setError("Cannot reach server");
    }
  };

  return (
    <div className="staff-page">
      <div className="pat-topbar">
        <div className="pat-topbar-left">
          <h2 className="pat-topbar-title">Staff members</h2>
          <span className="pat-topbar-count">{staff.length} total</span>
        </div>
        <button
          type="button"
          className="pat-btn pat-btn--primary"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? "Cancel" : "Add staff"}
        </button>
      </div>

      {error && <div className="pat-alert pat-alert--error">{error}</div>}
      {success && <div className="pat-alert pat-alert--success">{success}</div>}

      {showForm && (
        <form className="pat-register-form" onSubmit={handleCreate}>
          <div className="pat-form-row">
            <div className="pat-form-group">
              <label className="pat-form-label">Full name</label>
              <input
                className="pat-form-input"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="pat-form-group">
              <label className="pat-form-label">Phone</label>
              <input
                className="pat-form-input"
                required
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="pat-form-group">
              <label className="pat-form-label">Role</label>
              <select
                className="pat-form-input pat-form-select"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              >
                <option value="doctor">Doctor</option>
                <option value="receptionist">Receptionist</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="pat-form-group">
              <label className="pat-form-label">Temp password</label>
              <input
                className="pat-form-input"
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
          </div>
          <div className="pat-form-actions">
            <button type="submit" className="pat-btn pat-btn--primary">Create staff</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="pat-empty">Loading staff…</div>
      ) : (
        <div className="staff-list">
          {staff.map((s) => (
            <div key={s.id} className="staff-card">
              <div className="staff-card-left">
                <div className="dash-user-avatar">{s.name?.charAt(0)}</div>
                <div>
                  <div className="staff-name">{s.name}</div>
                  <div className="staff-meta">{s.phone}</div>
                </div>
              </div>
              <div className="staff-card-right">
                <select
                  className="pat-form-input pat-form-select staff-role-select"
                  value={s.role}
                  onChange={(e) => handleRoleChange(s.id, e.target.value)}
                >
                  <option value="admin">admin</option>
                  <option value="doctor">doctor</option>
                  <option value="receptionist">receptionist</option>
                </select>
                <button
                  type="button"
                  className="pat-btn pat-btn--sm pat-btn--ghost"
                  onClick={() => setResetId(s.id)}
                >
                  Reset password
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {resetId && (
        <div className="appt-modal-overlay" onClick={() => setResetId(null)}>
          <div className="appt-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="appt-modal-header">
              <h3 className="appt-modal-title">Reset password</h3>
              <button type="button" className="appt-modal-close" onClick={() => setResetId(null)}>✕</button>
            </div>
            <form className="appt-modal-form" onSubmit={handleReset}>
              <div className="pat-form-group">
                <label className="pat-form-label">New password</label>
                <input
                  className="pat-form-input"
                  type="password"
                  minLength={6}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <button type="submit" className="pat-btn pat-btn--primary">Save password</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
