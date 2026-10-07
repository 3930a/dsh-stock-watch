// @3930a/dsh-stock-watch — 常驻 A 股盯盘（宿主半边）
//
// 供任何 DeepSeek Harness 部署引用的插件：注册 /stock/* 数据路由，
// 页面半边（lib/client.js）在 composer.dock 渲染行情带并轮询这些路由。
//
// 组合行示例：
//   - id: stock-strip
//     name: '@3930a/dsh-stock-watch'
//     config:
//       watchlistPath: 'D:\\desktop\\stock_widget\\watchlist.json'  # 可选，自选股 JSON
//       refreshMs: 3000                                              # 可选，客户端刷新间隔
export const name = 'stock-strip'
export const inject = ['webServer']

const DEFAULT_WATCHLIST = [
  { code: '399006', name: '创业板指', cost_price: 0, quantity: 0 },
  { code: '000776', name: '广发证券', cost_price: 0, quantity: 0 },
  { code: '300014', name: '亿纬锂能', cost_price: 0, quantity: 0 },
  { code: '300319', name: '麦捷科技', cost_price: 0, quantity: 0 },
  { code: '601916', name: '浙商银行', cost_price: 0, quantity: 0 },
]

let watchlist = DEFAULT_WATCHLIST.slice()
let configRef = {}
let ctxRef = null
let curlPath = 'curl'

function ctx_get(name) {
  if (ctxRef === null) return undefined
  return ctxRef.get(name)
}

function watchlistPath() {
  const p = configRef.watchlistPath
  return typeof p === 'string' && p.trim() !== '' ? p.trim() : ''
}

function refreshMs() {
  const v = Number(configRef.refreshMs)
  return Number.isFinite(v) && v >= 1000 ? Math.floor(v) : 3000
}

async function resolveCurl() {
  const subprocess = ctx_get('subprocess')
  if (subprocess === undefined) return
  for (const candidate of ['curl', 'curl.exe']) {
    try {
      const resolved = await subprocess.resolveExecutable(candidate)
      if (resolved) {
        curlPath = resolved
        return
      }
    } catch (error) {
      // 尝试下一个候选
    }
  }
  console.log('[stock-strip] curl resolve failed, using bare name')
}

function secid(code) {
  return (code.charAt(0) === '6' ? '1.' : '0.') + code
}

async function refreshWatchlistFromFile() {
  const path = watchlistPath()
  if (path === '') return
  const text = await readWatchlistText(path)
  if (text === undefined) return
  try {
    const raw = JSON.parse(text)
    if (!Array.isArray(raw)) return
    const fileCodes = raw.map(function (i) { return String(i.code) }).join(',')
    const memCodes = watchlist.map(function (i) { return i.code }).join(',')
    if (fileCodes !== memCodes) {
      watchlist = raw.map(function (item) {
        return {
          code: String(item.code),
          name: String(item.name || '--'),
          cost_price: Number(item.cost_price) || 0,
          quantity: Number(item.quantity) || 0,
        }
      })
      console.log('[stock-strip] watchlist reloaded from file:', watchlist.length, 'stocks')
    }
  } catch (error) {
    // 读不到就用内存列表
  }
}

function num(v) {
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

async function httpGetText(url) {
  const subprocess = ctx_get('subprocess')
  if (subprocess === undefined) {
    return { error: 'subprocess 服务不可用' }
  }
  let handle
  try {
    handle = subprocess.spawn({
      argv: [curlPath, '-s', '-m', '15', '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', url],
      cwd: 'C:\\',
      stdio: {
        stdin: 'ignore',
        stdout: { maxBytes: 262144 },
        stderr: { maxBytes: 8192 },
      },
      graceMs: 8000,
    })
  } catch (error) {
    return { error: 'spawn 失败: ' + String(error && error.message ? error.message : error) }
  }
  let outcome
  try {
    outcome = await handle.done
  } catch (error) {
    return { error: '进程失败: ' + String(error && error.message ? error.message : error) }
  }
  if (outcome.exitCode !== 0) {
    const errText = handle.collected.stderr ? handle.collected.stderr.readFrom(0).text : ''
    return { error: 'curl 退出码 ' + outcome.exitCode + (errText ? ' ' + errText.slice(0, 120) : '') }
  }
  const text = handle.collected.stdout ? handle.collected.stdout.readFrom(0).text : ''
  return { text: text }
}

async function fetchQuotes(codes) {
  const list = (codes && codes.length > 0)
    ? codes.map(function (c) { return { code: c, name: c } })
    : watchlist
  if (!codes || codes.length === 0) {
    await refreshWatchlistFromFile()
  }
  const src = (codes && codes.length > 0) ? list : watchlist
  const secids = src.map(function (item) { return secid(item.code) }).join(',')
  const url = 'https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&ut=fa5fd1943c7b386f172d6893dbfba10b&secids=' + encodeURIComponent(secids) + '&fields=f2,f3,f4,f12,f13,f14,f15,f16,f17,f18'
  const got = await httpGetText(url)
  if (got.error) {
    return { error: got.error }
  }
  let payload = null
  try {
    payload = JSON.parse(got.text)
  } catch (e) {
    return { error: 'JSON 解析失败' }
  }
  if (!payload || payload.rc !== 0 || !payload.data) {
    return { error: 'API rc=' + (payload ? String(payload.rc) : '?') }
  }
  const diff = payload.data.diff || []
  const byCode = {}
  for (const d of diff) {
    byCode[String(d.f12)] = d
  }
  const quotes = []
  for (const item of src) {
    const d = byCode[item.code]
    if (!d) {
      quotes.push({ code: item.code, name: item.name || '--', status: 'error', error_msg: '暂无数据' })
      continue
    }
    let price = num(d.f2)
    let change = num(d.f4)
    let pct = num(d.f3)
    const prevClose = num(d.f18)
    let closed = false
    if (price <= 0 && prevClose > 0) {
      // 收盘时段：现价为 0，用昨收兜底显示，不标涨跌
      price = prevClose
      change = 0
      pct = 0
      closed = true
    }
    quotes.push({
      code: String(d.f12),
      name: String(d.f14 || item.name || '--'),
      price: price,
      change: change,
      pct: pct,
      high: num(d.f15),
      low: num(d.f16),
      open: num(d.f17),
      prev_close: prevClose,
      status: 'ok',
      error_msg: '',
      closed: closed,
    })
  }
  return { quotes: quotes }
}

// 自选文件走 node:fs 直读直写：宿主插件运行在 Harness 的 Node 进程内，
// 不经过会话工作区沙箱（fs 服务在 workspace-write 下会拒绝工作区外的路径）。
async function readWatchlistText(targetPath) {
  try {
    const nodeFs = await import('node:fs/promises')
    return await nodeFs.readFile(targetPath, 'utf8')
  } catch (error) {
    const fs = ctx_get('fs')
    if (fs === undefined) return undefined
    try {
      const target = await fs.resolve(targetPath)
      return await fs.readText(target)
    } catch (error2) {
      return undefined
    }
  }
}

async function writeWatchlistFile(targetPath, content, approvedMode) {
  try {
    const nodeFs = await import('node:fs/promises')
    const nodePath = await import('node:path')
    await nodeFs.mkdir(nodePath.dirname(targetPath), { recursive: true })
    await nodeFs.writeFile(targetPath, content, 'utf8')
    return { ok: true }
  } catch (error) {
    return { error: String(error && error.message ? error.message : error) }
  }
}

async function persistWatchlist() {
  const path = watchlistPath()
  if (path === '') {
    return { hint: '未配置 watchlistPath，改动仅在本次进程内生效（重启丢失）。在组合行 config 里配置 watchlistPath 即可持久化。' }
  }
  const content = JSON.stringify(watchlist.map(function (item) {
    return {
      code: item.code,
      name: item.name,
      cost_price: item.cost_price || 0,
      quantity: item.quantity || 0,
    }
  }), null, 2)

  const first = await writeWatchlistFile(path, content, null)
  if (first.ok) {
    return { ok: true }
  }

  const approval = ctx_get('approval')
  const agents = ctx_get('agents')
  const agent = agents ? agents.currentInitiator() : undefined
  if (approval && agent) {
    try {
      const outcome = await approval.request({
        agent: agent,
        toolName: 'stock_watch_manage',
        reason: '把自选股变更写入 ' + path + '（位于会话工作区之外）',
      })
      if (outcome === 'allowed-once') {
        const retry = await writeWatchlistFile(path, content, 'danger-full-access')
        if (retry.ok) {
          return { ok: true }
        }
      }
    } catch (error) {
      console.log('[stock-strip] approval flow failed:', error && error.message ? error.message : error)
    }
  }

  return {
    ok: true,
    hint: '改动已在本会话生效，但写回 ' + path + ' 被沙箱拦下（' + first.error + '）。',
  }
}

async function addWatch(code) {
  if (!/^\d{6}$/.test(code)) {
    return { error: '无效的股票代码：' + code }
  }
  if (watchlist.some(function (item) { return item.code === code })) {
    return { error: code + ' 已在自选中' }
  }
  let name = '--'
  const probe = await fetchQuotes([code])
  if (probe.quotes && probe.quotes.length > 0 && probe.quotes[0].status === 'ok') {
    name = probe.quotes[0].name
  }
  watchlist.push({ code: code, name: name, cost_price: 0, quantity: 0 })
  const saved = await persistWatchlist()
  if (saved.error) {
    return { error: saved.error }
  }
  return { ok: true, name: name, hint: saved.hint }
}

async function removeWatch(code) {
  const before = watchlist.length
  watchlist = watchlist.filter(function (item) { return item.code !== code })
  if (watchlist.length === before) {
    return { error: code + ' 不在自选中' }
  }
  const saved = await persistWatchlist()
  if (saved.error) {
    return { error: saved.error }
  }
  return { ok: true, hint: saved.hint }
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

export function apply(ctx, config) {
  ctxRef = ctx
  configRef = (config && typeof config === 'object') ? config : {}

  ctx.webServer.register({
    kind: 'exact',
    path: '/stock/config',
    handler: async (req, res) => {
      sendJson(res, 200, { refreshMs: refreshMs(), watchlistPath: watchlistPath() })
    },
  })

  ctx.webServer.register({
    kind: 'exact',
    path: '/stock/quotes',
    handler: async (req, res) => {
      try {
        const out = await fetchQuotes(null)
        if (out.error) return sendJson(res, 502, { error: out.error })
        sendJson(res, 200, { quotes: out.quotes })
      } catch (error) {
        sendJson(res, 500, { error: String(error && error.message ? error.message : error) })
      }
    },
  })

  ctx.webServer.register({
    kind: 'exact',
    path: '/stock/watch',
    handler: async (req, res) => {
      let body = ''
      req.on('data', (chunk) => {
        body += chunk
        if (body.length > 4096) req.destroy()
      })
      req.on('end', async () => {
        try {
          const input = body ? JSON.parse(body) : {}
          const action = String(input.action || '')
          const code = String(input.code || '')
          if (action === 'add') {
            const out = await addWatch(code)
            if (out.error) return sendJson(res, 400, { error: out.error })
            sendJson(res, 200, { quotes: (await fetchQuotes(null)).quotes, hint: out.hint })
          } else if (action === 'remove') {
            const out = await removeWatch(code)
            if (out.error) return sendJson(res, 400, { error: out.error })
            sendJson(res, 200, { quotes: (await fetchQuotes(null)).quotes, hint: out.hint })
          } else {
            sendJson(res, 400, { error: 'action 必须是 add 或 remove' })
          }
        } catch (error) {
          sendJson(res, 500, { error: String(error && error.message ? error.message : error) })
        }
      })
    },
  })

  refreshWatchlistFromFile()
  resolveCurl()
}
