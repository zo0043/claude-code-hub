import { getProviders, getProvidersHealthStatus } from "@/actions/providers";
import { Section } from "@/components/section";
import { ProviderManager } from "./_components/provider-manager";
import { AddProviderDialog } from "./_components/add-provider-dialog";
import { SettingsPageHeader } from "../_components/settings-page-header";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsProvidersPage() {
  const [providers, session, healthStatus] = await Promise.all([
    getProviders(),
    getSession(),
    getProvidersHealthStatus(),
  ]);

  return (
    <>
      <SettingsPageHeader
        title="供应商管理"
        description="配置 API 服务商并维护可用状态。"
      />

      <Section
        title="服务商管理"
        description="配置上游服务商的金额限流和并发限制，留空表示无限制。"
        actions={<AddProviderDialog />}
      >
        <ProviderManager
          providers={providers}
          currentUser={session?.user}
          healthStatus={healthStatus}
        />
      </Section>
    </>
  );
}