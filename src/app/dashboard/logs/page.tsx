import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Section } from "@/components/section";
import { UsageLogsView } from "./_components/usage-logs-view";
import { ConcurrentSessionsCard } from "@/components/customs/concurrent-sessions-card";
import { getUsers } from "@/actions/users";
import { getProviders } from "@/actions/providers";

export const dynamic = "force-dynamic";

export default async function UsageLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const isAdmin = session.user.role === "admin";

  // 只有 admin 才需要获取用户和供应商列表
  const [users, providers, resolvedSearchParams] = isAdmin
    ? await Promise.all([getUsers(), getProviders(), searchParams])
    : [[], [], await searchParams];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <ConcurrentSessionsCard />
      </div>

      <Section
        title="使用记录"
        description="查看 API 调用日志和使用统计"
      >
        <Suspense fallback={<div className="text-center py-8 text-muted-foreground">加载中...</div>}>
          <UsageLogsView
            isAdmin={isAdmin}
            users={users}
            providers={providers}
            searchParams={resolvedSearchParams}
          />
        </Suspense>
      </Section>
    </div>
  );
}
