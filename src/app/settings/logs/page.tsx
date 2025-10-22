import { Section } from "@/components/section";
import { SettingsPageHeader } from "../_components/settings-page-header";
import { LogLevelForm } from "./_components/log-level-form";

export const dynamic = "force-dynamic";

export default async function SettingsLogsPage() {
  return (
    <>
      <SettingsPageHeader
        title="日志管理"
        description="动态调整系统日志级别，实时控制日志输出详细程度。"
      />

      <Section
        title="日志级别控制"
        description="调整后立即生效，无需重启服务。适合生产环境排查问题时使用。"
      >
        <LogLevelForm />
      </Section>
    </>
  );
}
