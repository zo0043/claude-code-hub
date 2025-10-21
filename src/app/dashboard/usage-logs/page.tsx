import { Section } from "@/components/section";
import { UsageLogsTable } from "./_components/usage-logs-table";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function UsageLogsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?from=/dashboard/usage-logs");
  }

  return (
    <div className="space-y-6">
      <Section
        title="使用记录"
        description="查看详细的 API 调用日志，包括费用、Token 使用、上游决策链等信息"
      >
        <UsageLogsTable />
      </Section>
    </div>
  );
}
