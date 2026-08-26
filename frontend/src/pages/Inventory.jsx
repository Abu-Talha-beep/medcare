import { useState, useEffect, useCallback } from "react";
import { api, postApi, putApi } from "../api";
import "./Inventory.css";

export default function InventoryPage({ onModuleToggle }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Add/Edit Item Modal
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemName, setItemName] = useState("");
  const [itemUnit, setItemUnit] = useState("piece");
  const [itemStock, setItemStock] = useState(0);
  const [itemThreshold, setItemThreshold] = useState(10);
  const [modalError, setModalError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Stock Adjustment Modal (+ Restock or - Use)
  const [activeStockItem, setActiveStockItem] = useState(null);
  const [stockAction, setStockAction] = useState("add"); // "add" | "use"
  const [changeQty, setChangeQty] = useState(10);
  const [changeReason, setChangeReason] = useState("");
  const [stockError, setStockError] = useState("");

  // Module Settings Modal
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [modules, setModules] = useState({
    patients: true,
    appointments: true,
    billing: true,
    inventory: true,
  });

  // ── Load Inventory Items ─────────────────────────────────────
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const url = filterLowStock ? "/inventory/low-stock" : "/inventory";
      const res = await api(url);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch {
      // silent
    }
    setLoading(false);
  }, [filterLowStock]);

  // ── Load Clinic Modules ──────────────────────────────────────
  const fetchModules = useCallback(async () => {
    try {
      const res = await api("/clinics/modules");
      if (res.ok) {
        const data = await res.json();
        setModules(data.modules || {});
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchItems();
    fetchModules();
  }, [fetchItems, fetchModules]);

  // ── Open Add/Edit Item Modal ─────────────────────────────────
  const openItemModal = (item = null) => {
    setModalError("");
    if (item) {
      setEditingItem(item);
      setItemName(item.name);
      setItemUnit(item.unit);
      setItemStock(item.stockQty);
      setItemThreshold(item.lowStockThreshold);
    } else {
      setEditingItem(null);
      setItemName("");
      setItemUnit("piece");
      setItemStock(0);
      setItemThreshold(10);
    }
    setShowItemModal(true);
  };

  // ── Save Item (Create or Update) ─────────────────────────────
  const handleSaveItem = async (e) => {
    e.preventDefault();
    setModalError("");

    if (!itemName.trim()) {
      setModalError("Item name is required");
      return;
    }

    setSubmitting(true);
    try {
      let res;
      if (editingItem) {
        res = await putApi(`/inventory/${editingItem.id}`, {
          name: itemName,
          unit: itemUnit,
          lowStockThreshold: itemThreshold,
        });
      } else {
        res = await postApi("/inventory", {
          name: itemName,
          unit: itemUnit,
          stockQty: itemStock,
          lowStockThreshold: itemThreshold,
        });
      }

      const data = await res.json();
      if (!res.ok) {
        setModalError(data.error || "Failed to save inventory item");
        setSubmitting(false);
        return;
      }

      setShowItemModal(false);
      setSubmitting(false);
      fetchItems();
    } catch {
      setModalError("Cannot connect to server");
      setSubmitting(false);
    }
  };

  // ── Stock Transaction (Restock / Usage) ──────────────────────
  const handleStockAdjustment = async (e) => {
    e.preventDefault();
    setStockError("");

    const qty = stockAction === "add" ? Math.abs(changeQty) : -Math.abs(changeQty);
    if (!qty || qty === 0) {
      setStockError("Please enter a valid quantity");
      return;
    }

    setSubmitting(true);
    try {
      const res = await postApi(`/inventory/${activeStockItem.id}/transaction`, {
        changeQty: qty,
        reason: changeReason || (stockAction === "add" ? "Stock Restock" : "Stock Usage"),
      });

      const data = await res.json();
      if (!res.ok) {
        setStockError(data.error || "Failed to record stock transaction");
        setSubmitting(false);
        return;
      }

      setActiveStockItem(null);
      setSubmitting(false);
      fetchItems();
    } catch {
      setStockError("Cannot connect to server");
      setSubmitting(false);
    }
  };

  // ── Save Module Toggles (SERVICE_CONFIG pattern) ─────────────
  const handleToggleModule = async (moduleKey, enabled) => {
    const updated = { ...modules, [moduleKey]: enabled };
    setModules(updated);
    try {
      const res = await api("/clinics/modules", {
        method: "PATCH",
        body: JSON.stringify({ modules: updated }),
      });
      if (res.ok && onModuleToggle) {
        onModuleToggle(updated);
      }
    } catch {
      // silent
    }
  };

  // Filter items by search query
  const filteredItems = items.filter((i) =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const lowStockCount = items.filter((i) => i.stockQty <= i.lowStockThreshold).length;

  return (
    <div className="inv-page">
      {/* Top Bar */}
      <div className="pat-topbar">
        <div className="pat-topbar-left">
          <h2 className="pat-topbar-title">Inventory & Supplies</h2>
        </div>

        <div className="appt-topbar-right">
          <button
            className="pat-btn pat-btn--ghost pat-btn--sm"
            onClick={() => setShowModuleModal(true)}
            title="Configure Clinic Modules Visibility"
          >
            ⚙️ Module Settings
          </button>

          <button
            className="pat-btn pat-btn--primary"
            onClick={() => openItemModal()}
          >
            + Add New Item
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="inv-summary-banner">
        <div className="inv-sum-card">
          <span className="inv-sum-label">Total Items</span>
          <span className="inv-sum-val">{items.length} Supplies</span>
        </div>
        <div className="inv-sum-card">
          <span className="inv-sum-label">Low Stock Alerts</span>
          <span className="inv-sum-val" style={{ color: lowStockCount > 0 ? "#b91c1c" : "inherit" }}>
            {lowStockCount} Items
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="inv-filter-bar">
        <input
          type="text"
          className="pat-form-input inv-search-input"
          placeholder="Search items by name…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <div className="bill-filter-tabs">
          <button
            className={`bill-filter-btn ${!filterLowStock ? "bill-filter-btn--active" : ""}`}
            onClick={() => setFilterLowStock(false)}
          >
            All Items
          </button>
          <button
            className={`bill-filter-btn ${filterLowStock ? "bill-filter-btn--active" : ""}`}
            onClick={() => setFilterLowStock(true)}
          >
            Low Stock Only ({lowStockCount})
          </button>
        </div>
      </div>

      {/* Items Grid / List */}
      {loading ? (
        <div className="pat-empty">Loading inventory items…</div>
      ) : filteredItems.length === 0 ? (
        <div className="pat-empty">
          {filterLowStock ? "No low stock alerts!" : "No inventory items registered yet."}
        </div>
      ) : (
        <div className="inv-list">
          {filteredItems.map((item) => {
            const isLowStock = item.stockQty <= item.lowStockThreshold;
            return (
              <div key={item.id} className="inv-item-card">
                <div className="inv-item-main">
                  <div className="inv-item-header">
                    <h3 className="inv-item-name">{item.name}</h3>
                    {isLowStock && (
                      <span className="inv-low-badge">Low Stock</span>
                    )}
                  </div>
                  <div className="inv-item-meta">
                    Unit: <strong>{item.unit}</strong> · Threshold: <strong>{item.lowStockThreshold}</strong>
                  </div>
                </div>

                <div className="inv-item-right">
                  <div className="inv-stock-display">
                    <span className="inv-stock-qty">{item.stockQty}</span>
                    <span className="inv-stock-unit">{item.unit}s</span>
                  </div>

                  <div className="inv-item-actions">
                    <button
                      className="pat-btn pat-btn--sm pat-btn--primary"
                      onClick={() => {
                        setActiveStockItem(item);
                        setStockAction("add");
                        setChangeQty(10);
                        setChangeReason("");
                        setStockError("");
                      }}
                    >
                      + Restock
                    </button>
                    <button
                      className="pat-btn pat-btn--sm pat-btn--ghost"
                      onClick={() => {
                        setActiveStockItem(item);
                        setStockAction("use");
                        setChangeQty(1);
                        setChangeReason("");
                        setStockError("");
                      }}
                    >
                      - Use Stock
                    </button>
                    <button
                      className="pat-btn pat-btn--sm pat-btn--ghost"
                      onClick={() => openItemModal(item)}
                      title="Edit Item"
                    >
                      ✏️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── ADD/EDIT ITEM MODAL ──────────────────────────────── */}
      {showItemModal && (
        <div className="cnote-modal-overlay">
          <div className="cnote-modal-card">
            <div className="cnote-modal-header">
              <h3 className="cnote-modal-title">
                {editingItem ? "Edit Inventory Item" : "Add New Inventory Item"}
              </h3>
              <button className="cnote-close-btn" onClick={() => setShowItemModal(false)}>
                ✕
              </button>
            </div>

            {modalError && <div className="pat-alert pat-alert--error">{modalError}</div>}

            <form onSubmit={handleSaveItem} className="cnote-form">
              <div className="pat-form-group">
                <label className="pat-form-label">Item Name *</label>
                <input
                  type="text"
                  className="pat-form-input"
                  placeholder="e.g. Paracetamol 500mg, Dental Composite, Syringes 5ml"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="pat-form-row">
                <div className="pat-form-group">
                  <label className="pat-form-label">Unit of Measure</label>
                  <select
                    className="pat-form-input pat-form-select"
                    value={itemUnit}
                    onChange={(e) => setItemUnit(e.target.value)}
                  >
                    <option value="box">Box</option>
                    <option value="strip">Strip</option>
                    <option value="piece">Piece</option>
                    <option value="bottle">Bottle</option>
                    <option value="vial">Vial</option>
                    <option value="pack">Pack</option>
                  </select>
                </div>

                <div className="pat-form-group">
                  <label className="pat-form-label">Low Stock Threshold</label>
                  <input
                    type="number"
                    className="pat-form-input"
                    value={itemThreshold}
                    onChange={(e) => setItemThreshold(e.target.value)}
                    min={1}
                  />
                </div>
              </div>

              {!editingItem && (
                <div className="pat-form-group">
                  <label className="pat-form-label">Initial Stock Quantity</label>
                  <input
                    type="number"
                    className="pat-form-input"
                    value={itemStock}
                    onChange={(e) => setItemStock(e.target.value)}
                    min={0}
                  />
                </div>
              )}

              <div className="pat-form-actions">
                <button
                  type="button"
                  className="pat-btn pat-btn--ghost"
                  onClick={() => setShowItemModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="pat-btn pat-btn--primary" disabled={submitting}>
                  {submitting ? "Saving…" : "Save Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── STOCK ADJUSTMENT MODAL ──────────────────────────── */}
      {activeStockItem && (
        <div className="cnote-modal-overlay">
          <div className="cnote-modal-card">
            <div className="cnote-modal-header">
              <h3 className="cnote-modal-title">
                {stockAction === "add" ? "+ Restock Inventory" : "- Record Stock Usage"}
              </h3>
              <button className="cnote-close-btn" onClick={() => setActiveStockItem(null)}>
                ✕
              </button>
            </div>

            <p style={{ fontSize: "0.9rem", color: "var(--color-text-secondary)" }}>
              Item: <strong>{activeStockItem.name}</strong> · Current Stock: <strong>{activeStockItem.stockQty} {activeStockItem.unit}s</strong>
            </p>

            {stockError && <div className="pat-alert pat-alert--error">{stockError}</div>}

            <form onSubmit={handleStockAdjustment} className="cnote-form">
              <div className="pat-form-group">
                <label className="pat-form-label">Quantity to {stockAction === "add" ? "Add" : "Deduct"}</label>
                <input
                  type="number"
                  className="pat-form-input"
                  value={changeQty}
                  onChange={(e) => setChangeQty(e.target.value)}
                  min={1}
                  required
                  autoFocus
                />
              </div>

              <div className="pat-form-group">
                <label className="pat-form-label">Reason / Notes (Optional)</label>
                <input
                  type="text"
                  className="pat-form-input"
                  placeholder={stockAction === "add" ? "e.g. Shipment received from supplier" : "e.g. Dispensed to patient / Used in treatment"}
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                />
              </div>

              <div className="pat-form-actions">
                <button
                  type="button"
                  className="pat-btn pat-btn--ghost"
                  onClick={() => setActiveStockItem(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="pat-btn pat-btn--primary" disabled={submitting}>
                  {submitting ? "Saving…" : stockAction === "add" ? "Confirm Restock" : "Confirm Usage"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODULE TOGGLE CONFIG MODAL (SERVICE_CONFIG Pattern) ── */}
      {showModuleModal && (
        <div className="cnote-modal-overlay">
          <div className="cnote-modal-card">
            <div className="cnote-modal-header">
              <h3 className="cnote-modal-title">⚙️ Clinic Modules Config</h3>
              <button className="cnote-close-btn" onClick={() => setShowModuleModal(false)}>
                ✕
              </button>
            </div>

            <p style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>
              Toggle module visibility in the sidebar. Modules disabled here are hidden from all staff.
            </p>

            <div className="inv-module-toggle-list">
              <div className="inv-module-toggle-item">
                <div>
                  <strong>Patient Management</strong>
                  <p className="inv-module-desc">Patient registration, CNIC search, medical history</p>
                </div>
                <input
                  type="checkbox"
                  checked={modules.patients !== false}
                  onChange={(e) => handleToggleModule("patients", e.target.checked)}
                />
              </div>

              <div className="inv-module-toggle-item">
                <div>
                  <strong>Appointments & Queue</strong>
                  <p className="inv-module-desc">Front desk queue, calendar scheduling, status tracker</p>
                </div>
                <input
                  type="checkbox"
                  checked={modules.appointments !== false}
                  onChange={(e) => handleToggleModule("appointments", e.target.checked)}
                />
              </div>

              <div className="inv-module-toggle-item">
                <div>
                  <strong>💰 Billing & Invoices</strong>
                  <p className="inv-module-desc">Checkout, line items, printable receipts, end-of-day revenue</p>
                </div>
                <input
                  type="checkbox"
                  checked={modules.billing !== false}
                  onChange={(e) => handleToggleModule("billing", e.target.checked)}
                />
              </div>

              <div className="inv-module-toggle-item">
                <div>
                  <strong>Inventory & Supplies</strong>
                  <p className="inv-module-desc">Medicine/dental stock tracking, low-stock alerts, restock history</p>
                </div>
                <input
                  type="checkbox"
                  checked={modules.inventory !== false}
                  onChange={(e) => handleToggleModule("inventory", e.target.checked)}
                />
              </div>
            </div>

            <div className="pat-form-actions">
              <button
                type="button"
                className="pat-btn pat-btn--primary"
                onClick={() => setShowModuleModal(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
