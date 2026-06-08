# trae-proxy

> Trae CN → OpenAI Compatible API 反向代理工具

将 [Trae CN](https://www.trae.com.cn/)（字节跳动 AI IDE）中的 20+ 个 AI 模型反代为标准 OpenAI 兼容 API，适配任何支持 OpenAI API 的客户端。

## 特性

- **OpenAI 兼容 API** — 标准 `/v1/chat/completions` 和 `/v1/models` 接口
- **20+ 模型支持** — Doubao、DeepSeek、GLM、Kimi、Qwen、MiniMax 等
- **AES-256-GCM 加密** — 请求体加密，模拟 Trae CN 客户端通信协议
- **SSE 流式输出** — 完整的 Server-Sent Events 流式响应支持
- **多账号管理** — 轮询负载均衡，自动 Token 刷新
- **排队透传** — 实时显示模型排队位置和等待人数
- **零配置启动** — 自动检测本机 Trae CN Token，无需手动配置
- **跨平台** — 支持 Windows / macOS / Linux

## 支持的模型

### V1 原始聊天模型

| 模型 | 提供商 | Config Name |
|------|--------|-------------|
| Doubao-1.5-Pro | 字节跳动 | `seed_m8` |
| DeepSeek-R1 | DeepSeek | `deepseek-R1` |
| DeepSeek-V3 | DeepSeek | `deepseek-V3` |
| DeepSeek-V3-0324 | DeepSeek | `deepseek-V3-0324` |

### V3 Agent 模型

| 模型 | 提供商 | Config Name |
|------|--------|-------------|
| DeepSeek-V4-Pro | DeepSeek | `DeepSeek-V4-Pro` |
| DeepSeek-V4-Flash | DeepSeek | `DeepSeek-V4-Flash` |
| GLM-5.1 | 智谱 | `glm-5.1` |
| GLM-5 | 智谱 | `glm-5` |
| GLM-4.7 | 智谱 | `glm-4.7` |
| Kimi-K2.6 | Moonshot | `kimi-k2.6` |
| Qwen-3.6-Plus | 阿里巴巴 | `qwen-3.6-plus` |
| Qwen-3.5 | 阿里巴巴 | `qwen-3.5` |
| Qwen3-Coder | 阿里巴巴 | `qwen3-coder` |
| Doubao-Seed-2.0-Code | 字节跳动 | `Doubao-Seed-2.0-Code` |
| Doubao-Seed-1.8 | 字节跳动 | `doubao_1_8` |
| MiniMax-M2.7 | MiniMax | `minimax-m2.7` |
| MiniMax-M2.5 | MiniMax | `minimax-m2.5` |

> 模型列表会随 Trae CN 版本更新而变化，可通过 `/v1/models` 接口实时获取。
> 当前代码仅实现 V1 协议，V3 Agent 模型需要 V3 协议支持（待实现）。

## 快速开始

### 前置条件

- [Go 1.22+](https://go.dev/dl/) 已安装
- [Trae CN](https://www.trae.com.cn/) 已安装并登录

### 安装

```bash
# 克隆仓库
git clone https://github.com/zamatewi-cell/traecn_tool.git
cd traecn_tool

# 编译
go build -o trae-proxy ./cmd/trae-proxy

# 运行（自动检测 Token）
./trae-proxy
```

### 使用

```bash
# 启动代理
./trae-proxy --listen :9090

# 测试 API
curl http://localhost:9090/v1/models

# 发送聊天请求
curl http://localhost:9090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v3",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": true
  }'
```

### 命令行参数

```
Usage: trae-proxy [options]

Options:
  -config string    配置文件路径 (默认 "config.json")
  -listen string    监听地址 (默认 ":9090")
  -log-level string 日志级别 debug/info/warn/error (默认 "info")
  -version          显示版本号
```

## 配置

复制 `config.example.json` 为 `config.json`：

```json
{
  "listen_addr": ":9090",
  "log_level": "info",
  "accounts": [
    {
      "name": "main",
      "storage_path": "",
      "weight": 1
    }
  ]
}
```

| 字段 | 说明 |
|------|------|
| `listen_addr` | 监听地址，如 `:9090` |
| `log_level` | 日志级别：debug / info / warn / error |
| `accounts[].name` | 账号别名 |
| `accounts[].storage_path` | Trae CN storage.json 路径（留空自动检测） |
| `accounts[].token` | 直接提供 JWT Token（可选，优先级高于 storage_path） |
| `accounts[].weight` | 负载均衡权重 |

### 自动检测

如果不提供 `config.json`，程序会自动检测：

```
Windows: %APPDATA%\Trae CN\User\globalStorage\storage.json
macOS:   ~/Library/Application Support/Trae CN/User/globalStorage/storage.json
Linux:   ~/.config/Trae CN/User/globalStorage/storage.json
```

## API 接口

### GET /v1/models

返回可用模型列表（OpenAI 格式）。

### POST /v1/chat/completions

OpenAI 兼容的聊天接口，支持流式和非流式。

```json
{
  "model": "deepseek-v3",
  "messages": [
    {"role": "system", "content": "你是一个有用的助手"},
    {"role": "user", "content": "解释量子计算"}
  ],
  "stream": true,
  "temperature": 0.7,
  "max_tokens": 4096
}
```

### GET /v1/queue/status

查询模型排队状态。

```
GET /v1/queue/status               # 所有模型的排队状态
GET /v1/queue/status?model=glm-5   # 指定模型的排队状态
```

### GET /health

健康检查。

## 技术架构

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────────┐
│  任意 OpenAI │     │  trae-proxy  │     │  Trae CN Backend     │
│  兼容客户端   │────?│  :9090       │────?│  trae-api-cn.mchost  │
│  (curl/SDK)  │?────│  OpenAI API  │?────│  .guru               │
└─────────────┘     └──────────────┘     └──────────────────────┘
                     │ Token 提取    │
                     │ 格式转换      │
                     │ AES-256-GCM  │  ← 请求体加密
                     │ SSE 流式      │
                     │ 排队监控      │
                     │ 多账号轮询    │
```

### 工作流程

1. **Token 提取** — 自动从 Trae CN 的 `storage.json` 读取 JWT Token
2. **请求转换** — 将 OpenAI 格式请求转为 Trae CN API 格式
3. **请求加密** — 使用 AES-256-GCM 加密请求体（模拟 Trae CN 客户端协议）
4. **请求转发** — 带上完整的设备信息、认证头和加密参数发送到 Trae 后端
5. **响应转换** — 将 Trae CN SSE 流转为 OpenAI SSE 格式
6. **排队监控** — 实时检测并暴露排队状态

## 项目结构

```
traecn_tool/
├── cmd/
│   └── trae-proxy/
│       └── main.go              # 程序入口
├── internal/
│   ├── auth/
│   │   └── token.go             # Token 提取与多账号管理
│   ├── config/
│   │   ├── config.go            # 配置加载与持久化
│   │   └── constants.go         # API 常量与端点
│   ├── device/
│   │   └── device.go            # 设备指纹生成与请求头
│   ├── encoding/
│   │   └── trae.go              # AES-256-GCM 加密（请求体加密）
│   ├── models/
│   │   └── models.go            # 模型定义
│   ├── openai/
│   │   └── server.go            # OpenAI 兼容 API 服务
│   ├── proxy/
│   │   └── proxy.go             # 核心代理逻辑
│   ├── queue/
│   │   └── queue.go             # 排队监控
│   └── sse/
│       └── sse.go               # SSE 流处理
├── docs/
│   └── PRD.md                   # 产品需求文档与协议分析
├── scripts/
│   ├── analyze_*.js             # 协议分析脚本
│   └── find_token.js            # Token 查找工具
├── config.example.json          # 配置示例
├── .gitignore
├── go.mod
└── README.md
```

## 协议逆向发现

在开发过程中，我们对 Trae CN v1.107.1 进行了深入的协议分析：

### 关键发现

- **无 ASAR 打包** — Trae CN 的 Electron 应用未使用 asar，源码直接可读
- **15.8MB server.js** — AI 核心逻辑集中在单个混淆的 JS 文件中
- **ai-agent.dll** — 独立的 Rust 二进制负责实际 HTTP 通信
- **TTNet/sscronet** — 使用字节跳动定制的 Cronet 网络库
- **Token 明文存储** — JWT Token 以明文 JSON 存储在 `storage.json`
- **完整 API 映射** — 发现 13+ 个后端 API 端点

### API 架构

```
extension.js (Node.js 扩展)
    ? JSON-RPC over AHA IPC
ai-agent.dll (Rust, 端口 40005)
    ? sscronet/TTNet HTTP (AES-256-GCM 加密)
trae-api-cn.mchost.guru (后端 API)
```

### 加密机制

所有请求体使用 AES-256-GCM 加密：
- **密钥**: 32字节硬编码密钥（从 Trae CN 客户端提取）
- **密钥混淆**: 每次请求生成 8 字节随机 pin，XOR 密钥前 8 字节得到派生密钥
- **IV**: 12 字节随机数（前置到密文）
- **AAD**: Unix 时间戳字符串（来自 `X-Requested-At` 头）
- **线格式**: Base64(`[12字节 IV] + [密文 + 16字节 GCM tag]`)

完整协议分析详见 [docs/PRD.md](docs/PRD.md)。

## 灵感来源

本项目受到以下同类反代项目的启发：

- [cursor-api](https://github.com/lvhkhanh/cursor-api) — Cursor IDE 反代
- [kiro-api](https://github.com/nicepkg/kiro-api) — Kiro IDE 反代
- [antigravity-proxy](https://github.com/nicepkg/antigravity-proxy) — Antigravity 反代

## 免责声明

本项目仅供学习研究使用。使用本工具请遵守 Trae CN 的服务条款。请勿用于商业用途或大规模滥用。作者不对任何因使用本工具导致的后果负责。

## License

MIT
