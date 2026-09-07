# AGENTS.md

Trae CN → OpenAI 兼容 API 反向代理工具。将字节跳动 Trae CN IDE 中的 20+ AI 模型反代为标准 OpenAI API。

## 项目结构

```
traecn_tool/
├── cmd/                    # 入口
├── internal/
│   ├── proxy/              # 代理核心逻辑
│   ├── auth/               # Token 管理
│   ├── encoding/           # AES-256-GCM 加解密（trae.go）
│   ├── sse/                # SSE 流式输出
│   ├── config/             # 配置 + 常量
│   ├── models/             # 数据模型
│   └── queue/              # 请求队列
├── trae_request/           # Trae 请求构造
├── config.example.json
├── go.mod                  # module github.com/zamatewi-cell/traecn_tool
└── docs/
```

## 常用命令

```bash
go build -o trae-proxy ./cmd/...
go run ./cmd/... -config config.example.json
```

## 关键约束

- 请求体使用 AES-256-GCM 加密，模拟 Trae CN 客户端通信协议
- `internal/encoding/trae.go` 是加解密核心，修改需同步测试
- `internal/config/constants.go` 包含硬编码常量（URL、版本号等），更新 Trae 版本时需检查
- 配置文件格式见 `config.example.json`
