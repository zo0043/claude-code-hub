/**
 * Next.js Instrumentation Hook
 * 在服务器启动时自动执行数据库迁移
 */

export async function register() {
  // 仅在服务器端执行
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // 仅在生产环境自动迁移
    // 开发环境建议手动运行 pnpm run db:migrate
    if (process.env.NODE_ENV === "production" && process.env.AUTO_MIGRATE !== "false") {
      const { checkDatabaseConnection, runMigrations } = await import("@/lib/migrate");

      logger.info('🚀 Initializing Claude Code Hub...');

      // 等待数据库连接
      const isConnected = await checkDatabaseConnection();
      if (!isConnected) {
        logger.error('❌ Cannot start application without database connection');
        process.exit(1);
      }

      // 执行迁移
      await runMigrations();

      logger.info('✨ Application ready!');
      logger.info('================================\n');
    }
  }
}
