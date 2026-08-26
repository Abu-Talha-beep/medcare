# Database Schema Conventions

> These rules apply to **every table** created in this project, without exception.

## Multi-Tenancy Readiness

Every business table **must** include:

| Column       | Type      | Notes                                                                 |
|-------------|-----------|-----------------------------------------------------------------------|
| `clinic_id` | `UUID`    | Foreign key → `clinics.id`. Even single-clinic deployments include it.|
| `created_at`| `TIMESTAMP` | Auto-set on insert via `@default(now())` in Prisma.                |
| `updated_at`| `TIMESTAMP` | Auto-updated via `@updatedAt` in Prisma.                           |
| `synced`    | `BOOLEAN` | Defaults to `true`. Reserved for future cloud-sync logic.            |

### Why `clinic_id` everywhere?

Each deployment currently holds one clinic's data, but the schema is designed so we can later merge multiple clinics into a shared cloud Postgres instance **without any schema migration**. All queries should filter by `clinic_id`.

### Why `synced`?

Future offline-first / cloud-sync feature. The column exists now so we never need to run an `ALTER TABLE` across production data. No sync logic is implemented yet.

---

## Clinics Table

```sql
CREATE TABLE clinics (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255) NOT NULL,
  city       VARCHAR(255) NOT NULL,
  settings   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL,
  synced     BOOLEAN NOT NULL DEFAULT true
);
```

### `settings` JSONB Structure

Clinic-specific configuration lives in the `settings` column, **not** in application code.

```jsonc
{
  "language": "en",              // UI language preference
  "modules": {                   // Feature flags per clinic
    "appointments": true,
    "billing": true,
    "inventory": false,
    "lab": false
  },
  "customFields": {              // User-defined extra fields
    "patient": [
      { "key": "bloodType", "label": "Blood Type", "type": "select",
        "options": ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] }
    ]
  }
}
```

---

## Patients Table

```sql
CREATE TABLE patients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id),
  name            VARCHAR(255) NOT NULL,
  phone           VARCHAR(20) NOT NULL,
  cnic            VARCHAR(15),
  date_of_birth   DATE,
  gender          gender_enum,   -- male, female, other
  address         TEXT,
  family_group_id UUID,
  created_at      TIMESTAMP NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP NOT NULL,
  synced          BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(clinic_id, cnic)
);
```

**Key constraints:**
- `cnic` is unique per clinic (nullable — not all patients will have one)
- `phone` is not uniquely constrained (shared family phones) but triggers duplicate detection on registration
- `family_group_id` is a UUID for grouping family members; no FK yet, just a grouping token
- `gender` is an enum: `male`, `female`, `other`

---

## Appointments Table

```sql
CREATE TABLE appointments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    UUID NOT NULL REFERENCES clinics(id),
  patient_id   UUID NOT NULL REFERENCES patients(id),
  staff_id     UUID NOT NULL REFERENCES staff(id), -- the doctor
  scheduled_at TIMESTAMP NOT NULL,
  status       appointment_status_enum NOT NULL DEFAULT 'waiting', -- waiting, in_progress, done, cancelled, no_show
  notes        VARCHAR(500),
  created_at   TIMESTAMP NOT NULL DEFAULT now(),
  updated_at   TIMESTAMP NOT NULL,
  synced       BOOLEAN NOT NULL DEFAULT true
);
```

**Key constraints & rules:**
- `staff_id` references a `staff` member with role `doctor`
- `status` is an enum: `waiting`, `in_progress`, `done`, `cancelled`, `no_show`
- `scheduled_at` defaults to the current time for walk-in patients or a future datetime for pre-booked appointments

---

## Invoices & Invoice Items Tables

```sql
CREATE TABLE invoices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      UUID NOT NULL REFERENCES clinics(id),
  appointment_id UUID REFERENCES appointments(id),
  patient_id     UUID NOT NULL REFERENCES patients(id),
  amount         DOUBLE PRECISION NOT NULL DEFAULT 0,
  payment_method payment_method_enum, -- cash, jazzcash, easypaisa, card, other
  payment_status payment_status_enum NOT NULL DEFAULT 'unpaid', -- paid, unpaid, partially_paid
  created_at     TIMESTAMP NOT NULL DEFAULT now(),
  updated_at     TIMESTAMP NOT NULL,
  synced         BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE invoice_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description VARCHAR(255) NOT NULL,
  amount      DOUBLE PRECISION NOT NULL
);
```

**Key constraints & rules:**
- `invoice_items` cascades on deletion of parent `invoice`
- `amount` on `invoices` is auto-calculated from the sum of line items
- `payment_method` is an enum: `cash`, `jazzcash`, `easypaisa`, `card`, `other` (manual label)
- `payment_status` is an enum: `paid`, `unpaid`, `partially_paid`

---

## Visit Notes Table (Configurable Dynamic Clinical Notes)

```sql
CREATE TABLE visit_notes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      UUID NOT NULL REFERENCES clinics(id),
  appointment_id UUID UNIQUE NOT NULL REFERENCES appointments(id),
  template_data  JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMP NOT NULL DEFAULT now(),
  updated_at     TIMESTAMP NOT NULL,
  synced         BOOLEAN NOT NULL DEFAULT true
);
```

**Key constraints & rules:**
- `appointment_id` is unique (1-to-1 relationship with appointment consultation)
- `template_data` is a JSONB blob storing key-value pairs corresponding to `clinics.settings.note_template`
- `clinics.settings.note_template` stores an array of field definitions (e.g. `key`, `label`, `type`: `text`, `textarea`, `number`, `select`, `tooth_chart`)
- Enables non-hardcoded custom clinical notes for Medical, Dental, or Speciality clinics

---

## Inventory & Stock Transactions Tables

```sql
CREATE TABLE inventory_items (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id            UUID NOT NULL REFERENCES clinics(id),
  name                 VARCHAR(255) NOT NULL,
  unit                 VARCHAR(50) NOT NULL DEFAULT 'piece',
  stock_qty            INT NOT NULL DEFAULT 0,
  low_stock_threshold  INT NOT NULL DEFAULT 10,
  created_at           TIMESTAMP NOT NULL DEFAULT now(),
  updated_at           TIMESTAMP NOT NULL,
  synced               BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE inventory_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID NOT NULL REFERENCES clinics(id),
  item_id     UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  change_qty  INT NOT NULL, -- positive for restock, negative for usage
  reason      VARCHAR(255),
  created_at  TIMESTAMP NOT NULL DEFAULT now()
);
```

**Key constraints & rules:**
- `change_qty`: positive number logs a restock, negative number logs usage
- `inventory_transactions` cascade-deletes if parent item is removed
- `clinics.settings.enabled_modules` JSON object controls visibility of modules (`patients`, `appointments`, `billing`, `inventory`) per clinic (`SERVICE_CONFIG` pattern)

---

## Adding a New Table — Checklist

1. Add the model to `backend/prisma/schema.prisma`.
2. Include `clinic_id`, `created_at`, `updated_at`, `synced` columns.
3. Add a relation to the `Clinic` model.
4. Run `npm run db:migrate` to create the migration.
5. Update this document with the new table's purpose and any JSONB structure.
