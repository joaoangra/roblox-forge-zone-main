#!/usr/bin/env node
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

// Decode URL-encoded password: %40 = @, %2B = +
const DATABASE_URL =
  "postgresql://postgres:Joao%4030062008%2B@db.kskxlrmwpudqhpbfxvuv.supabase.co:5432/postgres";
const decodedUrl = DATABASE_URL.replace(/%40/g, "@").replace(/%2B/g, "+");

async function main() {
  const client = new Client({ connectionString: decodedUrl });
  await client.connect();
  console.log("✅ Conectado ao banco\n");

  // Apply community tables migration
  const communitySql = fs.readFileSync(
    path.join(__dirname, "..", "supabase/migrations/20260616050300_community_tables.sql"),
    "utf8"
  );
  console.log("📦 Aplicando: community_tables...");
  await client.query(communitySql);
  console.log("✅ community_tables aplicado\n");

  // Apply support views migration
  const supportSql = fs.readFileSync(
    path.join(__dirname, "..", "supabase/migrations/20260616050200_fix_support_views.sql"),
    "utf8"
  );
  console.log("📦 Aplicando: fix_support_views...");
  await client.query(supportSql);
  console.log("✅ fix_support_views aplicado\n");

  await client.end();
  console.log("🎉 Todas as migrações aplicadas com sucesso!");
}

main().catch((err) => {
  console.error("❌ Erro:", err.message);
  process.exit(1);
});