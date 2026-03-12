const fs = require('fs');
const c = fs.readFileSync('D:/Trae CN/resources/app/extensions/ai-completion/resource/aiserver/server.js', 'utf8');

// 1. 搜索 chat_completion 端点附近的代码
console.log('=== chat_completion 上下文 ===');
let idx = c.indexOf("chat_completion");
while (idx !== -1) {
  const start = Math.max(0, idx - 200);
  const end = Math.min(c.length, idx + 200);
  console.log('--- at offset ' + idx + ' ---');
  console.log(c.substring(start, end));
  console.log('');
  idx = c.indexOf("chat_completion", idx + 1);
}

// 2. 搜索 model_list 端点上下文
console.log('\n=== model_list 上下文 ===');
idx = c.indexOf("model_list");
while (idx !== -1) {
  const start = Math.max(0, idx - 150);
  const end = Math.min(c.length, idx + 150);
  console.log('--- at offset ' + idx + ' ---');
  console.log(c.substring(start, end));
  console.log('');
  idx = c.indexOf("model_list", idx + 1);
}

// 3. 搜索 llm_raw_chat 上下文
console.log('\n=== llm_raw_chat 上下文 ===');
idx = c.indexOf("llm_raw_chat");
while (idx !== -1) {
  const start = Math.max(0, idx - 150);
  const end = Math.min(c.length, idx + 150);
  console.log('--- at offset ' + idx + ' ---');
  console.log(c.substring(start, end));
  console.log('');
  idx = c.indexOf("llm_raw_chat", idx + 1);
}

// 4. 搜索 X-IDE-Token 和 X-Auth-Token 相关
console.log('\n=== X-IDE-Token 上下文 ===');
idx = c.indexOf("X-IDE-Token");
while (idx !== -1) {
  const start = Math.max(0, idx - 200);
  const end = Math.min(c.length, idx + 200);
  console.log('--- at offset ' + idx + ' ---');
  console.log(c.substring(start, end));
  console.log('');
  idx = c.indexOf("X-IDE-Token", idx + 1);
}

console.log('\n=== X-Auth-Token 上下文 ===');
idx = c.indexOf("X-Auth-Token");
while (idx !== -1) {
  const start = Math.max(0, idx - 200);
  const end = Math.min(c.length, idx + 200);
  console.log('--- at offset ' + idx + ' ---');
  console.log(c.substring(start, end));
  console.log('');
  idx = c.indexOf("X-Auth-Token", idx + 1);
}
