// Deploy updated subcategory_report RPC via Supabase Management API.
// Run: node scripts/_deploy-rpc.mjs

import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, "../.env") });

const PROJECT = "yrhckctwtdjowulfuaqc";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

// Updated RPC — GROUP BY (subcategory, source) instead of COUNT(DISTINCT)
const sql = `
DROP FUNCTION IF EXISTS public.subcategory_report();

CREATE OR REPLACE FUNCTION public.subcategory_report()
RETURNS TABLE (
  subcategory_id   uuid,
  subcategory_name text,
  category_name    text,
  source           text,
  url_count        int
)
LANGUAGE sql
SECURITY DEFINER
SET statement_timeout = '120s'
AS $$
  SELECT
    s.id,
    s.name,
    c.name,
    u.source,
    COUNT(*)::int
  FROM subcategories s
  LEFT JOIN categories c ON c.id = s.category_id
  LEFT JOIN urls u       ON u.subcategory_id = s.id AND u.approved = true
  GROUP BY s.id, s.name, c.name, u.source
  ORDER BY c.name, s.name, u.source;
$$;

REVOKE EXECUTE ON FUNCTION public.subcategory_report() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.subcategory_report() TO service_role;
`;

async function main() {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await res.text();
  console.log(`Status: ${res.status}`);

  if (res.ok) {
    console.log("RPC deployed successfully.");
  } else {
    console.log("Response:", text.slice(0, 1000));
    // Management API might not support raw queries. Try alternate endpoint.
    console.log("\nTrying alternate endpoint...");
    const res2 = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ query: sql }),
    });
    const text2 = await res2.text();
    console.log(`Status: ${res2.status}`);
    console.log("Response:", text2.slice(0, 500));
  }
}

main().catch((err) => console.error("Error:", err.message));