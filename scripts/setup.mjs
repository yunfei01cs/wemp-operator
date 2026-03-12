#!/usr/bin/env node
/**
 * 环境检查和配置脚本
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __scriptDir = dirname(__filename);
const SKILL_ROOT = join(__scriptDir, '..');

const colors = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

function success(msg) { console.log(`${colors.green('✓')} ${msg}`); }
function error(msg) { console.log(`${colors.red('✗')} ${msg}`); }
function warn(msg) { console.log(`${colors.yellow('!')} ${msg}`); }
function info(msg) { console.log(`${colors.cyan('→')} ${msg}`); }

function saveConfig(appId, appSecret) {
  const skillConfigPath = join(SKILL_ROOT, 'config.json');
  const config = { appId, appSecret };
  writeFileSync(skillConfigPath, JSON.stringify(config, null, 2));
  success(`配置已保存到: ${skillConfigPath}`);
}

function checkWempConfig() {
  // 1. 优先从 openclaw.json 的 skills.entries 读取
  const configPath = join(homedir(), '.openclaw', 'openclaw.json');
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      const wempEntry = config?.skills?.entries?.wemp_operator?.env || config?.skills?.entries?.['wemp-operator']?.env;
      if (wempEntry?.WEMP_APP_ID && wempEntry?.WEMP_APP_SECRET) {
        return { found: true, path: 'openclaw.json (skills.entries.wemp-operator.env)' };
      }
    } catch {}
  }
  
  // 2. 其次从技能目录下 config.json 读取
  const skillConfigPath = join(SKILL_ROOT, 'config.json');
  if (existsSync(skillConfigPath)) {
    try {
      const config = JSON.parse(readFileSync(skillConfigPath, 'utf-8'));
      if (config?.appId && config?.appSecret) {
        return { found: true, path: skillConfigPath };
      }
    } catch {}
  }
  
  return { found: false };
}

async function testApi() {
  try {
    const { getUserSummary, getYesterday } = await import('./lib/utils.mjs');
    await getUserSummary(getYesterday());
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function main() {
  
  // 处理 --set 参数
  const args = process.argv.slice(2);
  const setIdx = args.indexOf('--set');
  if (setIdx !== -1) {
    let appId, appSecret;
    for (let i = setIdx + 1; i < args.length; i++) {
      if (args[i].startsWith('appId=')) appId = args[i].split('=')[1];
      if (args[i].startsWith('appSecret=')) appSecret = args[i].split('=')[1];
    }
    if (!appId) appId = args[setIdx + 1];
    if (!appSecret) appSecret = args[setIdx + 2];
    if (appId && appSecret) {
      saveConfig(appId, appSecret);
      process.exit(0);
    }
  }

  const showHelp = args.includes('--help') || process.argv.includes('-h');
  
  console.log(colors.bold('\n🔍 wemp-operator 环境检查\n'));
  console.log('─'.repeat(50));
  
  let allPassed = true;
  
  // 检查 wemp 配置
  console.log(colors.bold('\n📱 微信公众号配置'));
  const wempCheck = checkWempConfig();
  if (wempCheck.found) {
    success(`配置文件: ${wempCheck.path}`);
  } else {
    error('未找到公众号配置');
    allPassed = false;
  }
  
  // 测试 API
  if (wempCheck.found) {
    console.log(colors.bold('\n🔗 API 连接测试'));
    const apiTest = await testApi();
    if (apiTest.success) {
      success('API 连接正常');
    } else {
      error('API 连接失败');
      info(apiTest.error?.substring(0, 100));
      allPassed = false;
    }
  }
  
  // 总结
  console.log('\n' + '─'.repeat(50));
  if (allPassed) {
    console.log(colors.green(colors.bold('\n✅ 环境检查通过！\n')));
  } else {
    console.log(colors.yellow(colors.bold('\n⚠️  需要配置公众号信息\n')));
  }
  
  if (showHelp || !allPassed) {
    console.log(`
${colors.bold('配置指南')}

请在 openclaw.json 中配置（推荐方式）：

文件位置: ${colors.cyan('~/.openclaw/openclaw.json')}

在 skills.entries 下添加:
{
  "skills": {
    "entries": {
      "wemp-operator": {
        "env": {
          "WEMP_APP_ID": "你的公众号 AppID",
          "WEMP_APP_SECRET": "你的公众号 AppSecret"
        }
      }
    }
  }
}

获取 AppID/AppSecret：
1. 登录微信公众平台 https://mp.weixin.qq.com
2. 开发 → 基本配置 → 开发者ID
`);
  }
  
  return allPassed ? 0 : 1;
}

main().then(code => process.exit(code));
