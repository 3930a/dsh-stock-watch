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
		const CSS = ".stock-chip{display:inline-flex;align-items:center;gap:5px}" +
			".stock-chip-x{opacity:0;cursor:pointer;font-size:10px;color:rgba(230,55,65,.85);padding:0 2px}" +
			".stock-chip:hover .stock-chip-x{opacity:1}";

		function StockStrip() {
			const [quotes, setQuotes] = react.useState([]);
			const [error, setError] = react.useState(null);
			const [msg, setMsg] = react.useState(null);
			const [msgWarn, setMsgWarn] = react.useState(false);
			const [addOpen, setAddOpen] = react.useState(false);
			const [codeInput, setCodeInput] = react.useState("");
			const [busy, setBusy] = react.useState(false);

			react.useEffect(() => {
				const style = document.createElement("style");
				style.textContent = CSS;
				document.head.appendChild(style);
				return () => { document.head.removeChild(style); };
			}, []);

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

			return react.createElement("div", {
				style: {
					display: "flex",
					flexDirection: "row",
					alignItems: "center",
					gap: "12px",
					fontSize: "12px",
					whiteSpace: "nowrap",
					overflow: "hidden",
					opacity: 0.9,
				},
			},
				chips,
				addOpen
					? react.createElement("span", { style: { display: "inline-flex", alignItems: "center", gap: "4px" } },
						react.createElement("input", {
							style: inputStyle,
							value: codeInput,
							placeholder: "6位代码",
							onChange: function (e) { setCodeInput(e.target.value); },
							onKeyDown: function (e) { if (e.key === "Enter") submitAdd(); },
						}),
						react.createElement("button", { onClick: submitAdd, disabled: busy, style: { cursor: "pointer", fontSize: "12px", padding: "2px 6px", borderRadius: "6px", border: "1px solid rgba(80,150,255,.6)", background: "transparent" } }, busy ? "…" : "✓"),
						react.createElement("button", { onClick: function () { setAddOpen(false); setCodeInput(""); }, style: { cursor: "pointer", fontSize: "12px", padding: "2px 6px", borderRadius: "6px", border: "none", background: "transparent" } }, "✕"),
					)
					: react.createElement("button", {
						onClick: function () { setAddOpen(true); setMsg(null); setMsgWarn(false); },
						title: "添加自选股",
						style: { cursor: "pointer", fontSize: "12px", padding: "1px 8px", borderRadius: "6px", border: "1px dashed rgba(128,133,150,.6)", background: "transparent" },
					}, "＋"),
				msg ? react.createElement("span", { style: { color: msgWarn ? WARN : RISE, fontSize: "11px" }, title: msg }, msg) : null,
				error && !msg ? react.createElement("span", { style: { color: RISE, fontSize: "11px" }, title: error }, "行情获取失败") : null,
			);
		}

		function apply(ctx) {
			ctx.slots.register({ name: "conversation.composer.dock", id: "stock-strip" }, StockStrip);
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
