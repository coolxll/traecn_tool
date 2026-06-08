# Trae CN 反向代理工具（trae-proxy）— PRD & 任务追踪

> **项目状态**: Phase 4 - 多账号负载均衡（已完成）  
> **创建日期**: 2026-03-12  
> **最后更新**: 2026-06-08  
> **技术栈**: Go 1.22+  
> **目标**: 将 Trae CN 的 AI 模型以 OpenAI 兼容 API 形式对外暴露

---

## 1. 背景与可行性

市面上已有大量成功的 IDE/AI 工具反代项目：
- **Cursor** → cursor-api / cursor2api（Electron 应用，已成功逆向）
- **Augment** → augment-api（类似架构）
- **Kiro** → kiro-proxy（AWS 出品，仍被逆向）
- **Antigravity** → 同理

Trae CN 作为字节跳动出品的 Electron IDE，其技术架构与上述产品高度类似：
- Electron 桌面客户端
- HTTPS + SSE 流式通信
- Token-based 认证

**结论：完全可行。** 字节的防护水平不会高于这些公司的综合水平，且 Electron 应用天然可逆向。

---

## 2. 支持模型

> **修正**: 模型列表已更新至 Trae CN v3.3.55 的实际可用模型。参考 CLIProxyAPI 和 trae-reverse 项目。

### V1 原始聊天模型 (llm_raw_chat)

| 模型 (config_name) | model_name | 类别 |
|------|------|------|
| seed_m8 | seed_m8 | Doubao-1.5-Pro |
| deepseek-R1 | deepseek-R1 | DeepSeek-R1 |
| deepseek-V3 | deepseek-V3 | DeepSeek-V3 |
| deepseek-V3-0324 | deepseek-V3-0324 | DeepSeek-V3-0324 |

### V2 原始聊天模型 (llm_raw_chat v2)

| 模型 (config_name) | model_name | 类别 |
|------|------|------|
| no_thinking_model | no_thinking_model | 标题生成专用 |

### V3 Agent 模型 (create_agent_task)

| 模型 (config_name) | model_name | 类别 |
|------|------|------|
| DeepSeek-V4-Pro | DeepSeek-V4-Pro | DeepSeek-V4-Pro |
| DeepSeek-V4-Flash | DeepSeek-V4-Flash | DeepSeek-V4-Flash |
| glm-5 | glm-5 | GLM-5 |
| glm-5.1 | glm-5.1 | GLM-5.1 |
| glm-5v-turbo | glm-5v-turbo | GLM-5V-Turbo (多模态) |
| glm-4.7 | glm-4.7 | GLM-4.7 |
| glm-4.6 | glm-4.6 | GLM-4.6 |
| kimi-k2.6 | kimi-k2.6 | Kimi-K2.6 |
| kimi-k2.5 | kimi-k2.5 | Kimi-K2.5 |
| kimi-k2 | kimi-k2 | Kimi-K2 |
| qwen-3.6-plus | qwen-3.6-plus__v2 | Qwen-3.6-Plus |
| qwen-3.5 | qwen-3.5 | Qwen-3.5-Plus |
| qwen3-coder | qwen3-coder__v2 | Qwen3-Coder |
| Doubao-Seed-2.0-Code | Doubao-Seed-2.0-Code__v2 | Doubao-Seed-2.0-Code |
| doubao_1_8 | doubao_1_8 | Doubao-Seed-1.8 |
| Doubao_1_6 | Doubao_1_6 | Doubao-Seed-1.6 |
| doubao-for-auto | doubao-for-auto | Doubao-Auto |
| minimax-m2.7 | minimax-m2.7 | MiniMax-M2.7 |
| minimax-m2.5 | minimax-m2.5 | MiniMax-M2.5 |
| minimax-m2.1 | minimax-m2.1 | MiniMax-M2.1 |
| minimax-m2 | minimax-m2 | MiniMax-M2 |

> **注意**: `config_name` 和 `model_name` 可能不同。例如 `qwen-3.6-plus` 的 model_name 为 `qwen-3.6-plus__v2`。

> **协议路由规则**: 模型名前缀决定协议版本:
> - `trae-v1/` 或 `raw-v1/` → V1
> - `trae-v2/` 或 `raw-v2/` → V2
> - `trae-v3/` 或 `agent/` → V3
> - 无前缀时，seed_m8/deepseek-R1/deepseek-V3/deepseek-V3-0324 默认走 V1，no_thinking_model 走 V2，其余走 V3

---

## 3. 技术架构

```
用户应用(ChatBox/NextChat等)
       │ OpenAI API
       ▼
  ┌─────────────────────────────────┐
  │          trae-proxy              │
  │  ┌───────────┐ ┌─────────────┐  │
  │  │ API兼容层  │ │ 协议转换层   │  │
  │  │ (OpenAI)  │ │ (Trae CN)   │  │
  │  └───────────┘ └─────────────┘  │
  │  ┌───────────┐ ┌─────────────┐  │
  │  │ 认证管理器 │ │ 排队管理器   │  │
  │  └───────────┘ └─────────────┘  │
  │  ┌───────────┐                  │
  │  │ 账号池    │                  │
  │  └───────────┘                  │
  └─────────────────────────────────┘
       │ Trae CN 协议
       ▼
  字节跳动后端
```

---

## 4. 核心 API 设计

### 4.1 聊天补全
```
POST /v1/chat/completions
Authorization: Bearer <proxy-api-key>

{
  "model": "deepseek-v3.1-terminus",
  "messages": [...],
  "stream": true
}
```

### 4.2 模型列表
```
GET /v1/models
→ 返回所有可用模型，含排队状态扩展字段
```

### 4.3 排队状态透传（SSE 扩展）
```
data: {"object":"queue.status","position":5,"estimated_wait":"30s"}
data: {"object":"queue.status","position":0}
data: {"id":"chatcmpl-xxx","choices":[{"delta":{"content":"Hello"}}]}
data: [DONE]
```

---

## 5. 项目结构

```
trae-proxy/
├── cmd/trae-proxy/main.go           # 程序入口
├── internal/
│   ├── auth/token.go                # JWT Token 提取与多账号管理
│   ├── config/
│   │   ├── config.go                # 配置加载与持久化
│   │   └── constants.go             # API 端点、版本号、认证格式常量
│   ├── device/device.go             # 设备指纹生成与请求头
│   ├── encoding/trae.go             # AES-256-GCM 加密（请求体加密）
│   ├── models/models.go             # 模型定义与查找
│   ├── openai/server.go             # OpenAI 兼容 HTTP 服务
│   ├── proxy/proxy.go               # 核心代理逻辑（请求构造、加密、转发、SSE）
│   ├── queue/queue.go               # 排队状态监控
│   └── sse/sse.go                   # SSE 流读写
├── docs/PRD.md                      # 本文档
├── scripts/                         # 协议分析脚本 (JS) + Frida hook 文档
├── config.example.json              # 配置示例
├── .gitignore
├── go.mod
└── README.md
```

---

## 6. 任务追踪

### Phase 0: 协议逆向工程 ✅ 已完成

- [x] **0.1** 探索 Trae CN 安装目录结构
- [x] **0.2** 分析 Electron 应用源码（解包 asar）
- [x] **0.3** 提取 API 端点 URL 和认证机制
- [x] **0.4** 配置 mitmproxy 抓包环境
- [x] **0.5** 抓取完整通信流量（登录/对话/排队）
- [x] **0.6** 记录协议分析文档

### Phase 1: 认证模块 ✅ 已完成

- [x] **1.1** 实现登录流程模拟（JWT Token 提取）
- [x] **1.2** Token 存储与自动刷新
- [x] **1.3** 多账号管理基础（轮询负载均衡）

### Phase 2: 核心聊天 API ✅ 已完成

- [x] **2.1** 聊天请求构造（V1 llm_raw_chat）
- [x] **2.2** 流式响应解析（SSE）
- [x] **2.3** OpenAI 格式转换
- [x] **2.4** `/v1/chat/completions` 端点
- [x] **2.5** `/v1/models` 端点

### Phase 3: 排队系统 ✅ 已完成

- [x] **3.1** 排队状态检测
- [x] **3.2** SSE 进度推送
- [x] **3.3** 超时处理

### Phase 4: 多账号负载均衡 ✅ 已完成

- [x] **4.1** 账号池管理
- [x] **4.2** 轮询策略
- [x] **4.3** 故障转移

### Phase 5: 高级功能 ? 待实现

- [ ] **5.1** V3 Agent 协议支持（create_agent_task）
- [ ] **5.2** 工具调用支持（commit_toolcall_result）
- [ ] **5.3** V2 协议支持（标题生成等）
- [ ] **5.4** 内嵌 Web UI 管理面板

---

## 7. 协议分析记录（Phase 0 已完成）

### 7.1 安装目录结构

**Trae CN v1.107.1** — Electron 应用，**无 asar 打包**，源码直接可读。

```
D:\Trae CN\
├── Trae CN.exe                          # Electron 主程序
├── resources/app/
│   ├── out/main.js                      # Electron 入口
│   ├── product.json                     # 核心配置（含所有API域名）
│   └── extensions/
│       └── ai-completion/               # AI 核心扩展
│           ├── resource/aiserver/
│           │   └── server.js            # 15.8MB Node.js AI服务
│           └── dist/
│               └── extension.js         # 8.1MB 扩展入口
└── modules/ai-agent/
    ├── ai_agent.dll                     # Rust AI Agent (端口40005)
    └── sscronet.dll                     # 字节 TTNet 网络库（Cronet改）
```

**用户数据目录**: `%APPDATA%\Trae CN\`

### 7.2 API 端点

**主域名**: `https://trae-api-cn.mchost.guru`
**备用域名**: `https://api5-normal.mchost.guru`

| 端点 | 方法 | 用途 | 协议版本 |
|------|------|------|----------|
| `/api/agent/v3/create_agent_task` | POST | Agent 任务创建（V3，Body 为原始 Base64 密文） | V3 |
| `/api/agent/v3/commit_toolcall_result` | POST | 工具调用结果提交 | V3 |
| `/api/ide/v1/llm_raw_chat` | POST | V1 原始 LLM 聊天（双层 envelope） | V1 |
| `/api/ide/v2/llm_raw_chat` | POST | V2 原始 LLM 聊天（标题生成） | V2 |
| `/api/ide/v1/model_list?type=llm_raw_chat` | GET | 模型列表 | - |
| `/api/ide/v1/get_detail_param` | POST | 模型详细配置/Prompt | - |
| `/api/ide/v1/chat` | POST | V2 高级聊天（intent/context resolvers） | V2 |
| `/api/ide/v1/context_select` | POST | 上下文选择 | - |
| `/api/ide/v1/intent_detect` | POST | 意图检测 | - |
| `/api/v1/commercial/chat_mode` | POST | 商业聊天模式 | - |
| `/api/ide/v1/code_completion_stream` | POST | 代码补全（流式） | - |
| `/api/ide/v1/features` | POST | 功能特性查询 | - |
| `/api/ide/v1/fast_apply` | POST | 快速应用 | - |
| `/api/ide/v1/embeddings` | POST | 向量嵌入 | - |
| `/api/ide/v1/get_client_config` | POST | 客户端配置 | - |
| `/api/ide/v1/privacy/query` | GET | 隐私模式查询 | - |

**WebSocket**: `wss://trae-ws-cn.mchost.guru/custom_model`
**监控**: `https://mon.zijieapi.com/monitor_browser/collect/batch/`
**特征门**: `https://bytegate.zijieapi.com/api/v1/feature_gates/value`

### 7.3 认证方式

#### Token 存储位置
```
文件: %APPDATA%\Trae CN\User\globalStorage\storage.json
键名: iCubeAuthInfo://icube.cloudide
格式: JSON字符串
```

#### Token 结构

**storage.json 中的原始格式**:
```json
{
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",  // JWT Token
  "refreshToken": "3bNkEJox...",
  "expiredAt": "2026-03-19T06:38:49.507Z",
  "userId": "643654987296776",
  ...
}
```

**实际使用的凭据格式** (从 JWT 中提取):
```json
{
  "jwt_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "machine_id": "2569994131757818",
  "device_id": "2569994131757818",
  "user_id": "643654987296776"  // 从 JWT payload 的 data.id / user_id / uid / sub 字段提取
}
```

> **修正**: `user_id` 不是直接从 storage.json 读取，而是通过解码 JWT payload (base64) 提取，依次尝试 `data.id`、`user_id`、`uid`、`sub` 字段。

#### 请求头认证逻辑
```
Authorization: Cloud-IDE-JWT <jwt_token>  ← 实际使用的认证方式
```

> **修正**: 之前推断认证头为 `X-IDE-Token`，实际实现使用 `Authorization: Cloud-IDE-JWT <jwt_token>` 格式。
> `X-Auth-Token`、`X-IDE-Token`、`X-JWT-Token` 是源码中的分支逻辑，但 Trae CN 实际走的是 `Cloud-IDE-JWT` 路径。

#### 完整请求头（Agent V3调用）
```
Authorization: Cloud-IDE-JWT <jwt_token>
x-app-id: 6eefa01c-1036-4c7e-9ca5-d891f63bfcd8
x-app-version: default
x-ide-version-code: 20260508
x-app-version-code: 20260401
x-device-brand: Lenovo
x-device-cpu: AMD
x-device-id: 2569994131757818
x-machine-id: 2569994131757818
x-os-version: Linux
x-device-type: linux
x-ide-version: 3.3.55
x-ide-version-type: stable
request-traffic-type: prod
get-svc: 1
User-Agent: TraeClient/TTNet
Accept: text/event-stream
Cache-Control: no-cache
X-Ide-Session-Id: <session_id>
X-Request-Pin: <hex_pin>
X-Requested-At: <unix_timestamp>
Content-Type: application/json
```

> **修正要点**:
> - 认证头从 `X-IDE-Token` 改为 `Authorization: Cloud-IDE-JWT`
> - IDE 版本从 `3.3.37/20260212` 更新为 `3.3.55/20260508`
> - `x-app-version-code` 与 `x-ide-version-code` 不同，分别为 `20260401` 和 `20260508`
> - 新增 `get-svc: 1` 头
> - 新增加密相关头 `X-Request-Pin` 和 `X-Requested-At`
> - 移除 `X-Request-ID`、`X-Trae-Request-ID`、`x-custom-trace-id`、`x-custom-repo-urls`
> - 设备信息（device_id/machine_id/CPU/OS）由各实现自行决定，Trae CN 客户端检测真实值

### 7.4 请求/响应格式

#### 简单聊天 (llm_raw_chat) 请求体字段

> **修正**: 所有请求体均经过 AES-256-GCM 加密，不再发送明文 JSON。

**加密流程**:
1. 构造内部 payload（messages 数组）
2. 使用 AES-256-GCM 加密，密钥为 `6195f24ca4d430f8a4833de7db8dac37d148a084e7464a351ffa68585c16b955`
3. 每次请求生成 8 字节随机 pin，XOR 密钥前 8 字节得到派生密钥
4. 使用 Unix 时间戳作为 GCM AAD（Additional Authenticated Data）
5. 输出 base64 编码的 nonce+ciphertext

**V1 外层 envelope**:
```json
{
  "model_name": "deepseek-V3",
  "message": "<base64 encrypted payload>",
  "tools": [...]  // 可选，工具定义放在外层明文中（不加密）
}
```

> **注意**: V1 的 tools 字段放在外层明文 envelope 中，不在加密的 inner payload 内。
> inner payload 只包含 messages 数组。

**V2 外层 envelope** (仅用于 no_thinking_model 标题生成):
```json
{
  "model_name": "no_thinking_model",
  "config_name": "title_generation",
  "config_source": 1,
  "messages": [],
  "tools": null,
  "session_id": "<uuid>",
  "conversation_id": "<uuid>",
  "message": "<base64 encrypted payload>"
}
```

> **注意**: V2 不支持 tools。V2 额外请求头:
> `X-App-Function: utils`, `X-Ide-Function: utils`, `x-ide-version-code: 20260401`

**V2 额外请求头**:
```
X-App-Function: utils
X-Ide-Function: utils
x-ide-version-code: 20260401
```

#### Agent V3 (create_agent_task)
- Body 是原始 Base64 密文（无 JSON 包装），约 300KB
- 包含完整上下文：`agent_type: "builder_v3"`、render_context、system prompts、50+ 工具定义
- 同样经过 AES-256-GCM 加密，加密后的 Base64 直接作为 HTTP Body 发送
- 返回 SSE 流式响应，事件类型包括：`task_created`、`thought`、`agent_event`、`tool_call`、`response`、`done`
- config_name 指定模型（如 "qwen-3.6-plus", "glm-5"）
- 工具调用结果通过 `/api/agent/v3/commit_toolcall_result` 提交
- **当前项目尚未实现 V3 协议**

#### get_detail_param 请求（获取模型配置+Prompt）
```json
{
  "function": "chat_v3",     // chat/chat_v3/builder/builder_v3/solo_coder/solo_builder/ui_builder_v2/inline_chat/git_ai/refactor
  "config_names": null,
  "need_prompt": true,
  "current_config_info": null,
  "poly_prompt": true,
  "mode_type": null,
  "agent_type": null
}
```

#### SSE 响应格式（TimingCost示例）
```json
{
  "config_name": "qwen3-coder",
  "gateway_preprocess_timing": 143,
  "gateway_server_processing_time": 6883,
  "agent_middleware_timing": 45,
  "agent_preprocess_timing": 60,
  "agent_postprocess_timing": 0,
  "name": "llm_..."
}
```

### 7.5 排队机制

#### 队列类型
```
BetaModelSlowQueue = 6        # Beta模型排队
AdvancedModelSlowQueue         # 高级模型排队
```

#### 错误码
```
REQUEST_WAIT_EXCEED_QUEUE_SIZE = 0xfd2 (4050)  # 队列已满
REQUEST_WAIT_IN_QUEUE_TIMEOUT = 0xfd3 (4051)   # 排队超时
```

#### 排队消息
```
"Too many current requests. Your queue position is {position}."
```

#### 队列指标
```
queueStartTime       # 排队开始时间
queueCostTime        # 排队花费时间
aiRequestQueueMaxDisplayPosition  # 最大显示位置
```

#### 服务方法
```
Chat, ResumeChat, AppendChat, StopChat
JumpQueueTask (插队/优先)
GetSessions, CreateSession, DeleteSession
GetMessages, DeleteMessage, RevertMessage
FastApply, MigrateChatHistory
```

### 7.6 网络架构

#### TTNet/sscronet
- ai-agent.dll 通过 sscronet.dll（字节 TTNet/Cronet 改版）发送 HTTP 请求
- UserAgent: "TraeClient/TTNet"
- appId: 787976, channel: icube-ai, envId: trae_desktop
- 配置路径: `%APPDATA%\Trae CN\ahanet`
- 启用自有 CA Store: enableCaStore=true

#### IPC 通信架构
```
extension.js (Node.js)
    ? JSON-RPC over AHA IPC
ai-agent.dll (Rust, port 40005)
    ? sscronet/TTNet HTTP
trae-api-cn.mchost.guru (后端)
```

#### Boot Config
```
agent_domain: https://trae-api-cn.mchost.guru
app_id: 6eefa01c-1036-4c7e-9ca5-d891f63bfcd8
ws_domain: wss://trae-ws-cn.mchost.guru/custom_model
bytegate: https://bytegate.zijieapi.com
tea_app_id: 711126
slardar_bid: trae_cn
```

### 7.7 模型配置信息

> **修正**: config_name 和 model_name 可能不同。例如 `qwen-3.6-plus` 的 model_name 为 `qwen-3.6-plus__v2`。

```rust
CustomModel {
  provider: "",
  is_preset: true,
  config_name: "qwen-3.6-plus",    // 内部配置名
  config_source: Trae,
  model_name: "qwen-3.6-plus__v2", // API 模型名（可能与 config_name 不同）
  display_model_name: "Qwen 3.6 Plus",
  use_remote_service: true,
  multimodal: false,
}
```

**模型配置函数列表**（get_detail_param）:
chat, chat_v3, builder, builder_v3, solo_coder, solo_builder, ui_builder_v2, inline_chat, git_ai, custom_agent_generation, utils, code_reviewer, code_review_summary, refactor
