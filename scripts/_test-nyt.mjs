import fetch from 'node-fetch';
import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../.env') });

const apiKey = process.env.NYT_API_KEY;

// Test Top Stories API
for (const section of ['science', 'arts', 'technology', 'world', 'health']) {
  const res = await fetch(`https://api.nytimes.com/svc/topstories/v2/${section}.json?api-key=${apiKey}`);
  const json = await res.json();
  const results = json?.results ?? [];
  console.log(`${section}: HTTP ${res.status} | ${results.length} stories | first: "${results[0]?.title?.slice(0,50)}"`);
}


