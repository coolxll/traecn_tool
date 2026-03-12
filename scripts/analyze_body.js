const fs = require('fs');
const c = fs.readFileSync('D:/Trae CN/resources/app/extensions/ai-completion/resource/aiserver/server.js', 'utf8');

// 1. 搜索 base URL - 在 product.json 中看到的域名在代码中的使用
console.log('=== copilot-cn.bytedance.net usage ===');
const domains = ['copilot-cn.bytedance.net', 'copilot-cn\\.bytedance', 'trae-api-cn', 'api.trae.com.cn', 'bytegate.zijieapi'];
domains.forEach(d => {
  const r = new RegExp(d.replace(/\./g, '\\.'), 'g');
  const m = c.match(r);
  if (m) console.log(`${d}: ${m.length} occurrences`);
});

// 2. 这些域名可能在 product.json 中配置，在代码中以变量引用
// 搜索 baseUrl / hostUrl / serviceUrl 相关
console.log('\n=== URL配置变量 ===');
const urlVars = c.match(/['"](?:baseUrl|base_url|hostUrl|host_url|serviceUrl|service_url|serverUrl|server_url|apiUrl|api_url|apiHost|apiEndpoint|traeApiUrl|copilotUrl)['"]/gi);
if (urlVars) {
  [...new Set(urlVars)].forEach(x => console.log(x));
}

// 3. 搜索 chat_completion 附近更大范围的上下文（包含请求体构造）
console.log('\n=== chat_completion 请求构造 ===');
let idx = c.indexOf("DevSendMessagesEndpoint");
if (idx !== -1) {
  // 搜索这个变量被使用的地方
  const varName = c.substring(idx, idx + 50).match(/\w+/)[0];
  console.log('Variable:', varName);
  
  // 搜索 chat_completion 路径被引用的地方
  const uses = [];
  let si = 0;
  while (true) {
    si = c.indexOf('chat_completion', si);
    if (si === -1) break;
    uses.push(si);
    si++;
  }
  console.log(`Found ${uses.length} references to chat_completion`);
  uses.forEach(u => {
    console.log(`\n--- offset ${u} (300 chars) ---`);
    console.log(c.substring(Math.max(0, u - 100), Math.min(c.length, u + 200)));
  });
}

// 4. 搜索请求体关键字段
console.log('\n=== 请求体字段 ===');
const bodyPatterns = c.match(/['"](?:model_name|model_id|prompt_id|conversation_id|session_id|stream|extra_context|extra_info|intent|code_context|project_name|file_path|language|messages|system_prompt|user_content|is_stream)['"]/gi);
if (bodyPatterns) {
  [...new Set(bodyPatterns)].sort().forEach(x => console.log(x));
}
