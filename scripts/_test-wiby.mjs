import fetch from 'node-fetch';

const r1 = await fetch('https://wiby.me/?q=astronomy', { headers: { 'User-Agent': 'Mozilla/5.0' } });
const html1 = await r1.text();

// Match: URL, title from tlink anchor; skip <p class="url">; get description from second <p>
const blockRe = /<blockquote>\s*<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<p class="url">[\s\S]*?<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>/gi;
let m, count = 0;
while ((m = blockRe.exec(html1)) !== null) {
  count++;
  const desc = m[3].replace(/<[^>]+>/g,'').trim().slice(0,100);
  if (count <= 3) console.log(`result ${count}: ${m[1]}\n  title: "${m[2].trim().slice(0,60)}"\n  desc:  "${desc}"\n`);
}
console.log('total matches:', count);
