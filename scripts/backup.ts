import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const envFile = path.resolve(process.cwd(), ".env");
const databaseUrl = process.env.DATABASE_URL ?? (existsSync(envFile) ? readFileSync(envFile, "utf8").match(/^DATABASE_URL\s*=\s*["']?([^"'\r\n]+)["']?$/m)?.[1] : undefined);
if (!databaseUrl) throw new Error("DATABASE_URL is required to create a database backup.");

const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
const backupDir = path.resolve(process.cwd(), "backups", stamp);
mkdirSync(backupDir, { recursive: true });

try {
  const dumpUrl = new URL(databaseUrl);
  dumpUrl.searchParams.delete("schema");
  let pgDump = process.env.PG_DUMP_PATH;
  if (!pgDump) {
    try { execFileSync("pg_dump", ["--version"], { stdio: "ignore" }); pgDump = "pg_dump"; } catch { pgDump = undefined; }
  }
  pgDump ??= [path.resolve("C:/Program Files/PostgreSQL/17/bin/pg_dump.exe")].find((candidate) => existsSync(candidate));
  if (!pgDump) throw new Error("pg_dump executable was not found.");
  execFileSync(pgDump, ["--format=custom", "--no-owner", "--file", path.join(backupDir, "database.dump"), dumpUrl.toString()], { stdio: "inherit" });
} catch (error) {
  rmSync(backupDir, { recursive: true, force: true });
  throw new Error("pg_dump is required and the database backup could not be created.", { cause: error });
}

for (const asset of ["velmayil-ventures-logo.png", "velmayil-ventures-logo-pdf.png", "velmayil-ventures-watermark.png"]) {
  copyFileSync(path.resolve(process.cwd(), "public", asset), path.join(backupDir, asset));
}

writeFileSync(path.join(backupDir, "manifest.json"), JSON.stringify({ createdAt: new Date().toISOString(), files: ["database.dump", "velmayil-ventures-logo.png", "velmayil-ventures-logo-pdf.png", "velmayil-ventures-watermark.png"] }, null, 2));
console.log(`Backup created at ${backupDir}`);
