import { fetchPublicWtnDashboard } from "./graphql";
import { normalizeWtnResponse } from "./normalize-match";
import { exampleWtnResponse, isExampleTennisId } from "./example-data";
import type { WtnApiResponse } from "./types";

export async function requestPlayer(tennisId: string, signal?: AbortSignal): Promise<WtnApiResponse> {
  const normalizedId = tennisId.trim().toUpperCase();
  if (isExampleTennisId(normalizedId)) return exampleWtnResponse;
  const response = await fetch(`/api/wtn?tennisId=${encodeURIComponent(normalizedId)}`, { signal });
  const body = await response.json() as WtnApiResponse & { error?: string; diagnostic?: string };
  if (response.ok) return body;

  const serverError = Object.assign(new Error(body.error || "WTN request failed."), { diagnostic: body.diagnostic });
  if (response.status !== 502) throw serverError;

  try {
    const payload = await fetchPublicWtnDashboard(normalizedId, signal);
    const ratings = payload.ratings ?? [];
    if (!payload.player && !ratings.length) throw new Error("No WTN player was found for that Tennis ID.");
    return normalizeWtnResponse(normalizedId, payload.player, ratings);
  } catch (error) {
    if (signal?.aborted) throw error;
    throw serverError;
  }
}
