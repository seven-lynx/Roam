@echo off
cd /d %~dp0
start "smithsonian" cmd /k node seed-smithsonians-animals.mjs
start "nwf" cmd /k node seed-nwf.mjs
start "hakai" cmd /k node seed-hakai.mjs
start "biographic" cmd /k node seed-biographic.mjs
start "oceanographic" cmd /k node seed-oceanographic.mjs
start "nhm" cmd /k node seed-nhm.mjs
start "amnh" cmd /k node seed-amnh.mjs
start "rewildingeurope" cmd /k node seed-rewildingeurope.mjs
start "inaturalist" cmd /k node seed-inaturalist.mjs
start "noaa" cmd /k node seed-noaa-fisheries.mjs
start "eol" cmd /k node seed-eol.mjs
start "bbcwildlife" cmd /k node seed-bbcwildlife.mjs
start "defenders" cmd /k node seed-defenders.mjs
start "oceana" cmd /k node seed-oceana.mjs
start "rainforesttrust" cmd /k node seed-rainforesttrust.mjs
start "chesterzoo" cmd /k node seed-chesterzoo.mjs
start "naturettl" cmd /k node seed-naturettl.mjs
start "bats" cmd /k node seed-bats.mjs
start "usgs" cmd /k node seed-usgs.mjs
start "bto" cmd /k node seed-bto.mjs