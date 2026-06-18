#!/usr/bin/env node
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Client } = pg;

const migrations = [
  "20260617000400_fix_has_role_function.sql",
  "20260618000100_marketplace_professional_hardening.sql",
];

function getDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL. Set it in your shell or .env runner before applying migrations.");
  }
  return process.env.DATABASE_URL;
}

async function main() {
  const client = new Client({ connectionString: getDatabaseUrl() });
  await client.connect();
  console.log("Connected to database");

  for (const file of migrations) {
    const filePath = path.join(__dirname, "..", "supabase", "migrations", file);
    if (!fs.existsSync(filePath)) {
      console.log(`${file} not found, skipping`);
      continue;
    }

    const sql = fs.readFileSync(filePath, "utf8");
    console.log(`Applying ${file}...`);
    try {
      await client.query(sql);
      console.log(`Applied ${file}`);
    } catch (err) {
      console.log(`Skipped ${file}: ${err.message}`);
    }
  }

  await client.end();
  console.log("Migrations finished");
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
