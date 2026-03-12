# Trae CN 反向代理工具（trae-proxy）— PRD & 任务追踪

> **项目状态**: Phase 0 - 协议逆向工程  
> **创建日期**: 2026-03-12  
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

| 模型 | 类别 | 状态 |
|------|------|------|
| Doubao-Seed-2.0-Code | 代码 | Beta |
| Doubao-Seed-1.8 | 通用 | 稳定 |
| Doubao-Seed-Code | 代码 | 稳定 |
| MiniMax-M2.5 | 通用 | 稳定 |
| MiniMax-M2.1 | 通用 | 稳定 |
| MiniMax-M2 | 通用 | 稳定 |
| GLM-5 | 通用 | Beta |
| GLM-4.7 | 通用 | 稳定 |
| GLM-4.6 | 通用 | 稳定 |
| DeepSeek-V3.1-Terminus | 通用 | 稳定 |
| Kimi-K2.5 | 通用 | Beta |
| Kimi-K2-0905 | 通用 | 稳定 |
| Qwen3.5-Plus | 通用 | 稳定 |
| Qwen3-Coder-Next | 代码 | 稳定 |

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
├── cmd/trae-proxy/main.go
├── internal/
│   ├── api/          # HTTP handlers + 路由 + 中间件
│   ├── adapter/      # OpenAI ? Trae CN 格式转换
│   ├── auth/         # 登录/Token管理
│   ├── pool/         # 账号池/负载均衡
│   ├── queue/        # 排队监控/处理
│   └── config/       # 配置管理
├── web/              # 管理面板
├── config.yaml
├── Dockerfile
└── README.md
```

---

## 6. 任务追踪

### Phase 0: 协议逆向工程 ? 当前阶段

- [ ] **0.1** 探索 Trae CN 安装目录结构
- [ ] **0.2** 分析 Electron 应用源码（解包 asar）
- [ ] **0.3** 提取 API 端点 URL 和认证机制
- [ ] **0.4** 配置 mitmproxy 抓包环境
- [ ] **0.5** 抓取完整通信流量（登录/对话/排队）
- [ ] **0.6** 记录协议分析文档

### Phase 1: 认证模块
- [ ] **1.1** 实现登录流程模拟
- [ ] **1.2** Token 存储与自动刷新
- [ ] **1.3** 多账号管理基础

### Phase 2: 核心聊天 API
- [ ] **2.1** 聊天请求构造
- [ ] **2.2** 流式响应解析
- [ ] **2.3** OpenAI 格式转换
- [ ] **2.4** `/v1/chat/completions` 端点
- [ ] **2.5** `/v1/models` 端点

### Phase 3: 排队系统
- [ ] **3.1** 排队状态检测
- [ ] **3.2** SSE 进度推送
- [ ] **3.3** 超时处理

### Phase 4: 多账号负载均衡
- [ ] **4.1** 账号池管理
- [ ] **4.2** 轮询策略
- [ ] **4.3** 故障转移

### Phase 5: 管理面板
- [ ] **5.1** 内嵌 Web UI
- [ ] **5.2** 账号/统计/排队可视化

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

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/agent/v3/create_agent_task` | POST | **核心聊天API**（流式SSE） |
| `/api/agent/v3/commit_toolcall_result` | POST | 工具调用结果提交 |
| `/api/ide/v1/chat_completion` | POST | 简单聊天（DevSendMessages） |
| `/api/ide/v1/llm_raw_chat` | POST | 原始LLM聊天 |
| `/api/ide/v1/get_detail_param` | POST | 模型详细配置/Prompt |
| `/api/ide/v1/model_list` | POST | 模型列表 |
| `/api/v1/commercial/chat_mode` | POST | 商业聊天模式 |
| `/api/ide/v1/code_completion_stream` | POST | 代码补全（流式） |
| `/api/ide/v1/features` | POST | 功能特性查询 |
| `/api/ide/v1/fast_apply` | POST | 快速应用 |
| `/api/ide/v1/embeddings` | POST | 向量嵌入 |
| `/api/ide/v1/get_client_config` | POST | 客户端配置 |
| `/api/ide/v1/privacy/query` | GET | 隐私模式查询 |

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
```json
{
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",  // JWT Token
  "refreshToken": "3bNkEJox...",                         // 刷新令牌
  "expiredAt": "2026-03-19T06:38:49.507Z",              // 过期时间
  "refreshExpiredAt": "2026-09-01T06:38:49.507Z",       // 刷新过期
  "userId": "643654987296776",
  "host": "https://api.trae.com.cn",
  "userRegion": {"region": "CN", "_aiRegion": "CN"},
  "account": {
    "username": "...",
    "scope": "marscode",
    "loginScope": "trae",
    "storeRegion": "CN",
    "userTag": "cn"
  }
}
```

#### 请求头认证逻辑
```
Cloud IDE 产品 → X-Auth-Token: <token>
IDE 产品 (trae) → X-IDE-Token: <token>  ← 我们使用这个
默认 → X-JWT-Token: <token>
```

#### 完整请求头（27个，Agent V3调用）
```
x-app-id: 6eefa01c-1036-4c7e-9ca5-d891f63bfcd8
x-app-version: default
x-ide-version-code: 20260212
x-app-version-code: 20260212
x-custom-trace-id: <trace_id>
x-device-brand: <brand>
x-device-cpu: <cpu>
x-device-id: <device_id>
x-machine-id: <machine_id>
x-os-version: <os_version>
x-device-type: windows
x-ide-version: 3.3.37
x-ide-version-type: stable
request-traffic-type: prod
x-custom-repo-urls: <optional>
X-Request-ID: <UUID>
X-Trae-Request-ID: <UUID>
X-IDE-Token: <JWT token>
Content-Type: application/json
```

### 7.4 请求/响应格式

#### 简单聊天 (chat_completion) 请求体字段
```json
{
  "messages": [{"role": "user", "content": "..."}],
  "model_name": "glm-5",
  "stream": true,
  "conversation_id": "...",
  "session_id": "...",
  "extra_info": {},
  "intent": "chat",
  "language": "zh-CN",
  "file_path": ""
}
```

#### Agent V3 (create_agent_task) 
- Body约300KB，包含完整上下文（prompts、tools定义、rules等）
- 返回SSE流式响应
- config_name 指定模型（如 "qwen3-coder", "glm-5"）

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

```rust
CustomModel {
  provider: "",
  is_preset: true,
  config_name: "glm-5",         // 内部名称
  config_source: Trae,
  model_name: "glm-5",          // API 模型名
  display_model_name: "GLM-5",  // 显示名
  use_remote_service: true,
  multimodal: false,
}
```

**模型配置函数列表**（get_detail_param）:
chat, chat_v3, builder, builder_v3, solo_coder, solo_builder, ui_builder_v2, inline_chat, git_ai, custom_agent_generation, utils, code_reviewer, code_review_summary, refactor
