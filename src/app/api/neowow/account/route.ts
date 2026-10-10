import { type NextRequest, NextResponse } from "next/server";
import { checkCliAccount, isLocalCliRequest } from "@/lib/neowowCli";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
	const headers = { "Cache-Control": "no-store" };
	if (
		!isLocalCliRequest(
			request.url,
			request.headers.get("origin"),
			request.headers.get("sec-fetch-site"),
		)
	) {
		return NextResponse.json(
			{ status: "unavailable" },
			{ status: 403, headers },
		);
	}
	return NextResponse.json(await checkCliAccount(), { headers });
}
