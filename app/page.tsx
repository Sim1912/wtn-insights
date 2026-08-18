import { Dashboard } from "@/components/dashboard/Dashboard";
import { playerIdFromSearchParams } from "@/lib/wtn/player-id";

export default async function Home({ searchParams }: { searchParams: Promise<{ tennisId?: string }> }) {
  const params = await searchParams;
  return <Dashboard initialTab="overview" initialPlayerId={playerIdFromSearchParams(params.tennisId)} />;
}
