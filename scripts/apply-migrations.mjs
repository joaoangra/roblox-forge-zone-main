#!/usr/bin/env node
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATABASE_URL =
  "postgresql://postgres:Joao%4030062008%2B@db.kskxlrmwpudqhpbfxvuv.supabase.co:5432/postgres";
const decodedUrl = DATABASE_URL.replace(/%40/g, "@").replace(/%2B/g, "+");

const { Client } = pg;

const migrations = [
  "20260616050300_community_tables.sql",
  "20260616050200_fix_support_views.sql",
  "20260616050400_admin_roles_security.sql",
];

async function main() {
  const client = new Client({ connectionString: decodedUrl });
  await client.connect();
  console.log("✅ Conectado ao banco\n");

  for (const file of migrations) {
    const filePath = path.join(__dirname, "..", "supabase/migrations", file);
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  ${file} não encontrado, pulando...`);
      continue;
    }
    const sql = fs.readFileSync(filePath, "utf8");
    console.log(`📦 Aplicando: ${file}...`);
    await client.query(sql);
    console.log(`✅ ${file} aplicado\n`);
  }

  await client.end();
  console.log("🎉 Todas as migrações aplicadas com sucesso!");
}

main().catch((err) => {
  console.error("❌ Erro:", err.message);
  process.exit(1);
});