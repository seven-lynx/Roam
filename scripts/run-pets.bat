@echo off
cd /d %~dp0
start "thedodo" cmd /k node seed-thedodo.mjs
start "catster" cmd /k node seed-catster.mjs
start "dogster" cmd /k node seed-dogster.mjs
start "petmd" cmd /k node seed-petmd.mjs
start "sprucepets" cmd /k node seed-sprucepets.mjs
start "hepper" cmd /k node seed-hepper.mjs
start "iheartdogs" cmd /k node seed-iheartdogs.mjs
start "allaboutbirds" cmd /k node seed-allaboutbirds.mjs
start "dogtime" cmd /k node seed-dogtime.mjs
start "animalwellness" cmd /k node seed-animalwellness.mjs