import { NextRequest, NextResponse } from "next/server";
import { fetchWtnDashboard, WtnRequestError } from "@/lib/wtn/graphql";
import { normalizeWtnResponse } from "@/lib/wtn/normalize-match";
import { exampleWtnResponse, isExampleTennisId } from "@/lib/wtn/example-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const tennisId = request.nextUrl.searchParams.get("tennisId")?.trim().toUpperCase();
  if (!tennisId || !/^[A-Z0-9-]{4,30}$/.test(tennisId)) {
    return NextResponse.json({ error: "Enter a valid Tennis ID." }, { status: 400 });
  }
  if (isExampleTennisId(tennisId)) {
    return NextResponse.json(exampleWtnResponse, { headers: { "cache-control": "no-store" } });
  }

  try {
    const payload = await fetchWtnDashboard(tennisId);
    const ratings = payload.ratings ?? [];
    if (!payload.player && !ratings.length) {
      return NextResponse.json({ error: "No WTN player was found for that Tennis ID." }, { status: 404 });
    }
    return NextResponse.json(normalizeWtnResponse(tennisId, payload.player, ratings), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof WtnRequestError ? error.message : "Unable to load WTN data right now.";
    console.error("WTN dashboard request failed", {
      tennisId,
      message,
      diagnostic: error instanceof WtnRequestError
        ? error.diagnostics
        : error instanceof Error ? error.message : "Unknown server error",
    });
    const body: { error: string; diagnostic?: string } = { error: message };
    if (process.env.NODE_ENV === "development") {
      body.diagnostic = error instanceof WtnRequestError
        ? error.diagnostics
        : error instanceof Error ? error.message : "Unknown server error";
    }
    return NextResponse.json(body, { status: 502 });
  }
}
