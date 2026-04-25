import fetch from 'node-fetch';
import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../.env') });

const apiKey = process.env.GUARDIAN_API_KEY;
console.log('GUARDIAN_API_KEY present:', !!apiKey, apiKey ? `(${apiKey.slice(0,8)}...)` : '');

if (!apiKey) process.exit(1);

const params = new URLSearchParams({
  'api-key': apiKey,
  section: 'science',
  'page-size': '5',
  page: '1',
  'show-fields': 'thumbnail,trailText,headline',
});
const url = `https://content.guardianapis.com/search?${params}`;
console.log('Requesting:', url.replace(apiKey, 'REDACTED'));

const res = await fetch(url, { headers: { 'User-Agent': 'Roam-Seeder/1.0' } });
console.log('Status:', res.status, res.statusText);
const json = await res.json();
console.log('Response status:', json?.response?.status);
console.log('Total results:', json?.response?.total);
const results = json?.response?.results ?? [];
console.log('Results count:', results.length);
if (results[0]) {
  console.log('First result:', results[0].webUrl);
  console.log('  headline:', results[0].fields?.headline);
  console.log('  thumbnail:', results[0].fields?.thumbnail ? 'yes' : 'none');
}
