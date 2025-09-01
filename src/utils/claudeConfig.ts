import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import which from 'which';

type ClaudeConfig = {
  mcpServers?: {
    [key: string]: {
      command: string;
      args: string[];
      env?: Record<string, string>;
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
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      // File doesn't exist, create a new config
      const newConfig = { mcpServers: {} };
      await writeFile(configPath, JSON.stringify(newConfig, null, 2));
      return newConfig;
    } else if (error instanceof SyntaxError) {
      // File exists but has invalid JSON - don't modify it, just report the error
      throw new Error(
        `Configuration file at ${configPath} contains invalid JSON. Please fix or remove the file.`
      );
    }
    // For other errors, rethrow
    throw error;
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

    const serverConfig: any = {
      command: tsxPath,
      args: [mcpServerPath],
    };

    // Add DATABASE_URL if it exists
    if (process.env.DATABASE_URL) {
      serverConfig.env = {
        DATABASE_URL: process.env.DATABASE_URL,
      };
    }

    config.mcpServers[serverName] = serverConfig;

    await writeFile(configPath, JSON.stringify(config, null, 2));
    return {
      success: true,
      message:
        '✅ Updated Claude desktop config with asher-financial-aggregator integration.\n  You can now use Asher as a tool in Claude desktop.',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
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

    const { configPath } = getConfigPath();
    let message = `⚠️ Could not configure Claude desktop integration:\n${errorMessage}`;
    message += `\n\nYou can manually configure Claude desktop by adding the following to ${configPath}:\n${manualConfig}`;

    return {
      success: false,
      message,
    };
  }
}
