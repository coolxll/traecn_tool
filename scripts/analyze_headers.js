const fs = require('fs');
const c = fs.readFileSync('D:/Trae CN/resources/app/extensions/ai-completion/resource/aiserver/server.js', 'utf8');

// 搜索请求头
const headers = ['x-authorization','Authorization','x-device-id','x-session-id','x-token','x-client','x-request-id','x-uid','x-product','x-machine-id','x-trace','x-app-id','x-flow-id','cookie','set-cookie','x-tt','x-mstoken','x-bogus'];
headers.forEach(h => {
  const r = new RegExp(h, 'gi');
  const m = c.match(r);
  if (m) console.log(`${h}: ${m.length} occurrences`);
});

console.log('\n--- Header-like strings near requests ---');
// 搜索看起来像 header 设置的模式
const headerPatterns = c.match(/['"][xX]-[\w-]+['"]\s*[,:]/g);
if (headerPatterns) {
  const unique = [...new Set(headerPatterns)].sort();
  unique.forEach(x => console.log(x));
}

console.log('\n--- Token/Auth patterns ---');
const authPatterns = c.match(/['"](?:token|access_token|session_token|jwt|bearer|auth)['"]/gi);
if (authPatterns) {
  [...new Set(authPatterns)].forEach(x => console.log(x));
}
