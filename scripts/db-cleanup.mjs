/**
 * db-cleanup.mjs — General-purpose URL cleanup tool
 *
 * Count, mark-inactive, or delete URLs from the `urls` table using arbitrary
 * filter criteria.  Uses the Supabase Management API (Database Query endpoint)
 * to run SQL server-side — this avoids the PostgREST 57014 statement timeouts.
 *
 * Usage
 * -----
 *   node scripts/db-cleanup.mjs <action> [filters...] [options]
 *
 * Actions (required, exactly one)
 *   count             just count matching rows (default, always safe)
 *   mark-inactive     SET inactive = TRUE
 *   delete            DELETE permanently
 *
 * Filters (combine with AND)
 *   --source <name>            WHERE source = '<name>'
 *   --domain <pattern>         WHERE url ILIKE '%<pattern>%'
 *   --category <id>            WHERE category_id = '<id>'
 *   --subcategory <id>         WHERE subcategory_id = '<id>'
 *   --host <hostname>          WHERE url ILIKE '%://<hostname>/%'
 *   --where <raw SQL>          append arbitrary SQL (e.g. "AND score < 0.5")
 *
 * Options
 *   --dry-run          show what would happen (implied for count)
 *   --confirm          skip interactive prompt for mark-inactive / delete
 *   --limit <n>        cap rows affected (default: no cap)
 *   --batch-size <n>   rows per server-side sub-batch (default: 500)
 *
 * Examples
 * --------
 *   node scripts/db-cleanup.mjs count --source outside
 *   node scripts/db-cleanup.mjs mark-inactive --source outside --confirm
 *   node scripts/db-cleanup.mjs delete --domain brokensite.com --confirm
 *   node scripts/db-cleanup.mjs delete --category cc000... --dry-run
 *   node scripts/db-cleanup.mjs delete --host example.com --where "AND seeder_score < 0.3" --confirm
 */

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { config as dotenvConfig } from "dotenv";
import * as readline from "node:readline";

// ── Setup ──────────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, "../.env") });

const PROJECT_REF = "yrhckctwtdjowulfuaqc";
const MGMT_API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!TOKEN) {
  console.error("SUPABASE_ACCESS_TOKEN not set in .env");
  process.exit(1);
}

const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${TOKEN}`,
};

// ── CLI parsing ────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const result = {
    action: "count",
    filters: [],
    dryRun: false,
    confirm: false,
    limit: null,
    batchSize: 500,
    help: false,
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    switch (arg) {
      case "--help":
      case "-h":
        result.help = true;
        break;
      case "count":
      case "mark-inactive":
      case "delete":
        result.action = arg;
        break;
      case "--source":
        result.filters.push({ type: "source", value: argv[++i] });
        break;
      case "--domain":
        result.filters.push({ type: "domain", value: argv[++i] });
        break;
      case "--category":
        result.filters.push({ type: "category_id", value: argv[++i] });
        break;
      case "--subcategory":
        result.filters.push({ type: "subcategory_id", value: argv[++i] });
        break;
      case "--host":
        result.filters.push({ type: "host", value: argv[++i] });
        break;
      case "--where":
        result.filters.push({ type: "raw", value: argv[++i] });
        break;
      case "--dry-run":
        result.dryRun = true;
        break;
      case "--confirm":
        result.confirm = true;
        break;
      case "--limit":
        result.limit = parseInt(argv[++i], 10);
        break;
      case "--batch-size":
        result.batchSize = parseInt(argv[++i], 10);
        break;
    }
    i++;
  }
  return result;
}

function printHelp() {
  const lines = [
    "",
    "db-cleanup.mjs — General-purpose URL cleanup tool",
    "",
    "Usage:",
    "  node scripts/db-cleanup.mjs <action> [filters...] [options]",
    "",
    "Actions:",
    "  count             just count matching rows",
    "  mark-inactive     SET inactive = TRUE",
    "  delete            DELETE permanently",
    "",
    "Filters (AND together):",
    "  --source <name>          WHERE source = '<name>'",
    "  --domain <pattern>       WHERE url ILIKE '%<pattern>%'",
    "  --category <id>          WHERE category_id = '<id>'",
    "  --subcategory <id>       WHERE subcategory_id = '<id>'",
    "  --host <hostname>        WHERE url ILIKE '%://<hostname>/%'",
    "  --where <raw SQL>        append arbitrary SQL clause",
    "",
    "Options:",
    "  --dry-run                show what would happen, don't execute",
    "  --confirm                skip interactive prompt",
    "  --limit <n>              cap rows affected",
    "  --batch-size <n>         rows per server sub-batch (default 500)",
    "",
    "Examples:",
    "  node scripts/db-cleanup.mjs count --source outside",
    "  node scripts/db-cleanup.mjs mark-inactive --source outside --confirm",
    "  node scripts/db-cleanup.mjs delete --domain brokensite.com --confirm",
    "  node scripts/db-cleanup.mjs delete --category c100... --dry-run",
    '  node scripts/db-cleanup.mjs delete --host example.com --where "AND seeder_score < 0.3" --confirm',
    "",
  ];
  console.log(lines.join("\n"));
}

// ── SQL builder ────────────────────────────────────────────────────────────────
function esc(s) {
  return s.replace(/'/g, "''");
}

function buildWhereClause(filters) {
  const clauses = [];
  for (const f of filters) {
    switch (f.type) {
      case "source":
        clauses.push(`source = '${esc(f.value)}'`);
        break;
      case "domain":
        clauses.push(`url ILIKE '%${esc(f.value)}%'`);
        break;
      case "category_id":
        clauses.push(`category_id = '${esc(f.value)}'`);
        break;
      case "subcategory_id":
        clauses.push(`subcategory_id = '${esc(f.value)}'`);
        break;
      case "host":
        clauses.push(`url ILIKE '%://${esc(f.value)}/%'`);
        break;
      case "raw":
        clauses.push(f.value);
        break;
    }
  }
  return clauses.length ? "WHERE " + clauses.join(" AND ") : "";
}

function buildActionSql(action, whereClause, limit, batchSize) {
  const limitClause = limit ? ` LIMIT ${limit}` : "";

  if (action === "count") {
    return `SELECT count(1) AS cnt FROM urls ${whereClause}${limitClause}`;
  }

  // Build the inner sub-select once, then use it in a DO loop
  const innerSelect = `SELECT id FROM urls ${whereClause} ORDER BY id LIMIT ${batchSize}`;

  if (action === "mark-inactive") {
    return `
DO $$
DECLARE
  batch_count INT;
  total_count INT := 0;
BEGIN
  LOOP
    UPDATE urls SET inactive = TRUE
    WHERE id IN (${innerSelect});
    GET DIAGNOSTICS batch_count = ROW_COUNT;
    total_count := total_count + batch_count;
    EXIT WHEN batch_count = 0;
    ${limit ? `EXIT WHEN total_count >= ${limit};` : ""}
  END LOOP;
  RAISE NOTICE 'DONE marking inactive. Total: %', total_count;
END $$;
`;
  }

  // delete
  return `
DO $$
DECLARE
  batch_count INT;
  total_count INT := 0;
BEGIN
  LOOP
    DELETE FROM urls
    WHERE id IN (${innerSelect});
    GET DIAGNOSTICS batch_count = ROW_COUNT;
    total_count := total_count + batch_count;
    EXIT WHEN batch_count = 0;
    ${limit ? `EXIT WHEN total_count >= ${limit};` : ""}
  END LOOP;
  RAISE NOTICE 'DONE deleting. Total: %', total_count;
END $$;
`;
}

// ── Management API helper ──────────────────────────────────────────────────────
async function runSql(sql) {
  const res = await fetch(MGMT_API, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`SQL error (HTTP ${res.status}): ${text.slice(0, 500)}`);
  }
  return text;
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question + " ", (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.filters.length === 0) {
    console.error("At least one filter is required (e.g. --source, --domain).");
    console.error("Use --help for usage.");
    process.exit(1);
  }

  const whereClause = buildWhereClause(args.filters);
  const isCount = args.action === "count";

  // ── Count phase ──────────────────────────────────────────────────────────
  console.log(`\nCounting matching rows...`);
  console.log(`   WHERE: ${whereClause.slice(0, 120)}`);
  let cnt;
  try {
    const raw = await runSql(buildActionSql("count", whereClause));
    const parsed = JSON.parse(raw);
    cnt = parsed[0]?.cnt ?? 0;
    console.log(`   Found: ${cnt} row(s)`);

    if (cnt === 0) {
      console.log("Nothing to do. Exiting.\n");
      process.exit(0);
    }

    if (isCount) {
      process.exit(0);
    }

    if (args.limit && cnt > args.limit) {
      console.log(`   Will be capped at ${args.limit} row(s) (--limit)`);
    }
  } catch (err) {
    console.error("Count query failed:", err.message);
    process.exit(1);
  }

  // ── Safety prompts ───────────────────────────────────────────────────────
  if (args.action === "delete") {
    console.log(`\nTHIS WILL PERMANENTLY DELETE ~${cnt} ROWS.`);
  } else {
    console.log(`\nThis will mark ~${cnt} rows as inactive.`);
  }

  if (args.dryRun) {
    console.log("[DRY RUN] No changes were made.\n");
    process.exit(0);
  }

  if (!args.confirm) {
    const a = await ask("Type YES to proceed:");
    if (a !== "yes") {
      console.log("Aborted.\n");
      process.exit(0);
    }
  }

  // ── Execute ──────────────────────────────────────────────────────────────
  const verbLabel = args.action === "mark-inactive" ? "marking inactive" : "deleting";
  console.log(`\nRunning server-side batched ${verbLabel}...`);
  try {
    const result = await runSql(buildActionSql(args.action, whereClause, args.limit, args.batchSize));
    try {
      const data = JSON.parse(result);
      console.log(`   Completed. Response:`, JSON.stringify(data).slice(0, 200));
    } catch {
      console.log(`   Completed.`);
    }
  } catch (err) {
    console.error("Failed:", err.message);
    process.exit(1);
  }

  console.log();
}

main().catch(console.error);