import { Section } from "@/components/section";
import { LeaderboardView } from "./_components/leaderboard-view";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  return (
    <div className="space-y-6">
      <Section
        title="消耗排行榜"
        description="查看用户消耗排名，数据每 5 分钟更新一次"
      >
        <LeaderboardView />
      </Section>
    </div>
  );
}
