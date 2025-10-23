import { listSensitiveWords, getCacheStats } from "@/actions/sensitive-words";
import { Section } from "@/components/section";
import { SettingsPageHeader } from "../_components/settings-page-header";
import { WordListTable } from "./_components/word-list-table";
import { AddWordDialog } from "./_components/add-word-dialog";
import { RefreshCacheButton } from "./_components/refresh-cache-button";

export const dynamic = "force-dynamic";

export default async function SensitiveWordsPage() {
  const [words, cacheStats] = await Promise.all([listSensitiveWords(), getCacheStats()]);

  return (
    <>
      <SettingsPageHeader
        title="敏感词管理"
        description="配置敏感词过滤规则，拦截包含敏感内容的请求。"
      />

      <Section
        title="敏感词列表"
        description="被敏感词拦截的请求不会转发到上游，也不会计费。支持包含匹配、精确匹配和正则表达式三种模式。"
        actions={
          <div className="flex gap-2">
            <RefreshCacheButton stats={cacheStats} />
            <AddWordDialog />
          </div>
        }
      >
        <WordListTable words={words} />
      </Section>
    </>
  );
}
