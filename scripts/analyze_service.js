const fs = require('fs');
const c = fs.readFileSync('D:/Trae CN/resources/app/extensions/ai-completion/resource/aiserver/server.js', 'utf8');

// 搜索 zi['METHODS'] 对象的完整定义
console.log('=== Chat Service METHODS (zi) ===');
let idx = c.indexOf("zi['METHODS']={");
if (idx === -1) idx = c.indexOf("zi[_0x254e5c(0x299)]");
if (idx !== -1) {
  // 往前找 zi 定义
  console.log(c.substring(idx, Math.min(c.length, idx + 600)));
}

// 搜索 SERVER_NAME
console.log('\n=== SERVER_NAME ===');
const serverNames = c.match(/SERVER_NAME['\]]*\s*=\s*['"][^'"]+['"]/g);
if (serverNames) {
  [...new Set(serverNames)].forEach(x => console.log(x));
}

// 搜索 sd['METHODS'] （ModelList 的 server）
console.log('\n=== Model Service (sd) ===');
idx = c.indexOf("sd['METHODS']");
if (idx === -1) idx = c.indexOf("sd['SERVER_NAME']");
if (idx !== -1) {
  console.log(c.substring(idx, Math.min(c.length, idx + 800)));
}

// 搜索 _storeService — Token 获取
console.log('\n=== Token/Store Service ===');
const storePatterns = c.match(/['"](?:getToken|getJwtToken|getAuth|refreshToken|signIn|login|getSession|getCredential|getIdeToken|ideToken|jwtToken|authToken)['"]/gi);
if (storePatterns) {
  [...new Set(storePatterns)].sort().forEach(x => console.log(x));
}

// 搜索 WebSocket 相关
console.log('\n=== WebSocket 使用 ===');
const wsPatterns = c.match(/['"](?:ws:\/\/|wss:\/\/)[^'"]+['"]/g);
if (wsPatterns) {
  [...new Set(wsPatterns)].forEach(x => console.log(x));
}

// 搜索 mchost.guru 相关
console.log('\n=== mchost.guru 配置 ===');
let mi = 0;
while (true) {
  mi = c.indexOf('mchost.guru', mi);
  if (mi === -1) break;
  console.log(`--- offset ${mi} ---`);
  console.log(c.substring(Math.max(0, mi - 150), Math.min(c.length, mi + 150)));
  console.log('');
  mi++;
}
