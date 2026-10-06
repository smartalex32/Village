import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import process from "node:process";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pgtap } from "@electric-sql/pglite-pgtap";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";

const root = fileURLToPath(new URL("../", import.meta.url));
const client = new PGlite({ extensions: { pgcrypto, pgtap } });
const database = drizzle({ client });

// Supabase supplies these schemas, identities, and default grants.
// This bootstrap excludes HTTP APIs, Realtime delivery, and concurrent sessions.
const bootstrap = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create schema storage;
  create schema extensions;
  grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  create table auth.users (
    instance_id uuid, id uuid primary key, aud text, role text, email text,
    encrypted_password text, email_confirmed_at timestamptz,
    raw_app_meta_data jsonb default '{}'::jsonb,
    raw_user_meta_data jsonb default '{}'::jsonb,
    created_at timestamptz default now(), updated_at timestamptz default now()
  );
  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    )::uuid
  $$;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb,
      nullif(current_setting('request.jwt.claim', true), '')::jsonb,
      '{}'::jsonb
    )
  $$;
  grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
  create table storage.buckets (
    id text primary key, name text not null, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
    name text not null, owner uuid, owner_id text, metadata jsonb,
    created_at timestamptz default now(), updated_at timestamptz default now(), unique (bucket_id, name)
  );
  alter table storage.objects enable row level security;
  grant all on storage.buckets, storage.objects to anon, authenticated, service_role;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  grant execute on function storage.foldername(text) to anon, authenticated, service_role;
  create publication supabase_realtime;
  create extension pgtap with schema extensions;
  set search_path = public, extensions;
`;

function inspectTap(results, filename) {
  const lines = results.flatMap((result) =>
    result.rows.flatMap((row) =>
      Object.values(row).flatMap((value) =>
        typeof value === "string" ? value.split("\n") : [],
      ),
    ),
  );
  const plans = lines.filter((line) => /^1\.\.\d+$/.test(line));
  const assertions = lines.filter((line) =>
    /^(?:not )?ok \d+(?:\s|$)/.test(line),
  );
  const expected = plans.length === 1 ? Number(plans[0].slice(3)) : null;
  const failed = lines.filter((line) => /^not ok\b|^Bail out!|^#/.test(line));
  const numbers = assertions.map((line) =>
    Number(line.match(/^(?:not )?ok (\d+)/)[1]),
  );
  if (
    expected === null ||
    expected === 0 ||
    expected !== assertions.length ||
    !numbers.every((number, index) => number === index + 1) ||
    failed.length
  ) {
    throw new Error(
      `${filename}: pgTAP failed (plan ${expected ?? "missing or multiple"}, assertions ${assertions.length}).\n${failed.join("\n")}`,
    );
  }
  console.log(`${filename}: ${assertions.length} assertions passed`);
  return assertions.length;
}

async function testDrizzleTransaction() {
  const rolledBack = new Error("rollback local adapter fixture");
  const userId = "80000000-0000-0000-0000-000000000001";
  try {
    await database.transaction(async (tx) => {
      await tx.execute(
        sql`insert into auth.users(id, email) values (${userId}::uuid, ${"drizzle-test@example.test"})`,
      );
      await tx.execute(
        sql`select set_config('request.jwt.claim.sub', ${userId}, true)`,
      );
      await tx.execute(sql`set local role authenticated`);
      const household = await tx.execute(
        sql`select public.create_household(${"Drizzle test"}, ${"America/Chicago"}, ${"Test child"}) as id`,
      );
      const event = await tx.execute(sql`
        insert into public.care_events(id, household_id, child_id, event_type, title, starts_at, ends_at, created_by)
        select gen_random_uuid(), household_id, id, 'BABYSITTING', 'Care', ${"2026-10-06T18:00:00Z"}::timestamptz,
          ${"2026-10-06T21:00:00Z"}::timestamptz, (select id from public.household_members where household_id = ${household.rows[0].id}::uuid)
        from public.children where household_id = ${household.rows[0].id}::uuid returning id
      `);
      const changes = {
        starts_at: "2026-10-06T19:00:00Z",
        ends_at: null,
        location: "Test location",
      };
      await tx.execute(
        sql`select public.update_care_event(${event.rows[0].id}::uuid, ${JSON.stringify(changes)}::jsonb)`,
      );
      const saved = await tx.execute(
        sql`select starts_at = ${changes.starts_at}::timestamptz as correct_time, ends_at, location from public.care_events where id = ${event.rows[0].id}::uuid`,
      );
      assert.deepEqual(saved.rows, [
        { correct_time: true, ends_at: null, location: "Test location" },
      ]);
      throw rolledBack;
    });
  } catch (error) {
    if (error !== rolledBack) throw error;
  }
  const fixture = await database.execute(
    sql`select id from auth.users where id = ${userId}::uuid`,
  );
  assert.equal(fixture.rows.length, 0);
  console.log(
    "Drizzle: authenticated edits, parameterized JSON/timestamps, and transaction rollback passed",
  );
}

let assertions = 0;
try {
  await client.exec(bootstrap);
  const version = await database.execute(sql`select version() as version`);
  console.log(`Database: ${version.rows[0].version}`);
  const migrationDirectory = resolve(root, "supabase/migrations");
  const migrations = (await readdir(migrationDirectory))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const name of migrations) {
    try {
      await client.exec(
        await readFile(resolve(migrationDirectory, name), "utf8"),
      );
    } catch (error) {
      throw new Error(`Migration ${name} failed: ${error.message}`, {
        cause: error,
      });
    }
  }
  console.log(`Applied ${migrations.length} repository migrations`);
  await testDrizzleTransaction();
  const testDirectory = resolve(root, "supabase/tests/database");
  const tests = (await readdir(testDirectory))
    .filter((name) => name.endsWith(".test.sql"))
    .sort();
  if (!tests.length) throw new Error("No database regression tests were found");
  for (const name of tests) {
    try {
      assertions += inspectTap(
        await client.exec(await readFile(resolve(testDirectory, name), "utf8")),
        name,
      );
    } finally {
      await client.exec(
        "rollback; reset role; reset search_path; set search_path = public, extensions; reset request.jwt.claim.sub; reset request.jwt.claims; reset request.jwt.claim;",
      );
    }
  }
  console.log(
    `${tests.length} SQL suites passed (${assertions} pgTAP assertions)`,
  );
} catch (error) {
  console.error(
    error.name === "DrizzleQueryError"
      ? (error.cause?.message ?? "Drizzle database test failed")
      : error.message,
  );
  process.exitCode = 1;
} finally {
  await client.close();
}
