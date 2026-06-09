import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { AutocompleteItem } from "@earendil-works/pi-tui";

type ReasoningLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

const LEVELS: ReasoningLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh"];

const ALIASES: Record<string, ReasoningLevel> = {
	"0": "off",
	disable: "off",
	disabled: "off",
	false: "off",
	max: "xhigh",
	maximum: "xhigh",
	med: "medium",
	mid: "medium",
	min: "minimal",
	none: "off",
	no: "off",
	off: "off",
	on: "medium",
	x: "xhigh",
	"x-high": "xhigh",
	xhigh: "xhigh",
	"extra-high": "xhigh",
};

function modelLabel(ctx: ExtensionContext): string {
	return ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "no model";
}

function supportedLevels(ctx: ExtensionContext): ReasoningLevel[] {
	if (!ctx.model) return LEVELS;
	if (!ctx.model.reasoning) return ["off"];

	return LEVELS.filter((level) => {
		const mapped = ctx.model?.thinkingLevelMap?.[level];
		if (mapped === null) return false;
		// xhigh is opt-in: only models with an explicit mapping support it.
		if (level === "xhigh") return mapped !== undefined;
		return true;
	});
}

function parseLevel(args: string | undefined): ReasoningLevel | undefined {
	const raw = args?.trim().toLowerCase();
	if (!raw) return undefined;
	return ALIASES[raw] ?? (LEVELS.includes(raw as ReasoningLevel) ? (raw as ReasoningLevel) : undefined);
}

function updateStatus(pi: ExtensionAPI, ctx: ExtensionContext): void {
	ctx.ui.setStatus("reasoning", `🧠 ${pi.getThinkingLevel()}`);
}

function describeSupported(ctx: ExtensionContext): string {
	return supportedLevels(ctx).join(", ");
}

export default function reasoningExtension(pi: ExtensionAPI) {
	pi.registerCommand("reasoning", {
		description: "Set reasoning/thinking/effort level for the current model",
		getArgumentCompletions(prefix: string): AutocompleteItem[] | null {
			const normalized = prefix.trim().toLowerCase();
			const items = LEVELS.filter((level) => level.startsWith(normalized)).map((level) => ({
				value: level,
				label: level,
				description: "reasoning/thinking/effort level",
			}));
			return items.length > 0 ? items : null;
		},
		handler: async (args, ctx) => {
			let requested = parseLevel(args);

			if (!requested) {
				const trimmed = args?.trim();
				if (trimmed) {
					ctx.ui.notify(
						`Unknown reasoning level "${trimmed}". Use: ${LEVELS.join(", ")}`,
						"error",
					);
					return;
				}

				const current = pi.getThinkingLevel() as ReasoningLevel;
				const options = supportedLevels(ctx).map((level) => (level === current ? `${level} (current)` : level));
				const selected = await ctx.ui.select(
					`Reasoning for ${modelLabel(ctx)} (current: ${current})`,
					options,
				);
				if (!selected) return;
				requested = selected.split(" ")[0] as ReasoningLevel;
			}

			const before = pi.getThinkingLevel() as ReasoningLevel;
			pi.setThinkingLevel(requested as never);
			const after = pi.getThinkingLevel() as ReasoningLevel;
			updateStatus(pi, ctx);

			if (after !== requested) {
				ctx.ui.notify(
					`Requested ${requested}; ${modelLabel(ctx)} uses ${after}. Supported: ${describeSupported(ctx)}`,
					"warning",
				);
				return;
			}

			ctx.ui.notify(
				before === after ? `Reasoning already ${after}` : `Reasoning set to ${after}`,
				"info",
			);
		},
	});

	pi.on("session_start", (_event, ctx) => {
		updateStatus(pi, ctx);
	});

	pi.on("thinking_level_select", (_event, ctx) => {
		updateStatus(pi, ctx);
	});

	pi.on("model_select", (_event, ctx) => {
		updateStatus(pi, ctx);
	});
}
