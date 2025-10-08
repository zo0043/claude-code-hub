import packageJson from '../../package.json';

/**
 * 应用版本配置
 * 优先级: NEXT_PUBLIC_APP_VERSION > package.json version
 */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || `v${packageJson.version}`;

/**
 * GitHub 仓库信息
 * 用于获取最新版本
 */
export const GITHUB_REPO = {
  owner: 'zsio',
  repo: 'claude-code-hub',
};

/**
 * 比较两个语义化版本号
 * @param current 当前版本 (如 "v1.2.3")
 * @param latest 最新版本 (如 "v1.3.0")
 * @returns 1: latest > current, 0: 相等, -1: current > latest
 */
export function compareVersions(current: string, latest: string): number {
  // 移除 'v' 前缀
  const cleanCurrent = current.replace(/^v/, '');
  const cleanLatest = latest.replace(/^v/, '');

  const currentParts = cleanCurrent.split('.').map(Number);
  const latestParts = cleanLatest.split('.').map(Number);

  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const curr = currentParts[i] || 0;
    const lat = latestParts[i] || 0;

    if (lat > curr) return 1;
    if (lat < curr) return -1;
  }

  return 0;
}
