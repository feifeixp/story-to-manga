// NeoWoW web-session contract, based on platform runtime 0.5.0.
// A web session is NEVER a neowow-cli API Key.
import { useEffect, useState } from "react";
export const PLATFORM = "https://app.neowow.studio";
interface WebSession {
	authorization: string;
	userId?: string;
	nickname?: string;
	email?: string;
	contact?: string;
}
function session(): WebSession | null {
	try {
		const value: unknown = JSON.parse(
			localStorage.getItem("neoStudioSession") || "null",
		);
		if (
			value &&
			typeof value === "object" &&
			"authorization" in value &&
			typeof value.authorization === "string"
		)
			return value as WebSession;
	} catch {
		/* Missing or inaccessible storage means signed out. */
	}
	return null;
}
export function webToken(): string {
	const stored = session()?.authorization;
	if (stored) return stored;
	const cookie = document.cookie.match(/(?:^|;\s*)neoToken=([^;]+)/)?.[1];
	try {
		return cookie ? decodeURIComponent(cookie) : "";
	} catch {
		return "";
	}
}
export function assertWebToken(token: string) {
	if (requireWebToken() !== token)
		throw new Error("NeoWoW 账户已切换，请在当前账户下重新操作。");
}
export function requireWebToken(): string {
	const token = webToken();
	if (!token)
		throw new Error(
			"请先点击右上角账户，登录 NeoWoW 后再生成。 / Sign in to NeoWoW first.",
		);
	return token;
}
export function login() {
	window.location.assign(
		`${PLATFORM}/api/oauth/start?return=${encodeURIComponent(window.location.href)}`,
	);
}
export function logout() {
	localStorage.removeItem("neoStudioSession");
	// biome-ignore lint/suspicious/noDocumentCookie: Required by NeoWoW cross-subdomain web sessions, including Safari.
	document.cookie =
		"neoToken=; Domain=.neowow.studio; Path=/; Max-Age=0; SameSite=Lax; Secure";
	window.dispatchEvent(new Event("neoSessionUpdated"));
}
export function pickUpWebSession() {
	const encoded = window.location.hash.match(/[#&]neo_session=([^&]+)/)?.[1];
	if (!encoded) return;
	try {
		let b64 = decodeURIComponent(encoded).replace(/-/g, "+").replace(/_/g, "/");
		b64 += "=".repeat((4 - (b64.length % 4)) % 4);
		const value: unknown = JSON.parse(
			new TextDecoder().decode(
				Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)),
			),
		);
		if (
			!value ||
			typeof value !== "object" ||
			!("authorization" in value) ||
			typeof value.authorization !== "string"
		)
			return;
		localStorage.setItem("neoStudioSession", JSON.stringify(value));
		// biome-ignore lint/suspicious/noDocumentCookie: Matches the platform OAuth handoff contract.
		document.cookie = `neoToken=${encodeURIComponent(value.authorization)}; Domain=.neowow.studio; Path=/; Max-Age=604800; SameSite=Lax; Secure`;
		window.dispatchEvent(new Event("neoSessionUpdated"));
	} catch {
		// Reject malformed handoff data without blocking the application.
	} finally {
		// Never leave the credential in bookmarks or exported links.
		history.replaceState(
			{},
			"",
			window.location.pathname + window.location.search,
		);
	}
}
export function readUser() {
	const s = session();
	return webToken()
		? {
				id: s?.userId || "neowow-user",
				name: s?.nickname || s?.email || "NeoWoW 用户",
			}
		: null;
}
export function useAuth() {
	const [user, setUser] = useState(readUser);
	useEffect(() => {
		const refresh = () => setUser(readUser());
		window.addEventListener("storage", refresh);
		window.addEventListener("neoSessionUpdated", refresh);
		window.addEventListener("focus", refresh);
		return () => {
			window.removeEventListener("storage", refresh);
			window.removeEventListener("neoSessionUpdated", refresh);
			window.removeEventListener("focus", refresh);
		};
	}, []);
	return { user, token: webToken() };
}
