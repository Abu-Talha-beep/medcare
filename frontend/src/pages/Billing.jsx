import { useState, useEffect, useCallback } from "react";
import { api, postApi, patchApi } from "../api";
import "./Billing.css";

function fmtCurrency(amt) {
  const num = parseFloat(amt) || 0;
  return `Rs. ${num.toLocaleString("en-PK")}`;
}

function fmtDate(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleDateString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BillingPage() {
  const [view, setView] = useState("list"); // "list" | "create" | "receipt" | "summary"
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");

  // Create Invoice State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [lineItems, setLineItems] = useState([
    { description: "Consultation Fee", amount: 1500 },
  ]);
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── Load Today's Summary & Invoices ──────────────────────────
  const fetchSummary = useCallback(async () => {
    try {
      const res = await api("/invoices/today-summary");
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch {
      // silent
    }
  }, []);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/invoices?limit=50";
      if (filterStatus !== "all") {
        url += `&paymentStatus=${filterStatus}`;
      }
      const res = await api(url);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices || []);
      }
    } catch {
      // silent
    }
    setLoading(false);
  }, [filterStatus]);

  useEffect(() => {
    fetchSummary();
    fetchInvoices();
  }, [fetchSummary, fetchInvoices]);

  // ── Patient Search in Create View ────────────────────────────
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

  // ── Line Items Handlers ──────────────────────────────────────
  const handleItemChange = (index, field, value) => {
    const updated = [...lineItems];
    updated[index][field] = value;
    setLineItems(updated);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { description: "", amount: 0 }]);
  };

  const removeLineItem = (index) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return lineItems.reduce(
      (sum, item) => sum + (parseFloat(item.amount) || 0),
      0
    );
  };

  // ── Save Invoice ─────────────────────────────────────────────
  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!selectedPatient) {
      setFormError("Please select a patient");
      return;
    }

    const validItems = lineItems.filter(
      (i) => i.description.trim() && parseFloat(i.amount) > 0
    );

    if (validItems.length === 0) {
      setFormError("Add at least one valid line item with description & amount");
      return;
    }

    setSubmitting(true);
    try {
      const res = await postApi("/invoices", {
        patientId: selectedPatient.id,
        items: validItems,
        paymentStatus,
        paymentMethod: paymentStatus === "paid" ? paymentMethod : null,
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to create invoice");
        setSubmitting(false);
        return;
      }

      setSubmitting(false);
      openReceipt(data.id);
      fetchSummary();
      fetchInvoices();
    } catch {
      setFormError("Cannot connect to server");
      setSubmitting(false);
    }
  };

  // ── Mark Invoice Paid ────────────────────────────────────────
  const handleMarkPaid = async (invoiceId, method = "cash") => {
    try {
      const res = await patchApi(`/invoices/${invoiceId}/payment`, {
        paymentStatus: "paid",
        paymentMethod: method,
      });
      if (res.ok) {
        fetchSummary();
        fetchInvoices();
        if (selectedInvoice && selectedInvoice.id === invoiceId) {
          openReceipt(invoiceId);
        }
      }
    } catch {
      alert("Failed to update payment status");
    }
  };

  // ── Open Receipt ─────────────────────────────────────────────
  const openReceipt = async (id) => {
    try {
      const res = await api(`/invoices/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedInvoice(data);
        setView("receipt");
      }
    } catch {
      alert("Failed to load invoice receipt");
    }
  };

  // ═════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════

  // ── PRINTABLE RECEIPT VIEW ───────────────────────────────────
  if (view === "receipt" && selectedInvoice) {
    const inv = selectedInvoice;
    return (
      <div className="bill-page">
        <div className="bill-receipt-actions no-print">
          <button className="pat-back-btn" onClick={() => setView("list")}>
            ← Back to Invoices
          </button>
          <div className="bill-receipt-btn-group">
            {inv.paymentStatus !== "paid" && (
              <button
                className="pat-btn pat-btn--primary pat-btn--sm"
                onClick={() => handleMarkPaid(inv.id, "cash")}
              >
                Mark Paid (Cash)
              </button>
            )}
            <button
              className="pat-btn pat-btn--primary"
              onClick={() => window.print()}
            >
              🖨️ Print Receipt
            </button>
          </div>
        </div>

        {/* Official Printable Receipt Card */}
        <div className="bill-receipt-card" id="printable-receipt">
          <div className="bill-receipt-header">
            <div className="bill-receipt-brand">
              <span className="bill-receipt-logo">MC</span>
              <div>
                <h2 className="bill-receipt-clinic-name">
                  {inv.clinic?.name || "Al-Shifa Clinic"}
                </h2>
                <p className="bill-receipt-clinic-sub">
                  {inv.clinic?.city || "Lahore"} · Phone: 03001234567
                </p>
              </div>
            </div>
            <div className="bill-receipt-meta">
              <span className="bill-receipt-number">INVOICE #{inv.id.slice(0, 8).toUpperCase()}</span>
              <span className="bill-receipt-date">{fmtDate(inv.createdAt)}</span>
            </div>
          </div>

          <div className="bill-receipt-divider" />

          {/* Patient Details */}
          <div className="bill-receipt-patient-info">
            <div>
              <span className="bill-receipt-label">PATIENT NAME</span>
              <span className="bill-receipt-val">{inv.patient?.name}</span>
            </div>
            <div>
              <span className="bill-receipt-label">PHONE</span>
              <span className="bill-receipt-val">{inv.patient?.phone}</span>
            </div>
            {inv.patient?.cnic && (
              <div>
                <span className="bill-receipt-label">CNIC</span>
                <span className="bill-receipt-val">{inv.patient?.cnic}</span>
              </div>
            )}
          </div>

          {/* Itemized Table */}
          <table className="bill-receipt-table">
            <thead>
              <tr>
                <th>Description</th>
                <th style={{ textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {inv.items?.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.description}</td>
                  <td style={{ textAlign: "right" }}>{fmtCurrency(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="bill-receipt-divider" />

          {/* Summary & Payment Badge */}
          <div className="bill-receipt-footer-row">
            <div className="bill-receipt-payment-info">
              <span className="bill-receipt-label">PAYMENT STATUS</span>
              <span className={`bill-status-pill bill-status--${inv.paymentStatus}`}>
                {inv.paymentStatus === "paid"
                  ? `Paid via ${(inv.paymentMethod || "cash").toUpperCase()}`
                  : "UNPAID"}
              </span>
            </div>
            <div className="bill-receipt-total">
              <span className="bill-receipt-total-label">TOTAL AMOUNT</span>
              <span className="bill-receipt-total-val">{fmtCurrency(inv.amount)}</span>
            </div>
          </div>

          <div className="bill-receipt-watermark">
            Thank you for visiting {inv.clinic?.name || "Al-Shifa Clinic"}. Get well soon!
          </div>
        </div>
      </div>
    );
  }

  // ── CREATE INVOICE VIEW ──────────────────────────────────────
  if (view === "create") {
    return (
      <div className="bill-page">
        <div className="pat-topbar">
          <button className="pat-back-btn" onClick={() => setView("list")}>
            ← Back to Invoices
          </button>
          <h2 className="pat-topbar-title">Create New Invoice / Bill</h2>
        </div>

        {formError && <div className="pat-alert pat-alert--error">{formError}</div>}

        <form className="bill-create-card" onSubmit={handleCreateInvoice}>
          {/* Patient Selection */}
          <div className="pat-form-group">
            <label className="pat-form-label">Select Patient <span className="pat-required">*</span></label>
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

          {/* Line Items Table */}
          <div className="bill-items-section">
            <div className="bill-items-header">
              <h3 className="bill-items-title">Line Items</h3>
              <button
                type="button"
                className="pat-btn pat-btn--ghost pat-btn--sm"
                onClick={addLineItem}
              >
                + Add Item
              </button>
            </div>

            {lineItems.map((item, idx) => (
              <div key={idx} className="bill-item-row">
                <input
                  type="text"
                  className="pat-form-input"
                  placeholder="Item description e.g. Consultation, Lab test"
                  value={item.description}
                  onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                  required
                />
                <input
                  type="number"
                  className="pat-form-input bill-item-amt"
                  placeholder="Amount (Rs)"
                  value={item.amount}
                  onChange={(e) => handleItemChange(idx, "amount", e.target.value)}
                  min={0}
                  required
                />
                {lineItems.length > 1 && (
                  <button
                    type="button"
                    className="bill-remove-item-btn"
                    onClick={() => removeLineItem(idx)}
                    title="Remove item"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}

            <div className="bill-total-row">
              <span className="bill-total-label">Total Amount:</span>
              <span className="bill-total-value">{fmtCurrency(calculateTotal())}</span>
            </div>
          </div>

          {/* Payment Method & Status */}
          <div className="pat-form-row">
            <div className="pat-form-group">
              <label className="pat-form-label">Payment Status</label>
              <select
                className="pat-form-input pat-form-select"
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
              >
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>

            {paymentStatus === "paid" && (
              <div className="pat-form-group">
                <label className="pat-form-label">Payment Method</label>
                <select
                  className="pat-form-input pat-form-select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="cash">Cash</option>
                  <option value="jazzcash">JazzCash</option>
                  <option value="easypaisa">EasyPaisa</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </select>
              </div>
            )}
          </div>

          <div className="pat-form-actions">
            <button
              type="button"
              className="pat-btn pat-btn--ghost"
              onClick={() => setView("list")}
            >
              Cancel
            </button>
            <button type="submit" className="pat-btn pat-btn--primary" disabled={submitting}>
              {submitting ? "Saving…" : "Save & Generate Invoice"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ── INVOICES LIST & SUMMARY VIEW (DEFAULT) ───────────────────
  return (
    <div className="bill-page">
      {/* Top Controls & Today's Summary Banner */}
      <div className="pat-topbar">
        <div className="pat-topbar-left">
          <h2 className="pat-topbar-title">Billing & Invoices</h2>
        </div>

        <div className="appt-topbar-right">
          <button
            className="pat-btn pat-btn--ghost pat-btn--sm"
            onClick={() => setView("summary")}
          >
            📊 Daily Summary
          </button>
          <button
            className="pat-btn pat-btn--primary"
            onClick={() => {
              setView("create");
              setSelectedPatient(null);
              setFormError("");
            }}
          >
            + Create Bill / Invoice
          </button>
        </div>
      </div>

      {/* Summary Stat Banner */}
      {summary && (
        <div className="bill-summary-banner">
          <div className="bill-sum-card">
            <span className="bill-sum-label">Revenue Today</span>
            <span className="bill-sum-val">{fmtCurrency(summary.totalRevenueToday)}</span>
          </div>
          <div className="bill-sum-card">
            <span className="bill-sum-label">Unpaid Bills</span>
            <span className="bill-sum-val">{summary.unpaidCount} Pending</span>
          </div>
          <div className="bill-sum-card">
            <span className="bill-sum-label">Cash Collections</span>
            <span className="bill-sum-val">{fmtCurrency(summary.methodBreakdown?.cash || 0)}</span>
          </div>
          <div className="bill-sum-card">
            <span className="bill-sum-label">JazzCash / EasyPaisa</span>
            <span className="bill-sum-val">
              {fmtCurrency(
                (summary.methodBreakdown?.jazzcash || 0) +
                  (summary.methodBreakdown?.easypaisa || 0)
              )}
            </span>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="bill-filter-tabs">
        <button
          className={`bill-filter-btn ${filterStatus === "all" ? "bill-filter-btn--active" : ""}`}
          onClick={() => setFilterStatus("all")}
        >
          All Invoices
        </button>
        <button
          className={`bill-filter-btn ${filterStatus === "unpaid" ? "bill-filter-btn--active" : ""}`}
          onClick={() => setFilterStatus("unpaid")}
        >
          Unpaid / Pending
        </button>
        <button
          className={`bill-filter-btn ${filterStatus === "paid" ? "bill-filter-btn--active" : ""}`}
          onClick={() => setFilterStatus("paid")}
        >
          Paid
        </button>
      </div>

      {/* Invoices List */}
      {loading ? (
        <div className="pat-empty">Loading invoices…</div>
      ) : invoices.length === 0 ? (
        <div className="pat-empty">No invoices found. Click "+ Create Bill" to generate one.</div>
      ) : (
        <div className="bill-list">
          {invoices.map((inv) => (
            <div key={inv.id} className="bill-list-card">
              <div className="bill-card-left">
                <span className="bill-card-id">#{inv.id.slice(0, 8).toUpperCase()}</span>
                <span className="bill-card-name">{inv.patient?.name}</span>
                <span className="bill-card-meta">
                  {inv.patient?.phone} · {fmtDate(inv.createdAt)}
                </span>
              </div>

              <div className="bill-card-right">
                <span className="bill-card-amount">{fmtCurrency(inv.amount)}</span>
                <span className={`bill-status-pill bill-status--${inv.paymentStatus}`}>
                  {inv.paymentStatus === "paid"
                    ? `Paid (${inv.paymentMethod || "cash"})`
                    : "Unpaid"}
                </span>

                <div className="bill-card-actions">
                  {inv.paymentStatus !== "paid" && (
                    <button
                      className="pat-btn pat-btn--sm pat-btn--primary"
                      onClick={() => handleMarkPaid(inv.id, "cash")}
                    >
                      Mark Paid
                    </button>
                  )}
                  <button
                    className="pat-btn pat-btn--sm pat-btn--ghost"
                    onClick={() => openReceipt(inv.id)}
                  >
                    View Receipt
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
