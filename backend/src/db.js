// src/db.js — Prisma client singleton.
// Prevents multiple client instances during hot-reload in development.

const { PrismaClient } = require("@prisma/client");
const { isDev } = require("./config");

/** @type {PrismaClient} */
let prisma;

if (isDev) {
  // Reuse the client across hot-reloads in development.
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({ log: ["query", "warn", "error"] });
  }
  prisma = global.__prisma;
} else {
  prisma = new PrismaClient({ log: ["warn", "error"] });
}

module.exports = prisma;
