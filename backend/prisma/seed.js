// prisma/seed.js — Demo clinic with admin, doctor, receptionist + sample data.

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();
const CLINIC_ID = "00000000-0000-0000-0000-000000000001";

async function main() {
  const clinic = await prisma.clinic.upsert({
    where: { id: CLINIC_ID },
    update: {
      name: "Al-Shifa Clinic",
      settings: {
        language: "en",
        enabled_modules: {
          patients: true,
          appointments: true,
          billing: true,
          inventory: true,
        },
        note_template: [
          { key: "symptoms", label: "Symptoms / Chief Complaint", type: "textarea", options: [] },
          { key: "diagnosis", label: "Diagnosis / Observations", type: "text", options: [] },
          { key: "prescription", label: "Prescription notes", type: "textarea", options: [] },
        ],
      },
    },
    create: {
      id: CLINIC_ID,
      name: "Al-Shifa Clinic",
      city: "Lahore",
      settings: {
        language: "en",
        enabled_modules: {
          patients: true,
          appointments: true,
          billing: true,
          inventory: true,
        },
        note_template: [
          { key: "symptoms", label: "Symptoms / Chief Complaint", type: "textarea", options: [] },
          { key: "diagnosis", label: "Diagnosis / Observations", type: "text", options: [] },
          { key: "prescription", label: "Prescription notes", type: "textarea", options: [] },
        ],
      },
    },
  });
  console.log("✔ Seeded clinic:", clinic.name);

  const staffDefs = [
    { name: "Admin", phone: "03001234567", role: "admin", password: "admin123" },
    { name: "Dr. Ali Hassan", phone: "03009876543", role: "doctor", password: "doctor123" },
    { name: "Sara Reception", phone: "03001112233", role: "receptionist", password: "recept123" },
  ];

  const staffMap = {};
  for (const s of staffDefs) {
    const passwordHash = await bcrypt.hash(s.password, 10);
    const row = await prisma.staff.upsert({
      where: { clinicId_phone: { clinicId: CLINIC_ID, phone: s.phone } },
      update: { name: s.name, role: s.role, passwordHash },
      create: {
        clinicId: CLINIC_ID,
        name: s.name,
        phone: s.phone,
        role: s.role,
        passwordHash,
      },
    });
    staffMap[s.role] = row;
    console.log(`✔ Seeded ${s.role}: ${s.name} (${s.phone} / ${s.password})`);
  }

  const patientsData = [
    {
      name: "Ahmed Khan",
      phone: "03005551111",
      gender: "male",
      allergies: "Penicillin",
      chronicConditions: "Hypertension",
      currentMedications: "Amlodipine 5mg",
    },
    {
      name: "Fatima Bibi",
      phone: "03005552222",
      gender: "female",
      allergies: null,
      chronicConditions: "Diabetes Type 2",
      currentMedications: "Metformin 500mg",
    },
    {
      name: "Usman Ali",
      phone: "03005553333",
      gender: "male",
      allergies: null,
      chronicConditions: null,
      currentMedications: null,
    },
  ];

  const patients = [];
  for (const p of patientsData) {
    let existing = await prisma.patient.findFirst({
      where: { clinicId: CLINIC_ID, phone: p.phone },
    });
    if (!existing) {
      existing = await prisma.patient.create({
        data: { clinicId: CLINIC_ID, ...p },
      });
    } else {
      existing = await prisma.patient.update({
        where: { id: existing.id },
        data: {
          allergies: p.allergies,
          chronicConditions: p.chronicConditions,
          currentMedications: p.currentMedications,
        },
      });
    }
    patients.push(existing);
  }
  console.log(`✔ Seeded ${patients.length} patients`);

  // Today's appointments for the doctor
  const now = new Date();
  const morning = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0);
  const mid = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 30);
  const aft = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 15);

  const existingToday = await prisma.appointment.count({
    where: {
      clinicId: CLINIC_ID,
      staffId: staffMap.doctor.id,
      scheduledAt: {
        gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
      },
    },
  });

  if (existingToday === 0) {
    await prisma.appointment.createMany({
      data: [
        {
          clinicId: CLINIC_ID,
          patientId: patients[0].id,
          staffId: staffMap.doctor.id,
          scheduledAt: morning,
          status: "waiting",
          notes: "Follow-up BP check",
        },
        {
          clinicId: CLINIC_ID,
          patientId: patients[1].id,
          staffId: staffMap.doctor.id,
          scheduledAt: mid,
          status: "waiting",
          notes: "Diabetes review",
        },
        {
          clinicId: CLINIC_ID,
          patientId: patients[2].id,
          staffId: staffMap.doctor.id,
          scheduledAt: aft,
          status: "waiting",
          notes: "Walk-in — fever",
        },
      ],
    });
    console.log("✔ Seeded today's doctor queue (3 appointments)");
  } else {
    console.log("✔ Today queue already present — skipped");
  }

  // Sample inventory
  const invCount = await prisma.inventoryItem.count({ where: { clinicId: CLINIC_ID } });
  if (invCount === 0) {
    await prisma.inventoryItem.createMany({
      data: [
        { clinicId: CLINIC_ID, name: "Paracetamol 500mg", unit: "strip", stockQty: 40, lowStockThreshold: 10 },
        { clinicId: CLINIC_ID, name: "Disposable Gloves", unit: "box", stockQty: 5, lowStockThreshold: 8 },
        { clinicId: CLINIC_ID, name: "Syringes 5ml", unit: "piece", stockQty: 100, lowStockThreshold: 20 },
      ],
    });
    console.log("✔ Seeded inventory items");
  }

  console.log("\n── Demo logins ──────────────────────────────");
  console.log("Admin:         03001234567 / admin123");
  console.log("Doctor:        03009876543 / doctor123");
  console.log("Receptionist:  03001112233 / recept123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
