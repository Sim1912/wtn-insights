import { fetchPublicWtnDashboard } from "./graphql";
import { normalizeWtnResponse } from "./normalize-match";
import { exampleWtnResponse, isExampleTennisId } from "./example-data";
import { normalizeTennisId } from "./player-id";
import type { WtnApiResponse } from "./types";

export async function requestPlayer(tennisId: string, signal?: AbortSignal): Promise<WtnApiResponse> {
  const normalizedId = normalizeTennisId(tennisId);
  if (!normalizedId) throw new Error("Enter a valid Tennis ID.");
  if (isExampleTennisId(normalizedId)) return exampleWtnResponse;
  let response: Response;
  try {
    response = await fetch(`/api/wtn?tennisId=${encodeURIComponent(normalizedId)}`, { signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error("WTN data could not be reached. Check the connection and try again.");
  }
  let body: WtnApiResponse & { error?: string; diagnostic?: string };
  try {
    body = await response.json() as WtnApiResponse & { error?: string; diagnostic?: string };
  } catch {
    throw new Error("WTN returned an unreadable response. Try again shortly.");
  }
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
