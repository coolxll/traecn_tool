# trae-proxy 项目规则

## 代码规范

### Go 风格
- 遵循标准 Go 项目布局：`cmd/` 放入口，`internal/` 放内部包
- 使用 `slog` 作为日志库（Go 1.21+ 标准库）
- 错误信息用中文（面向中文用户），代码注释可中英混用
- 不使用全局变量，通过依赖注入传递
- HTTP handler 使用 Go 1.22+ 的新路由语法（`GET /path`）

### 命名规范
- 包名小写单词，不用下划线
- 导出函数/类型用 PascalCase
- 内部变量用 camelCase
- 常量用 PascalCase 或 ALL_CAPS（与上下文一致）

### 安全要求
- **永远不要** 在日志中输出完整 Token（最多显示前 20 字符）
- **永远不要** 将 `config.json` 提交到 Git
- Token 存储仅读取，不修改 Trae CN 的文件
- 所有外部输入（HTTP 请求体）必须校验

## 架构约定

### 包职责
| 包 | 职责 | 不应做 |
|-----|------|--------|
| `config` | 配置加载、常量定义 | 不做业务逻辑 |
| `auth` | Token 提取、刷新、多账号管理 | 不做 HTTP 请求 |
| `device` | 设备信息生成 | 不做 IO 操作 |
| `proxy` | 核心代理逻辑、请求转发 | 不处理 OpenAI 格式 |
| `openai` | OpenAI API 格式适配 | 不直接调 Trae API |
| `sse` | SSE 流读写 | 不做业务逻辑 |
| `queue` | 排队状态监控 | 不做 HTTP 请求 |
| `models` | 模型定义与查询 | 不做 IO 操作 |

### 数据流
```
用户请求 → openai.Server → proxy.TraeProxy → Trae 后端
                                    ?
                              auth.TokenProvider
                              device.DeviceInfo
                              queue.Monitor
```

## Git 工作流
- `main` 分支保持可编译状态
- 功能开发用 feature 分支
- 提交信息格式：`type: 描述`（如 `feat: 添加模型列表接口`）

## 测试
- 单元测试与源文件同目录：`xxx_test.go`
- 测试覆盖核心转换逻辑（SSE 解析、格式转换）
- CI 测试不依赖真实 Trae CN 环境（使用 mock）
