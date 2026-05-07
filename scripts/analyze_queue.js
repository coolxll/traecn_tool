const fs = require('fs');
const c = fs.readFileSync('D:/Trae CN/resources/app/extensions/ai-completion/resource/aiserver/server.js', 'utf8');

// 1. 搜索 enable_chat_completion_backup_host 附近的上下文
console.log('=== backup_host 配置 ===');
let idx = c.indexOf('enable_chat_completion_backup_host');
if (idx !== -1) {
  console.log(c.substring(Math.max(0, idx - 300), Math.min(c.length, idx + 300)));
}

// 2. 搜索 queue position 相关代码
console.log('\n=== Queue Position 详情 ===');
idx = c.indexOf('queue position is');
if (idx !== -1) {
  console.log(c.substring(Math.max(0, idx - 400), Math.min(c.length, idx + 200)));
}

// 3. 搜索 BetaModelSlowQueue 和 AdvancedModelSlowQueue 
console.log('\n=== BetaModelSlowQueue ===');
idx = c.indexOf('BetaModelSlowQueue');
if (idx !== -1) {
  console.log(c.substring(Math.max(0, idx - 300), Math.min(c.length, idx + 300)));
}

console.log('\n=== AdvancedModelSlowQueue ===');
idx = c.indexOf('AdvancedModelSlowQueue');
if (idx !== -1) {
  console.log(c.substring(Math.max(0, idx - 300), Math.min(c.length, idx + 300)));
}

// 4. 搜索 jumpQueueTask 相关代码
console.log('\n=== jumpQueueTask ===');
idx = c.indexOf('jumpQueueTask');
while (idx !== -1) {
  console.log(`--- offset ${idx} ---`);
  console.log(c.substring(Math.max(0, idx - 200), Math.min(c.length, idx + 300)));
  console.log('');
  idx = c.indexOf('jumpQueueTask', idx + 1);
}

// 5. 搜索 REQUEST_WAIT 相关
console.log('\n=== REQUEST_WAIT 错误码 ===');
const waitPatterns = ['REQUEST_WAIT_EXCEED_QUEUE_SIZE', 'REQUEST_WAIT_IN_QUEUE_TIMEOUT'];
waitPatterns.forEach(p => {
  let i = c.indexOf(p);
  if (i !== -1) {
    console.log(`--- ${p} ---`);
    console.log(c.substring(Math.max(0, i - 200), Math.min(c.length, i + 200)));
    console.log('');
  }
});

// 6. 搜索模型相关配置 - ModelConfig 结构
console.log('\n=== ModelConfig 结构 ===');
const mcPatterns = c.match(/['"](?:model_config|modelConfig|model_type|modelType|provider_name|provider_id|is_beta|isBeta|max_token|maxToken|display_name|displayName|model_key|support_stream)['"]/gi);
if (mcPatterns) {
  [...new Set(mcPatterns)].sort().forEach(x => console.log(x));
}
