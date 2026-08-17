import type { RawWtnPayload } from "./types";

export const DEFAULT_ENDPOINT = "https://prd-itf-kube.clubspark.pro/graphql";

export const WTN_QUERY = `query WtnDashboard($tennisId: ID!, $personId: PersonIDInput!, $start: String, $end: String) {
  player: person(id: $personId) {
    id
    tennisID
    standardGivenName
    standardFamilyName
    nativeGivenName
    nativeFamilyName
    nationalityCode
  }
  ratings: wtnPast(tennisID: $tennisId, startDate: $start, endDate: $end) {
    ratingDate
    tennisNumber
    prevTennisNumber
    type
    confidence
    gameZoneLower
    gameZoneUpper
    matchUps {
      id
      providerMatchId
      start
      end
      type
      status
      statusCodes
      winningSide
      matchUpFormat
      ageCategoryCode
      surfaceCategory
      surfaceType
      indoorOutdoor
      roundName
      roundNumber
      drawName
      score {
        scoreString
        sets {
          winnerGamesWon
          loserGamesWon
          tiebreaker {
            winnerPointsWon
            loserPointsWon
          }
        }
        superTiebreak {
          winnerPointsWon
          loserPointsWon
        }
      }
      sides {
        sideNumber
        players {
          playerNumber
          person {
            id
            tennisID
            standardGivenName
            standardFamilyName
            nativeGivenName
            nativeFamilyName
          }
        }
      }
      worldTennisNumbers {
        personId
        tennisNumber
        type
        ratingDate
        confidence
      }
      tournament {
        id
        name
        formalName
        promotionalName
        surfaceCategory
        indoorOutdoor
      }
    }
  }
}`;

type GraphqlResponse = {
  data?: RawWtnPayload;
  errors?: Array<{ message?: string; path?: Array<string | number>; extensions?: { code?: string } }>;
};

export class WtnRequestError extends Error {
  diagnostics: string;

  constructor(message: string, diagnostics: string) {
    super(message);
    this.name = "WtnRequestError";
    this.diagnostics = diagnostics;
  }
}

async function fetchWtnDashboardFromEndpoint(
  tennisId: string,
  endpoint: string,
  externalSignal?: AbortSignal,
): Promise<RawWtnPayload> {
  const end = new Date();
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 3);

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  externalSignal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        query: WTN_QUERY,
        variables: {
          tennisId,
          personId: { identifier: tennisId, type: "TennisID" },
          start: start.toISOString().slice(0, 10),
          end: end.toISOString().slice(0, 10),
        },
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new WtnRequestError(
        "WTN is temporarily unavailable. Please try again.",
        `WTN GraphQL returned HTTP ${response.status}: ${responseText.slice(0, 500)}`,
      );
    }

    let payload: GraphqlResponse;
    try {
      payload = JSON.parse(responseText) as GraphqlResponse;
    } catch {
      throw new WtnRequestError(
        "WTN returned an unexpected response. Please try again.",
        `WTN GraphQL response was not JSON: ${responseText.slice(0, 500)}`,
      );
    }

    if (payload.errors?.length) {
      const diagnostics = payload.errors
        .map((error) => `${error.extensions?.code ?? "GRAPHQL_ERROR"}: ${error.message ?? "Unknown GraphQL error"}`)
        .join("; ");
      throw new WtnRequestError("WTN could not load this player right now.", diagnostics);
    }
    if (!payload.data) {
      throw new WtnRequestError("WTN returned no player data.", "GraphQL response contained no data object.");
    }
    return payload.data;
  } catch (error) {
    if (externalSignal?.aborted) throw error;
    if (error instanceof WtnRequestError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new WtnRequestError("WTN took too long to respond. Please try again.", "WTN request exceeded the 12 second timeout.");
    }
    throw new WtnRequestError(
      "Unable to connect to WTN. Please try again.",
      error instanceof Error ? error.message : "Unknown network error",
    );
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abortFromCaller);
  }
}

export async function fetchPublicWtnDashboard(tennisId: string, signal?: AbortSignal): Promise<RawWtnPayload> {
  return fetchWtnDashboardFromEndpoint(tennisId, DEFAULT_ENDPOINT, signal);
}

export async function fetchWtnDashboard(tennisId: string): Promise<RawWtnPayload> {
  return fetchWtnDashboardFromEndpoint(tennisId, process.env.WTN_GRAPHQL_ENDPOINT || DEFAULT_ENDPOINT);
}
