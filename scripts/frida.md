根据历史会话和最近的分析，Frida 有两个**最有效**的 Attach 目标，分别对应不同的目的：

### 1. 抓取鉴权 Token (Extension Host 进程)
*   **有效目标**：`Trae CN.exe` 的 **Extension Host** 子进程（命令行中带有 `--type=utility --utility-sub-type=node.mojom.Node` 和 `--extensionHost` 的进程）。
*   **当前 PID**：根据最新扫描，可能是 **34600**（请根据实际 `frida-ps` 结果确认）。
*   **作用**：通过 Hook Node.js 的 N-API，实时拦截插件层生成的 JWT Token、JSON-RPC 调用和所有的鉴权 Header。

**脚本保存：`repro/frida_intercept.js`**
```javascript
// 针对 Trae 的 N-API 字符串拦截脚本
const napi_create_string_utf8 = Module.findExportByName(null, 'napi_create_string_utf8');
if (napi_create_string_utf8) {
    Interceptor.attach(napi_create_string_utf8, {
        onEnter: function(args) {
            try {
                const str = args[1].readUtf8String();
                if (str && str.length > 10) {
                    // 过滤关键特征
                    if (str.includes('https://') || str.includes('jsonrpc') || str.includes('Authorization') || str.includes('Cloud-IDE-JWT')) {
                        console.log('[N-API Create] ' + str);
                    }
                }
            } catch (e) {}
        }
    });
}

const napi_get_value_string_utf8 = Module.findExportByName(null, 'napi_get_value_string_utf8');
if (napi_get_value_string_utf8) {
    Interceptor.attach(napi_get_value_string_utf8, {
        onEnter: function(args) { this.buf = args[2]; },
        onLeave: function(retval) {
            if (!this.buf || this.buf.isNull()) return;
            try {
                const str = this.buf.readUtf8String();
                if (str && str.length > 10) {
                    if (str.includes('https://') || str.includes('Authorization') || str.includes('Cloud-IDE-JWT')) {
                        console.log('[N-API Get] ' + str);
                    }
                }
            } catch (e) {}
        }
    });
}
console.log('--- Token Interceptor Active ---');
```

---

### 2. 抓取原始 HTTP 请求 (ai_agent.dll)
*   **有效目标**：加载了 `ai_agent.dll` 的 `Trae CN.exe` 进程。
*   **当前 PID**：**41252**。
*   **作用**：直接拦截 Rust 核心库发出的 Fetch 请求。这是解决当前 `summary config` 缺失问题的关键，因为可以直接看到 IDE 成功发出请求时的完整 Body。

**脚本保存：`repro/hook_aha_net.js`**
```javascript
// 基于内存搜索定位 Rust 内部日志并 Hook
const module = Process.getModuleByName('ai_agent.dll');
// 搜索日志特征："[aha_net] send: calling Fetch"
const pattern = '5b 61 68 61 5f 6e 65 74 5d 20 73 65 6e 64 3a 20 63 61 6c 6c 69 6e 67 20 46 65 74 63 68';
const matches = Memory.scanSync(module.base, module.size, pattern);

if (matches.length > 0) {
    console.log('Found Fetch logger at: ' + matches[0].address);
    // 这里可以进一步回溯调用栈抓取参数
} else {
    console.log('Logger string not found, current session might be different.');
}
```

### 运行建议
推荐优先 Attach 到 **Extension Host** (PID 34600)，并运行 `repro/frida_intercept.js`。只要你在 Trae 界面随便点一下 AI 聊天，脚本就会刷出最新的 `Authorization: Cloud-IDE-JWT ...`。