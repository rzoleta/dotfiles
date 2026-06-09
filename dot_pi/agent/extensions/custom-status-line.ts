import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs";
import { spawn } from "node:child_process";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

function cwdName(cwd: string): string {
	const parsed = path.parse(cwd);
	return path.basename(cwd) || parsed.root || cwd;
}

function modelLabel(ctx: ExtensionContext): string {
	return ctx.model ? `${ctx.model.id} (${ctx.model.provider})` : "no model";
}

function formatTokens(tokens: number): string {
	if (tokens < 1_000) return `${tokens}`;
	if (tokens < 1_000_000) return `${(tokens / 1_000).toFixed(tokens < 10_000 ? 1 : 0)}K`;
	return `${(tokens / 1_000_000).toFixed(1)}m`;
}

// ── Weekly usage fetching ─────────────────────────────────────────────

const MIN_FETCH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const FETCH_TIMEOUT_MS = 10000;

interface SubscriptionUsageCache {
	sessionPercent: number | null;
	weeklyPercent: number | null;
	provider: string;
	fetchedAt: number;
}

interface SubscriptionUsage {
	sessionPercent: number | null;
	weeklyPercent: number | null;
}

let weeklyUsageCache: SubscriptionUsageCache | null = null;
let lastFetchPromise: Promise<void> | null = null;

function expandHome(p: string): string {
	if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
	if (p === "~") return os.homedir();
	return p;
}

function getProvider(ctx: ExtensionContext): string {
	return (ctx.model?.provider ?? "").toLowerCase();
}

function providerKind(provider: string): "codex" | "claude" | "opencode-go" | null {
	if (provider.includes("codex") || provider === "openai") return "codex";
	if (provider.includes("claude") || provider === "anthropic") return "claude";
	if (provider.includes("opencode")) return "opencode-go";
	return null;
}

async function fetchWeeklyUsage(ctx: ExtensionContext): Promise<void> {
	const now = Date.now();
	const provider = getProvider(ctx);

	if (!provider) {
		weeklyUsageCache = null;
		return;
	}

	// Reuse cached data if it's for the same provider and still fresh
	if (
		weeklyUsageCache &&
		weeklyUsageCache.provider === provider &&
		now - weeklyUsageCache.fetchedAt < MIN_FETCH_INTERVAL_MS
	) {
		return;
	}

	// If a fetch is already in flight, wait for it
	if (lastFetchPromise) {
		await lastFetchPromise;
		return;
	}

	lastFetchPromise = (async () => {
		try {
			let usage: SubscriptionUsage | null = null;

			const kind = providerKind(provider);
			if (kind === "codex") {
				usage = await fetchCodexWeeklyUsage();
			} else if (kind === "claude") {
				usage = await fetchClaudeWeeklyUsage();
			} else if (kind === "opencode-go") {
				usage = await fetchOpenCodeGoWeeklyUsage();
			}

			if (usage && (usage.sessionPercent !== null || usage.weeklyPercent !== null)) {
				weeklyUsageCache = { ...usage, provider, fetchedAt: now };
			} else {
				weeklyUsageCache = null;
			}
		} catch {
			weeklyUsageCache = null;
		} finally {
			lastFetchPromise = null;
		}
	})();

	await lastFetchPromise;
}

function readFinitePercent(value: unknown): number | null {
	if (value === null || value === undefined) return null;
	if (typeof value === "string" && value.trim() === "") return null;
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

async function fetchCodexWeeklyUsage(): Promise<SubscriptionUsage | null> {
	const authPaths = process.env.CODEX_HOME
		? [path.join(process.env.CODEX_HOME, "auth.json")]
		: ["~/.config/codex/auth.json", "~/.codex/auth.json"];
	let token: string | null = null;
	let accountId: string | null = null;
	for (const p of authPaths) {
		try {
			const text = fs.readFileSync(expandHome(p), "utf8");
			const parsed = JSON.parse(text);
			if (parsed?.tokens?.access_token) {
				token = parsed.tokens.access_token;
				accountId = parsed.tokens.account_id ?? null;
				break;
			}
		} catch {
			// ignore
		}
	}
	if (!token) return null;

	const headers: Record<string, string> = {
		Authorization: `Bearer ${token}`,
		Accept: "application/json",
		"User-Agent": "OpenUsage",
	};
	if (accountId) headers["ChatGPT-Account-Id"] = accountId;

	const resp = await fetch("https://chatgpt.com/backend-api/wham/usage", {
		headers,
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
	});

	if (!resp.ok) return null;

	let sessionPercent = readFinitePercent(resp.headers.get("x-codex-primary-used-percent"));
	let weeklyPercent = readFinitePercent(resp.headers.get("x-codex-secondary-used-percent"));

	if (sessionPercent !== null && weeklyPercent !== null) {
		return { sessionPercent, weeklyPercent };
	}

	const data = await resp.json().catch(() => null);
	if (!data) return { sessionPercent, weeklyPercent };

	if (sessionPercent === null) {
		sessionPercent = readFinitePercent(data?.rate_limit?.primary_window?.used_percent);
	}
	if (weeklyPercent === null) {
		weeklyPercent = readFinitePercent(data?.rate_limit?.secondary_window?.used_percent);
	}

	return { sessionPercent, weeklyPercent };
}

async function fetchClaudeWeeklyUsage(): Promise<SubscriptionUsage | null> {
	let creds: { accessToken?: string } | null = null;
	try {
		const text = fs.readFileSync(expandHome("~/.claude/.credentials.json"), "utf8");
		const parsed = JSON.parse(text);
		if (parsed?.claudeAiOauth?.accessToken) {
			creds = parsed.claudeAiOauth;
		}
	} catch {
		return null;
	}
	if (!creds?.accessToken) return null;

	const resp = await fetch("https://api.anthropic.com/api/oauth/usage", {
		headers: {
			Authorization: `Bearer ${creds.accessToken}`,
			Accept: "application/json",
			"Content-Type": "application/json",
			"anthropic-beta": "oauth-2025-04-20",
			"User-Agent": "claude-code/2.1.69",
		},
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
	});

	if (!resp.ok) return null;

	const data = await resp.json().catch(() => null);
	if (!data) return null;

	return {
		sessionPercent: readFinitePercent(data?.five_hour?.utilization),
		weeklyPercent: readFinitePercent(data?.seven_day?.utilization),
	};
}

function sqlite3Json(dbPath: string, sql: string): Promise<any[]> {
	return new Promise((resolve, reject) => {
		const child = spawn("sqlite3", [dbPath, "-json"], {
			timeout: FETCH_TIMEOUT_MS,
		});
		let stdout = "";
		let stderr = "";

		child.stdout.on("data", (data: Buffer) => {
			stdout += data.toString("utf8");
		});
		child.stderr.on("data", (data: Buffer) => {
			stderr += data.toString("utf8");
		});
		child.on("error", reject);
		child.on("close", (code) => {
			if (code !== 0) {
				reject(new Error(stderr || `sqlite3 exited with ${code}`));
				return;
			}
			try {
				const parsed = JSON.parse(stdout);
				resolve(Array.isArray(parsed) ? parsed : []);
			} catch {
				resolve([]);
			}
		});
		child.stdin.write(sql, "utf8");
		child.stdin.end();
	});
}

async function fetchOpenCodeGoWeeklyUsage(): Promise<SubscriptionUsage | null> {
	const authPath = expandHome("~/.local/share/opencode/auth.json");
	try {
		const text = fs.readFileSync(authPath, "utf8");
		const parsed = JSON.parse(text);
		if (!parsed?.["opencode-go"]) return null;
	} catch {
		return null;
	}

	const dbPath = expandHome("~/.local/share/opencode/opencode.db");
	const sql = `SELECT
  CAST(COALESCE(json_extract(data, '$.time.created'), time_created) AS INTEGER) AS createdMs,
  CAST(json_extract(data, '$.cost') AS REAL) AS cost
FROM message
WHERE json_valid(data)
  AND json_extract(data, '$.providerID') = 'opencode-go'
  AND json_extract(data, '$.role') = 'assistant'
  AND json_type(data, '$.cost') IN ('integer', 'real')`;

	try {
		const rows = await sqlite3Json(dbPath, sql);
		if (!Array.isArray(rows)) return null;

		const nowMs = Date.now();
		const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
		const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
		const SESSION_LIMIT = 12;
		const WEEKLY_LIMIT = 30;

		const date = new Date(nowMs);
		const offset = (date.getUTCDay() + 6) % 7;
		date.setUTCDate(date.getUTCDate() - offset);
		date.setUTCHours(0, 0, 0, 0);
		const sessionStartMs = nowMs - FIVE_HOURS_MS;
		const weeklyStartMs = date.getTime();
		const weeklyEndMs = weeklyStartMs + WEEK_MS;

		let sessionTotal = 0;
		let weeklyTotal = 0;
		for (const row of rows) {
			const createdMs = Number(row.createdMs);
			const cost = Number(row.cost);
			if (!Number.isFinite(createdMs) || !Number.isFinite(cost)) continue;
			if (createdMs >= sessionStartMs && createdMs < nowMs) sessionTotal += cost;
			if (createdMs >= weeklyStartMs && createdMs < weeklyEndMs) weeklyTotal += cost;
		}

		const toPercent = (used: number, limit: number): number => {
			const percent = (Math.round(used * 10000) / 10000 / limit) * 100;
			if (!Number.isFinite(percent)) return 0;
			return Math.round(Math.max(0, Math.min(100, percent)) * 10) / 10;
		};

		return {
			sessionPercent: toPercent(sessionTotal, SESSION_LIMIT),
			weeklyPercent: toPercent(weeklyTotal, WEEKLY_LIMIT),
		};
	} catch {
		return null;
	}
}

// ── Status-line formatting ────────────────────────────────────────────

function formatContext(ctx: ExtensionContext): string {
	const usage = ctx.getContextUsage();
	if (!usage) return "? (?%)";

	const tokens = Math.max(0, Math.round(usage.tokens ?? 0));
	const contextWindow = usage.contextWindow ?? ctx.model?.contextWindow;
	const percent =
		usage.percent !== null && usage.percent !== undefined
			? usage.percent
			: contextWindow
				? (tokens / contextWindow) * 100
				: undefined;

	const pct = percent === undefined ? "?" : `${Math.round(percent)}`;
	const base = `${formatTokens(tokens)} (${pct}%)`;

	const subscription = weeklyUsageCache;
	if (subscription && subscription.provider === getProvider(ctx)) {
		const parts = [base];
		if (subscription.sessionPercent !== null) parts.push(`${Math.round(subscription.sessionPercent)}%`);
		if (subscription.weeklyPercent !== null) parts.push(`${Math.round(subscription.weeklyPercent)}% wk`);
		return parts.join(" · ");
	}

	return base;
}

function fitLine(left: string, right: string, width: number): string {
	if (width <= 0) return "";

	let leftText = left;
	let rightText = right;
	const minimumGap = 1;

	while (visibleWidth(leftText) + visibleWidth(rightText) + minimumGap > width && visibleWidth(rightText) > 0) {
		rightText = truncateToWidth(rightText, Math.max(0, visibleWidth(rightText) - 1), "");
	}
	while (visibleWidth(leftText) + visibleWidth(rightText) + minimumGap > width && visibleWidth(leftText) > 0) {
		leftText = truncateToWidth(leftText, Math.max(0, visibleWidth(leftText) - 1), "");
	}

	const gap = " ".repeat(Math.max(1, width - visibleWidth(leftText) - visibleWidth(rightText)));
	return truncateToWidth(leftText + gap + rightText, width, "");
}

// ── Extension entrypoint ──────────────────────────────────────────────

export default function customStatusLine(pi: ExtensionAPI) {
	let activeTui: TUI | undefined;

	const requestRender = () => activeTui?.requestRender();

	pi.on("session_start", (_event, ctx) => {
		// Kick off an initial usage fetch in the background
		fetchWeeklyUsage(ctx).then(requestRender).catch(() => {});

		ctx.ui.setFooter((tui, theme) => {
			activeTui = tui;

			return {
				invalidate() {},
				render(width: number): string[] {
					const left = theme.fg(
						"dim",
						`${cwdName(ctx.cwd)} · ${modelLabel(ctx)} · ${pi.getThinkingLevel()}`,
					);
					const right = theme.fg("dim", formatContext(ctx));
					return [fitLine(left, right, width)];
				},
				dispose() {
					if (activeTui === tui) activeTui = undefined;
				},
			};
		});
	});

	pi.on("message_end", requestRender);
	pi.on("turn_end", requestRender);
	pi.on("model_select", (_event, ctx) => {
		fetchWeeklyUsage(ctx).then(requestRender).catch(() => {});
	});
	pi.on("thinking_level_select", requestRender);
	pi.on("session_shutdown", () => {
		activeTui = undefined;
	});
}
