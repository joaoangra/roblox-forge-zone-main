#!/usr/bin/env node
import pg from "pg";

const { Client } = pg;

function getDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL. Set it in your shell or .env runner before fixing RLS.");
  }
  return process.env.DATABASE_URL;
}

async function dropPolicies(client, table) {
  const { rows } = await client.query(
    "SELECT policyname FROM pg_policies WHERE tablename = $1 AND schemaname = 'public'",
    [table],
  );

  for (const row of rows) {
    try {
      await client.query(`DROP POLICY IF EXISTS "${row.policyname}" ON public.${table}`);
      console.log(`Dropped policy ${row.policyname} on ${table}`);
    } catch (err) {
      console.log(`Skipped ${row.policyname}: ${err.message}`);
    }
  }
}

async function main() {
  const client = new Client({ connectionString: getDatabaseUrl() });
  await client.connect();
  console.log("Connected to database");

  const tables = [
    "tickets",
    "ticket_messages",
    "staff_members",
    "audit_logs_new",
    "admin_notifications",
    "site_announcements",
  ];

  for (const table of tables) {
    await dropPolicies(client, table);
  }

  await client.query("DROP FUNCTION IF EXISTS public.has_role(UUID, public.app_role) CASCADE");
  await client.query("DROP FUNCTION IF EXISTS public.has_role(UUID, TEXT) CASCADE");

  await client.query(`
    CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role TEXT)
    RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text = _role
      );
    $$;
  `);

  await client.query(`
    CREATE OR REPLACE FUNCTION public.is_staff()
    RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true
      ) OR public.has_role(auth.uid(), 'admin');
    $$;
  `);

  await client.end();
  console.log("RLS helper functions fixed. Apply the latest migrations for policy recreation.");
}

main().catch((err) => {
  console.error("RLS fix failed:", err.message);
  process.exit(1);
});
