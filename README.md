# @3930a/dsh-stock-watch

A股盯盘行情带插件 for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)。

> 常驻页面行情条（3 秒刷新、涨红跌绿、自选股增删）+ `/stock/*` 数据路由；自选股与本地 `watchlist.json` 双向同步。

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![version](https://img.shields.io/badge/version-2.0.0-2ea043)](CHANGELOG.md)
[![topic](https://img.shields.io/badge/topic-deepseekharness-6e40c9)](https://github.com/topics/deepseekharness)
[![platform](https://img.shields.io/badge/platform-DeepSeek%20Harness%20(Web%20%2F%20Desktop)-ff8c00)](#)

**v2.0.0 变化**：界面改为「悬停浮出」极简形态（滚动条与 `＋` 平时隐身、不占高度），并修复自选股写回被沙箱拦下的问题。详见 [CHANGELOG.md](CHANGELOG.md)。

<img width="2494" height="1514" alt="行情带" src="https://github.com/user-attachments/assets/f2fb9d3a-1513-43bd-88d3-19c2a1cc360c" />

## 特性

- 📊 **常驻行情带**：渲染在输入框下方的随读带（`conversation.composer.dock` 插槽），任何会话都有
- 🖱️ **悬停浮出**：底部滚动指示条与 `＋` 按钮**平时隐身**，鼠标移入行情带才淡出显示 —— 不占高度、不打扰阅读
- ↔️ **横向滚动**：股票多了可滚轮横滚 / 触控板横滑 / 按住拖动；带体可被压缩，**不再被右侧「会话统计 / 用量」遮住**
- ➕ **`＋` 固定在最左**：输入 6 位代码即可添加；打开输入框时按钮常显、输入框自动聚焦、回车即提交
- 🔄 **自动刷新**：默认 3 秒（`refreshMs` 可调）
- 🔴🟢 **涨红跌绿**（A 股惯例）；收盘时段现价为 0 时自动用昨收兜底并标「收 XX.XX」
- 💾 **自选股持久化**：宿主半边**直接用 `node:fs` 读写 `watchlist.json`**（保留 `fs` 服务兜底），不受会话工作区沙箱限制，可与桌面盯盘脚本共享同一文件
- 🌐 **数据源**：东方财富 push2 ulist 批量接口（UTF-8 JSON，无需 API Key）

## 兼容性（适配的 DSH 版本）

| DSH 版本 | 状态 | 说明 |
|---|---|---|
| `0.1.6-alpha.x` 及更早 | ✅ 可用 | profile 的 `cordis.patch.yml` 插入行，或作为 bundle 出现在 `dsh.profile.bundles` |
| `0.2.0-rc.2`（CLI / 官方桌面端） | ✅ 实测可用 | 桌面端 profile 归应用独占管理（`dsh --profile desktop …` 会被拒绝），需把包放进该 profile 的 `node_modules` 并登记到 `dsh.profile.bundles` |

依赖的能力：

- 宿主半边：`webServer`（注册 `/stock/*` 路由）、`subprocess`（调用系统 `curl` 抓行情）；**自选文件读写不再依赖 `fs` 服务**
- 客户端半边：`conversation.composer.dock` 插槽（声明 `dsh.client.platform: "web"`，Electron 桌面端承载同一套 Web UI，同样适用）

> ⚠️ 关于 `peerDependencies`：本项目**故意只声明** `@deepseek-ai/cordis >= 4.0.0` 这一条宽区间。DSH `0.2.0` 起插件盘点会用 peer 版本区间做兼容性判断，区间写窄（例如 `^0.1.0-rc.6`）会被判「不兼容」而拒绝加载。请勿在未确认目标内核版本前收紧它。

## 安装

### 方式 A：0.1.x（`cordis.patch.yml` 或 bundle）

```bash
cd <你的 profile 目录>          # 例如 ~/.dsh/profiles/web
pnpm add @3930a/dsh-stock-watch
# 或： npm install @3930a/dsh-stock-watch
```

然后在 profile 的 `cordis.patch.yml` 里插入插件行（**或**把包名加进 `package.json` 的 `dsh.profile.bundles`，本包自带 `cordis.patch.yml` 会完成插入）：

```yaml
- insert:
    - id: stock-strip
      name: '@3930a/dsh-stock-watch'
      inject: [webServer]
      # 可选配置：
      # config:
      #   watchlistPath: 'D:\desktop\stock_widget\watchlist.json'
      #   refreshMs: 3000
```

### 方式 B：0.2.0 桌面端（profile 由应用独占管理）

```powershell
$p = "$env:USERPROFILE\.dsh\profiles\desktop"
# 1) 放进该 profile 的 node_modules（客户端模块也从这里取）
New-Item -ItemType Directory -Force "$p\node_modules\@3930a" | Out-Null
Copy-Item .\dsh-stock-watch "$p\node_modules\@3930a\" -Recurse -Force

# 2) 登记到该 profile 的 package.json：dependencies 加 file: 依赖，
#    dsh.profile.bundles 追加 "@3930a/dsh-stock-watch"
# 3) 在该 profile 的 cordis.patch.yml 里加自选文件路径（见下），然后重启应用
```

```yaml
- id: stock-strip
  name: "@3930a/dsh-stock-watch"
  config:
    watchlistPath: "D:\\desktop\\stock_widget\\watchlist.json"
```

### 重启 harness

重启后，任何会话的输入框下方都会自动出现行情带。**只在新建的会话里生效**（插件在启动时挂载）。

## 配置

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `watchlistPath` | string | 空（使用内置示例自选，改动不持久化） | 自选股 JSON 文件路径；配置后行情带增删会**直接写回该文件**（`node:fs`） |
| `refreshMs` | number | `3000` | 客户端轮询间隔（毫秒，最小 1000） |

`watchlist.json` 格式（与桌面脚本共享时保持此结构）：

```json
[
  { "code": "399006", "name": "创业板指", "cost_price": 0.0, "quantity": 0 }
]
```

## 界面交互

| 操作 | 说明 |
|---|---|
| 悬停行情带 | 底部浮出 3px 滚动指示条（按滚动比例定位）、左侧浮出 `＋` |
| 移开鼠标 | 指示条与 `＋` 一起淡出（0.16s），行情带回紧凑形态 |
| 滚轮 / 触控板横滑 / 按住拖动 | 横向浏览更多自选股（拖动超过 4px 才判定为拖动，不会误触 `✕`） |
| 点 `＋` | 打开输入框（自动聚焦），输 **6 位纯数字** 代码后回车或点 ✓ |
| 悬停某只股票 → 点 `✕` | 从自选中删除 |

## HTTP API（页面同源调用）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/stock/config` | 返回 `{ refreshMs, watchlistPath }` |
| GET | `/stock/quotes` | 返回 `{ quotes: [...] }`（自选股实时行情） |
| POST | `/stock/watch` | `{ action: "add" \| "remove", code: "000001" }`，返回最新行情与提示（`hint` / `error`） |

行情字段：`code / name / price / change / pct / high / low / open / prev_close / closed / status`。

## 常见问题

**加了自选没反应 / 删了又回来了？**
两种情况：① 代码不是 6 位纯数字 —— `sz000001`、`600519.SH` 都会被拒绝（服务端校验 `/^\d{6}$/`）；② 没配 `watchlistPath` 或写回失败。`GET /stock/config` 看 `watchlistPath` 是否为空；v2.0.0 起写回改用 `node:fs`，位于会话工作区之外也能写入（不再需要沙箱批准）。

**行情带被右边的会话统计 / 用量挡住了？**
v2.0.0 已修（根容器 `minWidth: 0` + 独立横向滚动区）。若仍被遮挡，把 `lib/client.js` 里滚动容器的 `paddingRight` 调大即可。

**行情带显示 0.00？**
收盘时段东财接口现价为 0，插件会自动用昨收价兜底并标「收」。

**为什么插件不给我报「写回失败」了？**
v2.0.0 起宿主半边直接写文件；若仍未配置 `watchlistPath`，接口会返回 `hint`：「改动仅在本次进程内生效（重启丢失）」。

## 更新日志

见 [CHANGELOG.md](CHANGELOG.md)。

## 仓库结构

```
.
├── lib/
│   ├── index.js        # 宿主半边：/stock/* 路由 + 自选股读写（node:fs）
│   └── client.js       # 页面半边：行情带组件（__ModuleLoader__ 预打包格式）
├── cordis.patch.yml    # bundle 补丁：插入 stock-strip 行
├── dsh.plugin.json     # 插件清单（名称/版本/入口/client 平台）
├── CHANGELOG.md
├── package.json        # dsh.bundle / dsh.client 声明 + ./client 导出
└── README.md
```

## License

MIT © 3930a
