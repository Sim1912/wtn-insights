import { Dashboard } from "@/components/dashboard/Dashboard";
import { playerIdFromSearchParams } from "@/lib/wtn/player-id";

export default async function MatchesPage({ searchParams }: { searchParams: Promise<{ tennisId?: string }> }) {
  const params = await searchParams;
  return <Dashboard initialTab="matches" initialPlayerId={playerIdFromSearchParams(params.tennisId)} />;
}
