@echo off
REM Phase 3b: 10 seeders across 9 different categories.
REM Smarter picks — sites with known-good RSS/sitemap patterns.

start "Seeder: seriouseats"       cmd /k "cd /d C:\Users\Seito\Github\roam && node scripts/seed-seriouseats.mjs"
start "Seeder: food52"            cmd /k "cd /d C:\Users\Seito\Github\roam && node scripts/seed-food52.mjs"
start "Seeder: atlasobscura"      cmd /k "cd /d C:\Users\Seito\Github\roam && node scripts/seed-atlasobscura.mjs"
start "Seeder: computerhistory"   cmd /k "cd /d C:\Users\Seito\Github\roam && node scripts/seed-computerhistory.mjs"
start "Seeder: freakonomics"      cmd /k "cd /d C:\Users\Seito\Github\roam && node scripts/seed-freakonomics.mjs"
start "Seeder: historytoday"      cmd /k "cd /d C:\Users\Seito\Github\roam && node scripts/seed-historytoday.mjs"
start "Seeder: neurosciencenews"  cmd /k "cd /d C:\Users\Seito\Github\roam && node scripts/seed-neurosciencenews.mjs"
start "Seeder: bbcwildlife"       cmd /k "cd /d C:\Users\Seito\Github\roam && node scripts/seed-bbcwildlife.mjs"
start "Seeder: farnamstreet"      cmd /k "cd /d C:\Users\Seito\Github\roam && node scripts/seed-farnamstreet.mjs"
start "Seeder: edge-org"          cmd /k "cd /d C:\Users\Seito\Github\roam && node scripts/seed-edge-org.mjs"