@echo off
cd /d %~dp0
start "audubon" cmd /k node seed-audubon.mjs
start "natgeo" cmd /k node seed-nationalgeographic-animals.mjs
start "wwf" cmd /k node seed-worldwildlife.mjs
start "monterey" cmd /k node seed-montereybayaquarium.mjs
start "wildlifetrusts" cmd /k node seed-wildlifetrusts.mjs
start "sandiegozoo" cmd /k node seed-sandiegozoo.mjs
start "conversation" cmd /k node seed-conversation-animals.mjs
start "awi" cmd /k node seed-awionline.mjs
start "bhl" cmd /k node seed-biodiversitylibrary.mjs
start "adw" cmd /k node seed-animaldiversity.mjs