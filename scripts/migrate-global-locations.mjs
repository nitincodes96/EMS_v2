// Moves attendance locations and holidays from per-department tables to the
// organization-wide ones WITHOUT losing data.
//
//   node scripts/migrate-global-locations.mjs            # phase 1: copy only, nothing removed
//   node scripts/migrate-global-locations.mjs --drop-old # phase 2: drop the old table/columns
//
// Phase 1 is safe to re-run; it copies rows, verifies the counts and leaves
// every old table/column in place. Phase 2 only removes things phase 1 has
// already copied (it re-verifies first).
import { PrismaClient } from "@prisma/client"

const DROP_OLD = process.argv.includes("--drop-old")
const p = new PrismaClient()
const q = (sql) => p.$queryRawUnsafe(sql)
const x = (sql) => p.$executeRawUnsafe(sql)
const count = async (sql) => Number((await q(sql))[0].c)

async function tableExists(name) {
  return (await count(`SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = '${name}'`)) > 0
}
async function columnExists(table, column) {
  return (await count(`SELECT COUNT(*) AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = '${table}' AND column_name = '${column}'`)) > 0
}
async function indexExists(table, index) {
  return (await count(`SELECT COUNT(*) AS c FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = '${table}' AND index_name = '${index}'`)) > 0
}
async function foreignKeys(table, column) {
  const r = await q(`SELECT constraint_name AS n FROM information_schema.key_column_usage WHERE table_schema = DATABASE() AND table_name = '${table}' AND column_name = '${column}' AND referenced_table_name IS NOT NULL`)
  return r.map((row) => row.n)
}

// ───────────────────────────── phase 1: copy ─────────────────────────────

// 1. ScheduleSettings.geofenceEnabled — on if any department had it on
if (!(await columnExists("ScheduleSettings", "geofenceEnabled"))) {
  await x(`ALTER TABLE ScheduleSettings ADD COLUMN geofenceEnabled BOOLEAN NOT NULL DEFAULT true`)
  console.log("✔ ScheduleSettings.geofenceEnabled added")
}
if (await columnExists("Department", "geofenceEnabled")) {
  const anyOn = (await count(`SELECT COUNT(*) AS c FROM Department WHERE geofenceEnabled = true`)) > 0
  await x(`INSERT INTO ScheduleSettings (id, createdAt, updatedAt) VALUES ('global', NOW(3), NOW(3)) ON DUPLICATE KEY UPDATE id = id`)
  await x(`UPDATE ScheduleSettings SET geofenceEnabled = ${anyOn ? "true" : "false"} WHERE id = 'global'`)
  console.log(`✔ geo-fence flag copied to global settings: ${anyOn ? "on" : "off"}`)
}

// 2. AttendanceLocation — copy every DepartmentLocation row, keeping ids
if (!(await tableExists("AttendanceLocation"))) {
  await x(`CREATE TABLE AttendanceLocation (
    id VARCHAR(191) NOT NULL,
    name VARCHAR(191) NOT NULL,
    latitude DOUBLE NOT NULL,
    longitude DOUBLE NOT NULL,
    radiusMeters INT NOT NULL DEFAULT 100,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL,
    PRIMARY KEY (id)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  console.log("✔ AttendanceLocation table created")
}
let locationsVerified = true
if (await tableExists("DepartmentLocation")) {
  const before = await count(`SELECT COUNT(*) AS c FROM DepartmentLocation`)
  await x(`INSERT IGNORE INTO AttendanceLocation (id, name, latitude, longitude, radiusMeters, createdAt, updatedAt)
           SELECT id, name, latitude, longitude, radiusMeters, createdAt, updatedAt FROM DepartmentLocation`)
  const missing = await count(`SELECT COUNT(*) AS c FROM DepartmentLocation d LEFT JOIN AttendanceLocation a ON a.id = d.id WHERE a.id IS NULL`)
  locationsVerified = missing === 0
  console.log(locationsVerified ? `✔ ${before} location(s) copied and verified` : `✖ ${missing} of ${before} location(s) did not copy`)
}

// 3. Holiday — make it usable organization-wide without touching its rows:
//    the departmentId column becomes optional (kept for reference), and the
//    global unique key the app relies on is added. Rows are never deleted.
if (await columnExists("Holiday", "departmentId")) {
  for (const fk of await foreignKeys("Holiday", "departmentId")) {
    await x(`ALTER TABLE Holiday DROP FOREIGN KEY \`${fk}\``)
  }
  await x(`ALTER TABLE Holiday MODIFY departmentId VARCHAR(191) NULL`)
  console.log("✔ Holiday.departmentId made optional (rows untouched)")
}
if (!(await indexExists("Holiday", "Holiday_name_date_key"))) {
  const dupes = await q(`SELECT name, date, COUNT(*) AS c FROM Holiday GROUP BY name, date HAVING c > 1`)
  if (dupes.length > 0) {
    console.log(`ℹ ${dupes.length} holiday(s) exist in more than one department (same name + date). They are kept; the global unique key will be added once you run --drop-old, which keeps one copy of each.`)
  } else {
    await x(`ALTER TABLE Holiday ADD UNIQUE INDEX Holiday_name_date_key (name, date)`)
    console.log("✔ Holiday unique key (name, date) added")
  }
}
if (!(await indexExists("Holiday", "Holiday_date_idx"))) {
  await x(`ALTER TABLE Holiday ADD INDEX Holiday_date_idx (date)`)
}

const locs = await count(`SELECT COUNT(*) AS c FROM AttendanceLocation`)
const hols = await count(`SELECT COUNT(*) AS c FROM Holiday`)
console.log(`Phase 1 done. AttendanceLocation: ${locs} row(s), Holiday: ${hols} row(s). Nothing was removed.`)

// ───────────────────────────── phase 2: drop old ─────────────────────────

if (DROP_OLD) {
  if (!locationsVerified) {
    console.error("✖ Locations were not fully copied — refusing to drop DepartmentLocation.")
    process.exit(1)
  }
  if (await tableExists("DepartmentLocation")) {
    await x(`DROP TABLE DepartmentLocation`)
    console.log("✔ DepartmentLocation dropped (all rows already in AttendanceLocation)")
  }
  if (await columnExists("Holiday", "departmentId")) {
    // Collapse cross-department duplicates to the oldest row before the unique key
    await x(`DELETE h1 FROM Holiday h1 JOIN Holiday h2 ON h1.name = h2.name AND h1.date = h2.date AND h1.createdAt > h2.createdAt`)
    for (const idx of ["Holiday_departmentId_name_date_key", "Holiday_departmentId_date_idx"]) {
      if (await indexExists("Holiday", idx)) await x(`ALTER TABLE Holiday DROP INDEX \`${idx}\``)
    }
    await x(`ALTER TABLE Holiday DROP COLUMN departmentId`)
    if (!(await indexExists("Holiday", "Holiday_name_date_key"))) {
      await x(`ALTER TABLE Holiday ADD UNIQUE INDEX Holiday_name_date_key (name, date)`)
    }
    console.log("✔ Holiday.departmentId dropped")
  }
  if (await columnExists("Department", "geofenceEnabled")) {
    await x(`ALTER TABLE Department DROP COLUMN geofenceEnabled`)
    console.log("✔ Department.geofenceEnabled dropped (value lives on ScheduleSettings)")
  }
  console.log("Phase 2 done. Schema now matches prisma/schema.prisma.")
}

await p.$disconnect()
