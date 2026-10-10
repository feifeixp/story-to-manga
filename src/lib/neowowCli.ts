import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export type CliStatus = {
	status: "connected" | "not-installed" | "not-linked" | "unavailable";
	nickname?: string;
};

// Hosted servers must never expose their operator's local CLI account.
export function isLocalCliRequest(
	url: string,
	origin: string | null,
	site: string | null,
) {
	try {
		const target = new URL(url);
		return (
			["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) &&
			(!origin || origin === target.origin) &&
			(!site || site === "same-origin" || site === "none")
		);
	} catch {
		return false;
	}
}

export function parseCliProfile(stdout: string): CliStatus {
	try {
		const profile = JSON.parse(stdout);
		if (!profile || typeof profile !== "object" || !profile.userId)
			return { status: "unavailable" };
		return {
			status: "connected",
			nickname:
				typeof profile.nickname === "string"
					? profile.nickname.slice(0, 80)
					: "NeoWoW",
		};
	} catch {
		return { status: "unavailable" };
	}
}

type Runner = (binary: string) => Promise<string>;
const runWhoami: Runner = (binary) =>
	new Promise((resolve, reject) => {
		execFile(
			binary.endsWith(".mjs") ? process.execPath : binary,
			binary.endsWith(".mjs") ? [binary, "whoami"] : ["whoami"],
			{
				timeout: 12000,
				maxBuffer: 64 * 1024,
				env: { ...process.env, NEOWOW_DEBUG: "", NEOWOW_NO_UPDATE_CHECK: "1" },
			},
			(error, stdout) => (error ? reject(error) : resolve(stdout)),
		);
	});

export async function checkCliAccount(
	run: Runner = runWhoami,
): Promise<CliStatus> {
	let binary = "neowow";
	const candidates =
		process.platform === "win32"
			? [".claude", ".agents"].map((folder) =>
					join(
						homedir(),
						folder,
						"skills",
						"neowow-canvas",
						"bin",
						"neowow.mjs",
					),
				)
			: [join(homedir(), ".neowow", "bin", "neowow")];
	for (const installed of candidates) {
		try {
			await access(installed);
			binary = installed;
			break;
		} catch {
			/* Try the next official location, then PATH. */
		}
	}
	try {
		return parseCliProfile(await run(binary));
	} catch (error) {
		// Never expose raw CLI output, credentials or full profile details.
		const failure = error as { code?: string | number };
		if (failure.code === "ENOENT") return { status: "not-installed" };
		if (failure.code === 3) return { status: "not-linked" };
		return { status: "unavailable" };
	}
}
