# @3930a/dsh-stock-watch

A股盯盘行情带插件 for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)。

> 常驻页面行情条（3 秒刷新、涨红跌绿、自选股增删）+ `/stock/*` 数据路由，自选股与本地 `watchlist.json` 双向同步。

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![topic](https://img.shields.io/badge/topic-deepseekharness-6e40c9)](https://github.com/topics/deepseekharness)
[![platform](https://img.shields.io/badge/platform-DeepSeek%20Harness%20(Web)-ff8c00)](#)

## 特性

- 📊 常驻行情带：渲染在输入框下方随读带（`conversation.composer.dock` 插槽）
- 🔄 自动刷新：默认 3 秒，可通过组合配置 `refreshMs` 调整
- 🔴🟢 涨红跌绿（A 股惯例），收盘时段自动兜底显示「收 XX.XX」
- ➕ 行情带内直接添加自选股（6 位代码），悬停 ✕ 删除
- 💾 自选股读写本地 `watchlist.json`，可与桌面盯盘脚本共享同一文件
- 🌐 数据源：东方财富 push2 ulist 批量接口（UTF-8 JSON，无需 API Key）

## 安装（在目标 DeepSeek Harness 部署中引用）

### 1. 安装包到部署的 profile

```bash
cd <你的 profile 目录>          # 例如 ~/.dsh/profiles/web
pnpm add @3930a/dsh-stock-watch
# 或： npm install @3930a/dsh-stock-watch
```

### 2. 在组合中加入插件行

编辑 profile 的 `cordis.patch.yml`（或你的 `cordis.yml`）：

```yaml
- insert:
    - id: stock-strip
      name: '@3930a/dsh-stock-watch'
      config:
        watchlistPath: 'D:\desktop\stock_widget\watchlist.json'  # 可选：自选股 JSON 路径
        refreshMs: 3000                                            # 可选：刷新间隔（毫秒，默认 3000）
```

### 3. 重启 harness

重启后，任何会话的页面输入框下方都会自动出现行情带。

## 配置

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `watchlistPath` | string | 空（使用内置示例自选） | 自选股 JSON 文件路径；配置后行情带增删会写回该文件 |
| `refreshMs` | number | `3000` | 客户端轮询间隔（毫秒，最小 1000） |

`watchlist.json` 格式（与桌面脚本共享时保持此结构）：

```json
[
  { "code": "399006", "name": "创业板指", "cost_price": 0.0, "quantity": 0 }
]
```

## HTTP API（页面同源调用）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/stock/config` | 返回 `{ refreshMs, watchlistPath }` |
| GET | `/stock/quotes` | 返回 `{ quotes: [...] }`（自选股实时行情） |
| POST | `/stock/watch` | `{ action: "add" \| "remove", code: "000001" }`，返回最新行情与提示 |

行情字段：`code / name / price / change / pct / high / low / open / prev_close / closed / status`。

## 兼容性

- 面向 DeepSeek Harness Web 部署（`dsh-web-app` 前端；需要 `conversation.composer.dock` 插槽）
- 宿主半边依赖：`webServer`、`subprocess`、`fs`（均为 harness 标准服务）
- 数据抓取依赖系统 `curl`（Windows 10+ / macOS / Linux 自带）
- `lib/client.js` 为预打包格式（harness 的 `__ModuleLoader__`），请勿直接当普通 ESM 使用

## 仓库结构

```
.
├── lib/
│   ├── index.js    # 宿主半边：/stock/* 路由 + 自选股读写
│   └── client.js   # 页面半边：行情带组件（预打包）
├── package.json    # dsh.client 声明 + ./client 导出
├── LICENSE         # MIT
└── README.md
```

## 常见问题

**添加自选股后文件没写进去？**
写回 `watchlistPath` 受会话沙箱约束；位于工作区之外时需要用户批准（页面会弹提示）。若另有桌面程序同时写同一文件，请让双方都实现「文件热重载」（本插件每轮刷新前都会重读该文件）。

**行情带显示 0.00？**
收盘时段东财接口现价为 0，插件会自动用昨收价兜底并标「收」。

## License

MIT © 3930a
