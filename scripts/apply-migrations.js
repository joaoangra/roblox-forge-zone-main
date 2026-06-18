#!/usr/bin/env node
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const migrations = [
  "20260616050300_community_tables.sql",
  "20260616050200_fix_support_views.sql",
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
    const sql = fs.readFileSync(filePath, "utf8");
    console.log(`Applying ${file}...`);
    await client.query(sql);
    console.log(`Applied ${file}`);
  }

  await client.end();
  console.log("Migrations applied successfully");
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
