// Consistent copy of the live database, safe while ODOT is running.
// In Docker: docker compose exec odot node scripts/backup.mjs
// Writes /data/backups/odot-YYYY-MM-DD-HHMM.db unless you pass a target path.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

const src = process.env.ODOT_DB_PATH ?? "data/odot.db";
const stamp = new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "");
const out = process.argv[2] ?? path.join(path.dirname(src), "backups", `odot-${stamp}.db`);
mkdirSync(path.dirname(out), { recursive: true });
new DatabaseSync(src, { readOnly: true }).exec(`VACUUM INTO '${out.replaceAll("'", "''")}'`);
console.log(out);
