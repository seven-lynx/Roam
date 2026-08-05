@echo off
REM Phase 3: Run 10 seeders in separate windows for monitoring.
REM Each targets a different under-served subcategory.

start "Seeder: spritzpets"   cmd /k "cd /d C:\Users\Seito\Github\roam && node scripts/seed-sprucepets.mjs"
start "Seeder: dogtime"      cmd /k "cd /d C:\Users\Seito\Github\roam && node scripts/seed-dogtime.mjs"
start "Seeder: akc"          cmd /k "cd /d C:\Users\Seito\Github\roam && node scripts/seed-akc.mjs"
start "Seeder: montereybayaquarium" cmd /k "cd /d C:\Users\Seito\Github\roam && node scripts/seed-montereybayaquarium.mjs"
start "Seeder: nationalgeographic-animals" cmd /k "cd /d C:\Users\Seito\Github\roam && node scripts/seed-nationalgeographic-animals.mjs"
start "Seeder: inaturalist"  cmd /k "cd /d C:\Users\Seito\Github\roam && node scripts/seed-inaturalist.mjs"
start "Seeder: eol"          cmd /k "cd /d C:\Users\Seito\Github\roam && node scripts/seed-eol.mjs"
start "Seeder: bto"          cmd /k "cd /d C:\Users\Seito\Github\roam && node scripts/seed-bto.mjs"
start "Seeder: nhm"          cmd /k "cd /d C:\Users\Seito\Github\roam && node scripts/seed-nhm.mjs"
start "Seeder: conversation-animals" cmd /k "cd /d C:\Users\Seito\Github\roam && node scripts/seed-conversation-animals.mjs"