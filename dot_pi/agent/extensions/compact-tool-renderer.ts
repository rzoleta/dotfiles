/**
 * Compact Tool Renderer - Single-line tool call rendering
 *
 * Renders all assistant tool calls as a single line, truncated with "..." if too long.
 * Does NOT apply to the `edit` tool — code edits keep their full diff display.
 *
 * Affected tools: read, bash, write, grep, find, ls
 */

import type {
	BashToolDetails,
	ExtensionAPI,
	FindToolDetails,
	GrepToolDetails,
	LsToolDetails,
	ReadToolDetails,
} from "@earendil-works/pi-coding-agent";
import {
	createBashTool,
	createFindTool,
	createGrepTool,
	createLsTool,
	createReadTool,
	createWriteTool,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

const MAX_LINE_LENGTH = 120;

function truncate(str: string, maxLen: number = MAX_LINE_LENGTH): string {
	if (str.length <= maxLen) return str;
	return str.slice(0, maxLen - 3) + "...";
}

export default function (pi: ExtensionAPI) {
	const cwd = process.cwd();

	// --- Read ---
	const originalRead = createReadTool(cwd);
	pi.registerTool({
		name: "read",
		label: "read",
		description: originalRead.description,
		parameters: originalRead.parameters,
		renderShell: "self",
		async execute(toolCallId, params, signal, onUpdate) {
			return originalRead.execute(toolCallId, params, signal, onUpdate);
		},
		renderCall(args, theme, _context) {
			let text = theme.fg("toolTitle", theme.bold("read "));
			text += theme.fg("accent", truncate(args.path));
			const parts: string[] = [];
			if (args.offset) parts.push(`offset=${args.offset}`);
			if (args.limit) parts.push(`limit=${args.limit}`);
			if (parts.length > 0) {
				text += theme.fg("dim", ` (${parts.join(", ")})`);
			}
			return new Text(text, 0, 0);
		},
		renderResult(result, { isPartial }, theme, _context) {
			if (isPartial) return new Text(theme.fg("warning", "Reading..."), 0, 0);

			const content = result.content[0];
			if (content?.type === "image") {
				return new Text(theme.fg("success", "Image"), 0, 0);
			}
			if (content?.type !== "text" || result.isError) {
				return new Text(theme.fg("error", "Error"), 0, 0);
			}

			return new Text("", 0, 0);
		},
	});

	// --- Bash ---
	const originalBash = createBashTool(cwd);
	pi.registerTool({
		name: "bash",
		label: "bash",
		description: originalBash.description,
		parameters: originalBash.parameters,
		renderShell: "self",
		async execute(toolCallId, params, signal, onUpdate) {
			return originalBash.execute(toolCallId, params, signal, onUpdate);
		},
		renderCall(args, theme, _context) {
			let text = theme.fg("toolTitle", theme.bold("$ "));
			text += theme.fg("accent", truncate(args.command));
			if (args.timeout) {
				text += theme.fg("dim", ` (${args.timeout}s)`);
			}
			return new Text(text, 0, 0);
		},
		renderResult(result, { isPartial }, theme, _context) {
			if (isPartial) return new Text(theme.fg("warning", "Running..."), 0, 0);

			const content = result.content[0];
			const output = content?.type === "text" ? content.text : "";

			const exitMatch = output.match(/exit code: (\d+)/);
			const exitCode = exitMatch ? parseInt(exitMatch[1], 10) : null;
			if (exitCode !== 0 && exitCode !== null) {
				return new Text(theme.fg("error", `exit ${exitCode}`), 0, 0);
			}
			if (result.isError) {
				return new Text(theme.fg("error", "Error"), 0, 0);
			}
			return new Text("", 0, 0);
		},
	});

	// --- Write ---
	const originalWrite = createWriteTool(cwd);
	pi.registerTool({
		name: "write",
		label: "write",
		description: originalWrite.description,
		parameters: originalWrite.parameters,
		renderShell: "self",
		async execute(toolCallId, params, signal, onUpdate) {
			return originalWrite.execute(toolCallId, params, signal, onUpdate);
		},
		renderCall(args, theme, _context) {
			let text = theme.fg("toolTitle", theme.bold("write "));
			text += theme.fg("accent", truncate(args.path));
			const lineCount = args.content.split("\n").length;
			text += theme.fg("dim", ` (${lineCount} lines)`);
			return new Text(text, 0, 0);
		},
		renderResult(result, { isPartial }, theme, _context) {
			if (isPartial) return new Text(theme.fg("warning", "Writing..."), 0, 0);

			const content = result.content[0];
			if (content?.type === "text" && content.text.startsWith("Error")) {
				return new Text(
					theme.fg("error", truncate(content.text.split("\n")[0])),
					0,
					0,
				);
			}
			return new Text("", 0, 0);
		},
	});

	// --- Grep ---
	const originalGrep = createGrepTool(cwd);
	pi.registerTool({
		name: "grep",
		label: "grep",
		description: originalGrep.description,
		parameters: originalGrep.parameters,
		renderShell: "self",
		async execute(toolCallId, params, signal, onUpdate) {
			return originalGrep.execute(toolCallId, params, signal, onUpdate);
		},
		renderCall(args, theme, _context) {
			let text = theme.fg("toolTitle", theme.bold("grep "));
			text += theme.fg("accent", truncate(args.pattern));
			if (args.path) text += theme.fg("dim", ` in ${truncate(args.path)}`);
			return new Text(text, 0, 0);
		},
		renderResult(result, { isPartial }, theme, _context) {
			if (isPartial) return new Text(theme.fg("warning", "Searching..."), 0, 0);
			if (result.isError) return new Text(theme.fg("error", "Error"), 0, 0);
			return new Text("", 0, 0);
		},
	});

	// --- Find ---
	const originalFind = createFindTool(cwd);
	pi.registerTool({
		name: "find",
		label: "find",
		description: originalFind.description,
		parameters: originalFind.parameters,
		renderShell: "self",
		async execute(toolCallId, params, signal, onUpdate) {
			return originalFind.execute(toolCallId, params, signal, onUpdate);
		},
		renderCall(args, theme, _context) {
			let text = theme.fg("toolTitle", theme.bold("find "));
			text += theme.fg("accent", truncate(args.pattern));
			if (args.path) text += theme.fg("dim", ` in ${truncate(args.path)}`);
			return new Text(text, 0, 0);
		},
		renderResult(result, { isPartial }, theme, _context) {
			if (isPartial) return new Text(theme.fg("warning", "Finding..."), 0, 0);
			if (result.isError) return new Text(theme.fg("error", "Error"), 0, 0);
			return new Text("", 0, 0);
		},
	});

	// --- Ls ---
	const originalLs = createLsTool(cwd);
	pi.registerTool({
		name: "ls",
		label: "ls",
		description: originalLs.description,
		parameters: originalLs.parameters,
		renderShell: "self",
		async execute(toolCallId, params, signal, onUpdate) {
			return originalLs.execute(toolCallId, params, signal, onUpdate);
		},
		renderCall(args, theme, _context) {
			let text = theme.fg("toolTitle", theme.bold("ls "));
			text += theme.fg("accent", truncate(args.path || "."));
			return new Text(text, 0, 0);
		},
		renderResult(result, { isPartial }, theme, _context) {
			if (isPartial) return new Text(theme.fg("warning", "Listing..."), 0, 0);
			if (result.isError) return new Text(theme.fg("error", "Error"), 0, 0);
			return new Text("", 0, 0);
		},
	});
}
