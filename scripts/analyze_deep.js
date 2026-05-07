const fs = require('fs');
const c = fs.readFileSync('D:/Trae CN/resources/app/extensions/ai-completion/resource/aiserver/server.js', 'utf8');

// 1. 搜索 base URL / host 配置
console.log('=== Base URL / Host 配置 ===');
['copilot-cn.bytedance', 'trae-api-cn', 'api.trae.com.cn', 'bytegate.zijieapi'].forEach(h => {
  let idx = c.indexOf(h);
  while (idx !== -1) {
    const start = Math.max(0, idx - 150);
    const end = Math.min(c.length, idx + 150);
    console.log(`--- ${h} at offset ${idx} ---`);
    console.log(c.substring(start, end));
    console.log('');
    idx = c.indexOf(h, idx + 1);
  }
});

// 2. 搜索 queue / waiting 相关
console.log('\n=== 排队/等待相关 ===');
const queuePatterns = c.match(/['"][^'"]*(?:queue|waiting|wait_position|pending|queueing|排队)[^'"]*['"]/gi);
if (queuePatterns) {
  [...new Set(queuePatterns)].forEach(x => console.log(x));
}

// 3. 搜索 model name 相关（验证模型名格式）
console.log('\n=== 模型名格式 ===');
const modelPatterns = c.match(/['"](?:doubao|minimax|glm|deepseek|kimi|qwen)[^'"]*['"]/gi);
if (modelPatterns) {
  [...new Set(modelPatterns)].sort().forEach(x => console.log(x));
}

// 4. 搜索 stream 相关
console.log('\n=== Stream/SSE 模式 ===');
const streamPatterns = c.match(/['"][^'"]*(?:text\/event-stream|stream_chat|stream_mode|is_stream)[^'"]*['"]/gi);
if (streamPatterns) {
  [...new Set(streamPatterns)].forEach(x => console.log(x));
}

// 5. 搜索 chat_completion 请求体构造
console.log('\n=== chat body 字段名 ===');
const bodyFields = c.match(/['"](?:messages|prompt|model|model_id|model_name|temperature|max_tokens|top_p|system_prompt|conversation_id|session_id|extra_info)['"]/gi);
if (bodyFields) {
  [...new Set(bodyFields)].sort().forEach(x => console.log(x));
}
