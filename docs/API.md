# API Reference

> Base URL: `http://localhost:4000/api`

---

## Health Check

### `GET /api/health`

Returns the server and database status.

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2026-08-26T12:00:00.000Z",
  "database": "connected"
}
```

**Response (503):**
```json
{
  "status": "error",
  "timestamp": "2026-08-26T12:00:00.000Z",
  "database": "disconnected",
  "message": "Connection refused"
}
```

---

## Clinics

### `GET /api/clinics`

List all clinics, ordered by newest first.

**Response (200):**
```json
[
  {
    "id": "00000000-0000-0000-0000-000000000001",
    "name": "Demo Clinic",
    "city": "Lahore",
    "settings": { "language": "en", "modules": { ... } },
    "createdAt": "2026-08-26T12:00:00.000Z",
    "updatedAt": "2026-08-26T12:00:00.000Z",
    "synced": true
  }
]
```

### `GET /api/clinics/:id`

Get a single clinic by UUID.

**Response (200):** Single clinic object (same shape as above).

**Response (404):**
```json
{ "error": "Clinic not found" }
```

---

## Patients (Authenticated)

All patient endpoints require `Authorization: Bearer <token>`. Queries are automatically scoped to the authenticated user's `clinic_id`.

### `GET /api/patients`

List patients (paginated).

**Query params:** `page` (default: 1), `limit` (default: 50, max: 100)

**Response (200):**
```json
{
  "patients": [ ... ],
  "pagination": { "page": 1, "limit": 50, "total": 123, "pages": 3 }
}
```

### `GET /api/patients/search?q=<term>`

Search by name (partial, case-insensitive), phone (partial), or CNIC (exact, if input looks like a CNIC).

**Response (200):**
```json
{ "patients": [ ... ] }
```

### `GET /api/patients/:id`

Get a single patient by UUID.

### `POST /api/patients`

Register a new patient. Only `name` and `phone` are required.

**Request body:**
```json
{
  "name": "Ahmed Khan",
  "phone": "03001234567",
  "cnic": "3520212345671",
  "dateOfBirth": "1990-05-15",
  "gender": "male",
  "address": "House 5, Street 12, Lahore",
  "confirmDuplicate": false
}
```

**Response (201):** Created patient object.

**Response (409) — Duplicate detected:**
```json
{
  "error": "Potential duplicate(s) found",
  "duplicates": [
    { "field": "phone", "message": "Patient \"...\" already has this phone number", "existingPatient": { ... } }
  ],
  "hint": "Send confirmDuplicate: true to register anyway"
}
```

### `PATCH /api/patients/:id`

Update patient fields. Only send fields that need changing.

---

## Appointments (Authenticated)

All appointment endpoints require `Authorization: Bearer <token>`. Queries are automatically scoped to the authenticated user's `clinic_id`.

### `GET /api/appointments/today`

Get today's queue, ordered by `scheduledAt` ascending, with patient and doctor details joined.

**Query params:** `staffId` (optional, filter by doctor)

**Response (200):**
```json
{
  "appointments": [
    {
      "id": "...",
      "scheduledAt": "2026-08-26T10:30:00.000Z",
      "status": "waiting",
      "notes": "Fever",
      "patient": { "id": "...", "name": "Ahmed Khan", "phone": "03001234567" },
      "staff": { "id": "...", "name": "Dr. Ali Hassan", "role": "doctor" }
    }
  ],
  "date": "2026-08-26"
}
```

### `GET /api/appointments/by-date?date=YYYY-MM-DD`

Get appointments for a specific date.

**Query params:** `date` (required, YYYY-MM-DD), `staffId` (optional)

### `GET /api/appointments/doctors`

List all doctors in the clinic for the booking dropdown.

### `POST /api/appointments`

Create a walk-in or pre-booked appointment.

**Request body:**
```json
{
  "patientId": "uuid",
  "staffId": "uuid (doctor)",
  "scheduledAt": "2026-08-26T10:30:00.000Z", // optional; defaults to now (walk-in)
  "notes": "Optional reason for visit"
}
```

### `PATCH /api/appointments/:id/status`

Advance or update appointment status (`waiting` -> `in_progress` -> `done`, `cancelled`, `no_show`). Validates status transitions.

**Request body:**
```json
{ "status": "in_progress" }
```

---

## Billing & Invoices (Authenticated)

All invoice endpoints require `Authorization: Bearer <token>`. Queries are automatically scoped to the authenticated user's `clinic_id`.

### `GET /api/invoices/today-summary`

Get end-of-day revenue summary for today: total paid revenue, breakdown by payment method, count of unpaid invoices.

**Response (200):**
```json
{
  "date": "2026-08-26",
  "totalRevenueToday": 34500,
  "methodBreakdown": { "cash": 24500, "jazzcash": 5000, "easypaisa": 5000, "card": 0, "other": 0 },
  "unpaidCount": 2,
  "totalInvoicesToday": 10
}
```

### `GET /api/invoices/unpaid`

Get all unpaid or partially paid invoices. Query params: `patientId` (optional).

### `GET /api/invoices`

List invoices (paginated). Query params: `page`, `limit`, `patientId`, `paymentStatus`.

### `GET /api/invoices/:id`

Get detailed invoice object with joined `items`, `patient`, `clinic`, `appointment`.

### `POST /api/invoices`

Create an invoice with itemized line charges.

**Request body:**
```json
{
  "patientId": "uuid",
  "appointmentId": "uuid (optional)",
  "items": [
    { "description": "Consultation Fee", "amount": 1500 },
    { "description": "Lab Test", "amount": 1000 }
  ],
  "paymentStatus": "paid", // paid | unpaid | partially_paid
  "paymentMethod": "cash" // cash | jazzcash | easypaisa | card | other
}
```

### `PATCH /api/invoices/:id/payment`

Update payment status and payment method.

**Request body:**
```json
{
  "paymentStatus": "paid",
  "paymentMethod": "jazzcash"
}
```

---

## Clinical Notes & Template Management (Authenticated)

### `GET /api/clinics/template`

Fetch logged-in clinic's dynamic note template.

**Response (200):**
```json
{
  "template": [
    { "key": "symptoms", "label": "Symptoms", "type": "textarea" },
    { "key": "diagnosis", "label": "Diagnosis", "type": "text" },
    { "key": "prescription", "label": "Prescription", "type": "textarea" }
  ]
}
```

### `PUT /api/clinics/template` (Admin-only)

Update clinic's note template (add, remove, or reorder dynamic fields).

**Request body:**
```json
{
  "template": [
    { "key": "chief_complaint", "label": "Chief Complaint", "type": "text" },
    { "key": "tooth_chart", "label": "Tooth Numbers & Notes", "type": "tooth_chart" },
    { "key": "diagnosis", "label": "Diagnosis", "type": "text" }
  ]
}
```

### `GET /api/visit-notes/appointment/:appointmentId`

Get recorded visit note for a specific appointment.

### `POST /api/visit-notes`

Save or update visit note for an appointment.

**Request body:**
```json
{
  "appointmentId": "uuid",
  "templateData": {
    "symptoms": "Fever and cough",
    "diagnosis": "Viral Flu",
    "prescription": "Paracetamol 500mg"
  }
}
```

### `GET /api/visit-notes/patient/:patientId`

Get all past visit notes for a patient with appointment and doctor details joined.

---

## Inventory & Module Toggles (Authenticated)

### `GET /api/inventory`

List all inventory items for the logged-in clinic.

### `GET /api/inventory/low-stock`

List items where `stockQty <= lowStockThreshold`.

### `POST /api/inventory`

Create a new inventory item.

**Request body:**
```json
{
  "name": "Paracetamol 500mg",
  "unit": "strip",
  "stockQty": 100,
  "lowStockThreshold": 20
}
```

### `PUT /api/inventory/:id`

Update inventory item details (`name`, `unit`, `lowStockThreshold`).

### `DELETE /api/inventory/:id`

Delete inventory item and associated transactions.

### `POST /api/inventory/:id/transaction`

Record a stock change (positive for restock, negative for usage). Automatically updates `stockQty` and logs transaction.

**Request body:**
```json
{
  "changeQty": 50, // or -5 for usage
  "reason": "Shipment received"
}
```

### `GET /api/clinics/modules`

Get enabled module settings for the clinic (`SERVICE_CONFIG` pattern).

### `PATCH /api/clinics/modules` (Admin-only)

Toggle clinic module visibility (`patients`, `appointments`, `billing`, `inventory`).

**Request body:**
```json
{
  "modules": {
    "inventory": false
  }
}
```

---

## Dashboard & Analytics Reports (Authenticated)

### `GET /api/dashboard/today`

Get today's landing summary: patients today, revenue today, waiting count, low-stock alerts, and today's live queue list. Scoped strictly to clinic settings `enabled_modules`.

**Response (200):**
```json
{
  "clinicName": "Al-Shifa clinic",
  "date": "2026-08-26",
  "metrics": {
    "patientsToday": 27,
    "revenueToday": 34500,
    "waitingNow": 4,
    "inProgressNow": 1,
    "doneToday": 22,
    "lowStockAlerts": 2
  },
  "queue": [ /* list of today's appointments with joined patient & doctor */ ],
  "enabledModules": { "patients": true, "appointments": true, "billing": true, "inventory": true }
}
```

### `GET /api/dashboard/reports`

Get itemized date-range report: patient counts and revenue broken down by day. Query params: `startDate` (`YYYY-MM-DD`), `endDate` (`YYYY-MM-DD`).

**Response (200):**
```json
{
  "startDate": "2026-08-20",
  "endDate": "2026-08-26",
  "days": [
    { "date": "2026-08-20", "patientCount": 15, "revenue": 22500 },
    { "date": "2026-08-21", "patientCount": 20, "revenue": 31000 }
  ],
  "totals": {
    "totalPatients": 125,
    "totalRevenue": 185000,
    "avgPatientsPerDay": 17.8
  }
}
```

---


## Error Format

All errors follow this structure:


```json
{
  "error": {
    "message": "Description of the problem",
    "stack": "... (development only)"
  }
}
```




