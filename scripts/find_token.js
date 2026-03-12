const fs = require('fs');
const path = 'C:/Users/zrx-pc/AppData/Roaming/Trae CN/User/globalStorage/state.vscdb';
const b = fs.readFileSync(path);
const t = b.toString('utf8');

// Search for key patterns
const patterns = [
  /icube[^\x00]{0,80}/g,
  /auth\.token[^\x00]{0,80}/g,
  /refreshToken[^\x00]{0,80}/g,
  /userInfo[^\x00]{0,80}/g,
  /cloudide[^\x00]{0,80}/g,
  /trae\.ai[^\x00]{0,80}/g,
  /jwt[^\x00]{0,80}/g,
];

for (const p of patterns) {
  const m = t.match(p);
  if (m) {
    console.log(`\n=== Pattern: ${p.source} ===`);
    const unique = [...new Set(m.map(x => x.substring(0, 100)))];
    unique.slice(0, 10).forEach(x => console.log(x));
  }
}

// Also search for eyJ (JWT prefix)
const jwtMatches = t.match(/eyJ[A-Za-z0-9_-]{20,80}/g);
if (jwtMatches) {
  console.log(`\n=== JWT tokens found: ${jwtMatches.length} ===`);
  jwtMatches.slice(0, 3).forEach(x => console.log(x.substring(0, 80)));
}
