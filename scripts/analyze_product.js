const fs = require('fs');

// 读取 product.json 中的完整配置
const product = JSON.parse(fs.readFileSync('D:/Trae CN/resources/app/product.json', 'utf8'));

// 打印与 AI/copilot/icube 相关的配置
console.log('=== AI/Copilot 相关配置 ===');
function findKeys(obj, prefix = '') {
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      findKeys(obj[key], fullKey);
    } else {
      const keyLower = key.toLowerCase();
      if (keyLower.includes('ai') || keyLower.includes('copilot') || keyLower.includes('icube') || 
          keyLower.includes('model') || keyLower.includes('chat') || keyLower.includes('api') ||
          keyLower.includes('host') || keyLower.includes('url') || keyLower.includes('token') ||
          keyLower.includes('auth') || keyLower.includes('bigmodel') || keyLower.includes('marscode') ||
          keyLower.includes('server') || keyLower.includes('endpoint') || keyLower.includes('trae') ||
          keyLower.includes('queue') || keyLower.includes('agent') || keyLower.includes('cue') ||
          keyLower.includes('product')) {
        console.log(`${fullKey}: ${JSON.stringify(obj[key])}`);
      }
    }
  }
}
findKeys(product);
