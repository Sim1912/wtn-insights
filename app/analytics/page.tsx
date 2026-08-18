import { AnalyticsPage } from "@/components/analytics/AnalyticsPage";
import { playerIdFromSearchParams } from "@/lib/wtn/player-id";

export default async function Page({ searchParams }: { searchParams: Promise<{ tennisId?: string }> }) {
  const params = await searchParams;
  return <AnalyticsPage initialPlayerId={playerIdFromSearchParams(params.tennisId)} />;
}
