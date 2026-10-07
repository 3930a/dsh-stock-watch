window.__ModuleLoader__.load({
	id: "@3930a/dsh-stock-watch",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		var react = require("react");

		const inject = ["slots"];
		const RISE = "#E63741";
		const FALL = "#32BE78";
		const FLAT = "rgba(128,133,150,.95)";
		const WARN = "#D97706";
		// 布局约定：
		//  - 原生滚动条彻底隐藏（不占高度）→ 行情带保持紧凑，不被撑高。
		//  - 改用「浮动指示条」：只在鼠标移到行情带上时淡出，平时隐身。
		//  - ＋ / 输入框固定在最左，同样悬停才现身（输入框打开时强制常显）。
		//  - 股票区横向滚动：滚轮 / 触控板 / 按住拖动。
		//  - 根容器 minWidth:0 —— 作为 flex 子项可被压缩，不再被右侧会话统计/用量压住。
		const CSS = ".stock-chip{display:inline-flex;align-items:center;gap:5px;flex:0 0 auto}" +
			".stock-chip-x{opacity:0;cursor:pointer;font-size:10px;color:rgba(230,55,65,.85);padding:0 2px}" +
			".stock-chip:hover .stock-chip-x{opacity:1}" +
			".stock-root .stock-add{opacity:0;transition:opacity .16s ease}" +
			".stock-root:hover .stock-add{opacity:1}" +
			".stock-add[data-open=\"1\"]{opacity:1 !important}" +
			".stock-scroll{scrollbar-width:none;-ms-overflow-style:none;overscroll-behavior-x:contain}" +
			".stock-scroll::-webkit-scrollbar{display:none;width:0;height:0}" +
			".stock-ind-bar{position:absolute;bottom:0;height:3px;border-radius:2px;background:rgba(128,133,150,.55);opacity:0;transition:opacity .16s ease;pointer-events:none}" +
			".stock-root:hover .stock-ind-bar{opacity:1}";

		function StockStrip() {
			const [quotes, setQuotes] = react.useState([]);
			const [error, setError] = react.useState(null);
			const [msg, setMsg] = react.useState(null);
			const [msgWarn, setMsgWarn] = react.useState(false);
			const [addOpen, setAddOpen] = react.useState(false);
			const [codeInput, setCodeInput] = react.useState("");
			const [busy, setBusy] = react.useState(false);
			const [bar, setBar] = react.useState({ show: false, left: 0, width: 0 });
			const scrollRef = react.useRef(null);
			const dragRef = react.useRef({ on: false, x: 0, left: 0, moved: false });

			react.useEffect(() => {
				const style = document.createElement("style");
				style.textContent = CSS;
				document.head.appendChild(style);
				return () => { document.head.removeChild(style); };
			}, []);

			// 浮动指示条：按 scrollLeft 比例算位置；行情带尺寸或内容变化时重新校准
			const syncBar = react.useCallback(() => {
				const el = scrollRef.current;
				if (!el) return;
				const w = el.clientWidth;
				const sw = el.scrollWidth;
				if (sw <= w + 1) {
					setBar(function (b) { return (b.show || b.width !== 0) ? { show: false, left: 0, width: 0 } : b; });
					return;
				}
				const width = Math.max(24, Math.round((w / sw) * w));
				const max = sw - w;
				const left = Math.round((el.scrollLeft / max) * (w - width));
				setBar(function (b) {
					if (b.show && b.left === left && b.width === width) return b;
					return { show: true, left: left, width: width };
				});
			}, []);

			react.useEffect(() => {
				const el = scrollRef.current;
				if (!el) return;
				syncBar();
				el.addEventListener("scroll", syncBar, { passive: true });
				let ro = null;
				if (typeof ResizeObserver !== "undefined") {
					ro = new ResizeObserver(syncBar);
					ro.observe(el);
				}
				return () => {
					el.removeEventListener("scroll", syncBar);
					if (ro) ro.disconnect();
				};
			}, [syncBar]);

			react.useEffect(() => { syncBar(); }, [quotes, syncBar]);

			react.useEffect(() => {
				let alive = true;
				let timer = null;

				const load = async () => {
					try {
						const res = await fetch("/stock/quotes");
						const data = await res.json();
						if (!alive) return;
						if (data && data.error) { setError(data.error); return; }
						if (data && Array.isArray(data.quotes)) { setQuotes(data.quotes); setError(null); }
					} catch (e) {
						if (alive) setError(String(e && e.message ? e.message : e));
					}
				};

				const boot = async () => {
					let ms = 3000;
					try {
						const res = await fetch("/stock/config");
						const cfg = await res.json();
						const v = Number(cfg && cfg.refreshMs);
						if (Number.isFinite(v) && v >= 1000) ms = Math.floor(v);
					} catch (e) {
						// 保持默认 3000
					}
					if (!alive) return;
					load();
					timer = setInterval(load, ms);
				};
				boot();

				return () => { alive = false; if (timer) clearInterval(timer); };
			}, []);

			const applyResult = (data) => {
				if (data && data.error) { setMsg(data.error); setMsgWarn(false); return; }
				if (data && Array.isArray(data.quotes)) setQuotes(data.quotes);
				if (data && data.hint) { setMsg(data.hint); setMsgWarn(true); }
				else { setMsg(null); setMsgWarn(false); }
			};

			const submitAdd = async () => {
				const code = codeInput.trim();
				if (!/^\d{6}$/.test(code)) { setMsg("请输入 6 位股票代码"); setMsgWarn(false); return; }
				setBusy(true);
				try {
					const res = await fetch("/stock/watch", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ action: "add", code: code }),
					});
					const data = await res.json();
					applyResult(data);
					if (!data || !data.error) { setAddOpen(false); setCodeInput(""); }
				} catch (e) {
					setMsg(String(e && e.message ? e.message : e));
					setMsgWarn(false);
				} finally {
					setBusy(false);
				}
			};

			const removeStock = async (code) => {
				try {
					const res = await fetch("/stock/watch", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ action: "remove", code: code }),
					});
					const data = await res.json();
					applyResult(data);
				} catch (e) {
					setMsg(String(e && e.message ? e.message : e));
					setMsgWarn(false);
				}
			};

			// 鼠标滚轮直接横滚
			const onWheel = (e) => {
				const el = scrollRef.current;
				if (!el) return;
				if (el.scrollWidth <= el.clientWidth + 1) return;
				const delta = (e.deltaY || 0) !== 0 ? e.deltaY : e.deltaX;
				if (!delta) return;
				el.scrollLeft += delta;
			};

			// 按住拖动横滚（拖动超过 4px 才算拖，避免误触 ✕ 删除）
			const onPointerDown = (e) => {
				const el = scrollRef.current;
				if (!el || e.button !== 0) return;
				if (el.scrollWidth <= el.clientWidth + 1) return;
				dragRef.current = { on: true, x: e.clientX, left: el.scrollLeft, moved: false };
			};
			const onPointerMove = (e) => {
				const d = dragRef.current;
				const el = scrollRef.current;
				if (!d.on || !el) return;
				const dx = e.clientX - d.x;
				if (!d.moved && Math.abs(dx) < 4) return;
				d.moved = true;
				e.preventDefault();
				el.scrollLeft = d.left - dx;
			};
			const onPointerEnd = () => { dragRef.current.on = false; };
			const onClickCapture = (e) => {
				if (dragRef.current.moved) {
					dragRef.current.moved = false;
					e.preventDefault();
					e.stopPropagation();
				}
			};

			const chips = quotes.map(function (q) {
				let color = FLAT;
				let text = q.name + " --";
				if (q.closed) {
					text = q.name + " 收" + q.price.toFixed(2);
				} else if (q.status === "ok") {
					color = q.pct > 0 ? RISE : (q.pct < 0 ? FALL : FLAT);
					const sign = q.pct > 0 ? "+" : "";
					text = q.name + " " + q.price.toFixed(2) + " " + sign + q.pct.toFixed(2) + "%";
				}
				return react.createElement("span", { key: q.code, className: "stock-chip", style: { color: color } },
					react.createElement("span", null, text),
					react.createElement("span", {
						className: "stock-chip-x",
						title: "从自选中删除 " + q.code,
						onClick: function () { removeStock(q.code); },
					}, "✕"),
				);
			});

			const inputStyle = {
				width: "72px",
				fontSize: "12px",
				padding: "2px 6px",
				borderRadius: "6px",
				border: "1px solid rgba(80,150,255,.6)",
				background: "transparent",
			};

			// 左侧固定区：＋（或输入框）—— 悬停才现身，不参与横向滚动
			const addControl = addOpen
				? react.createElement("span", { className: "stock-add", "data-open": "1", style: { display: "inline-flex", alignItems: "center", gap: "4px", flex: "0 0 auto" } },
					react.createElement("input", {
						style: inputStyle,
						value: codeInput,
						placeholder: "6位代码",
						autoFocus: true,
						onChange: function (e) { setCodeInput(e.target.value); },
						onKeyDown: function (e) { if (e.key === "Enter") submitAdd(); },
					}),
					react.createElement("button", { onClick: submitAdd, disabled: busy, style: { cursor: "pointer", fontSize: "12px", padding: "2px 6px", borderRadius: "6px", border: "1px solid rgba(80,150,255,.6)", background: "transparent" } }, busy ? "…" : "✓"),
					react.createElement("button", { onClick: function () { setAddOpen(false); setCodeInput(""); }, style: { cursor: "pointer", fontSize: "12px", padding: "2px 6px", borderRadius: "6px", border: "none", background: "transparent" } }, "✕"),
				)
				: react.createElement("button", {
					className: "stock-add",
					onClick: function () { setAddOpen(true); setMsg(null); setMsgWarn(false); },
					title: "添加自选股（6 位代码）",
					style: { cursor: "pointer", fontSize: "12px", padding: "1px 8px", borderRadius: "6px", border: "1px dashed rgba(128,133,150,.6)", background: "transparent", flex: "0 0 auto" },
				}, "＋");

			return react.createElement("div", {
				className: "stock-root",
				style: {
					display: "flex",
					flexDirection: "row",
					alignItems: "center",
					gap: "8px",
					fontSize: "12px",
					whiteSpace: "nowrap",
					opacity: 0.9,
					minWidth: 0,
					maxWidth: "100%",
					overflow: "hidden",
				},
			},
				addControl,
				react.createElement("div", {
					style: { position: "relative", display: "flex", alignItems: "center", flex: "1 1 auto", minWidth: 0 },
					onPointerDown: onPointerDown,
					onPointerMove: onPointerMove,
					onPointerUp: onPointerEnd,
					onPointerLeave: onPointerEnd,
					onClickCapture: onClickCapture,
				},
					react.createElement("div", {
						ref: scrollRef,
						className: "stock-scroll",
						onWheel: onWheel,
						style: {
							display: "flex",
							alignItems: "center",
							gap: "12px",
							flex: "1 1 auto",
							minWidth: 0,
							overflowX: "auto",
							overflowY: "hidden",
							paddingRight: "12px",
							cursor: bar.show ? "grab" : "default",
						},
					}, chips),
					bar.show ? react.createElement("div", { className: "stock-ind-bar", style: { left: bar.left + "px", width: bar.width + "px" } }) : null,
				),
				msg ? react.createElement("span", { style: { color: msgWarn ? WARN : RISE, fontSize: "11px", flex: "0 0 auto" }, title: msg }, msg) : null,
				error && !msg ? react.createElement("span", { style: { color: RISE, fontSize: "11px", flex: "0 0 auto" }, title: error }, "行情获取失败") : null,
			);
		}

		function apply(ctx) {
			ctx.slots.inject("conversation.composer.dock", () => ctx.slots.register(
				{ name: "conversation.composer.dock", id: "stock-strip", order: 0 },
				StockStrip
			));
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
