import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import which from 'which';

type ClaudeConfig = {
  mcpServers?: {
    [key: string]: {
      command: string;
      args: string[];
    };
  };
};

export async function ensureConfigFileExists(configPath: string): Promise<ClaudeConfig> {
  try {
    const raw = await readFile(configPath, 'utf-8');
    const config = JSON.parse(raw);
    // Ensure the config has the right structure
    if (!config.mcpServers) {
      config.mcpServers = {};
    }
    return config;
  } catch (_e) {
    // If file doesn't exist or is invalid, create a new config
    return { mcpServers: {} };
  }
}

function getConfigPath(): { configDir: string; configPath: string } {
  const isWindows = process.platform === 'win32';

  if (isWindows) {
    const appData = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming');
    const configDir = join(appData, 'Claude');
    const configPath = join(configDir, 'claude_desktop_config.json');
    return { configDir, configPath };
  } else {
    const configDir = join(homedir(), 'Library/Application Support/Claude');
    const configPath = join(configDir, 'claude_desktop_config.json');
    return { configDir, configPath };
  }
}

export async function configureClaudeIntegration(
  projectPath: string
): Promise<{ success: boolean; message: string }> {
  const { configDir, configPath } = getConfigPath();
  console.log(`Configuring Claude desktop integration at: ${configPath}`);

  try {
    // Ensure the config directory exists
    const { mkdir } = await import('fs/promises');
    await mkdir(configDir, { recursive: true });

    // Ensure the config file exists and is valid
    const config = await ensureConfigFileExists(configPath);

    // Add or update the server configuration
    const serverName = 'asher-financial-aggregator';
    config.mcpServers = config.mcpServers || {};

    // Always update to ensure we have the latest configuration
    const tsxPath = which.sync('tsx', {
      path: process.env.PATH?.split(':')
        .filter(p => !p.includes('node_modules/.bin'))
        .join(':'),
    });
    const mcpServerPath = join(projectPath, 'src', 'mcp', 'Server.ts');

    console.log('Global tsx path:', tsxPath);

    config.mcpServers[serverName] = {
      command: tsxPath,
      args: [mcpServerPath],
    };

    await writeFile(configPath, JSON.stringify(config, null, 2));
    return {
      success: true,
      message:
        '✅ Updated Claude desktop config with asher-financial-aggregator integration.\n  You can now use Asher as a tool in Claude desktop.',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const manualConfig = JSON.stringify(
      {
        mcpServers: {
          'asher-financial-aggregator': {
            command: 'tsx',
            args: [projectPath + '/src/mcp/Server.ts'],
          },
        },
      },
      null,
      2
    );

    return {
      success: false,
      message: `⚠️ Could not configure Claude desktop integration:\n${errorMessage}\n\nYou can manually configure Claude desktop by adding the following to your ~/.config/claude/claude_desktop_config.json:\n${manualConfig}`,
    };
  }
}
