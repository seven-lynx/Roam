@echo off
REM Flush top cached seeders — URLs already discovered & metadata fetched,
REM just need to be committed to the DB.
REM
REM audio-hifi already flushed (16,847 inserted).

start "Seeder: lonelyplanet"     cmd /k "cd /d C:\Users\Seito\Github\roam && node scripts/seed-lonelyplanet.mjs"
start "Seeder: whiskey"          cmd /k "cd /d C:\Users\Seito\Github\roam && node scripts/seed-whiskey.mjs"
start "Seeder: craft-beer"       cmd /k "cd /d C:\Users\Seito\Github\roam && node scripts/seed-craft-beer.mjs"
start "Seeder: survival"         cmd /k "cd /d C:\Users\Seito\Github\roam && node scripts/seed-survival.mjs"
start "Seeder: smithsonians-animals" cmd /k "cd /d C:\Users\Seito\Github\roam && node scripts/seed-smithsonians-animals.mjs"
start "Seeder: mens-grooming"    cmd /k "cd /d C:\Users\Seito\Github\roam && node scripts/seed-mens-grooming.mjs"
start "Seeder: oceanographic"    cmd /k "cd /d C:\Users\Seito\Github\roam && node scripts/seed-oceanographic.mjs"
start "Seeder: defenders"        cmd /k "cd /d C:\Users\Seito\Github\roam && node scripts/seed-defenders.mjs"
start "Seeder: noaa-fisheries"   cmd /k "cd /d C:\Users\Seito\Github\roam && node scripts/seed-noaa-fisheries.mjs"
start "Seeder: bbcwildlife"      cmd /k "cd /d C:\Users\Seito\Github\roam && node scripts/seed-bbcwildlife.mjs"