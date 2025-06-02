import chalk from 'chalk';

// Simple color map for basic chalk colors
const colors = {
  black: (text: string) => chalk.black(text),
  red: (text: string) => chalk.red(text),
  green: (text: string) => chalk.green(text),
  yellow: (text: string) => chalk.yellow(text),
  blue: (text: string) => chalk.blue(text),
  magenta: (text: string) => chalk.magenta(text),
  cyan: (text: string) => chalk.cyan(text),
  white: (text: string) => chalk.white(text),
  gray: (text: string) => chalk.gray(text),
  grey: (text: string) => chalk.grey(text),
} as const;

type Color = keyof typeof colors;

/**
 * Creates a simple section header with chalk
 * @param title Section title
 * @param emoji Optional emoji to prepend to the title
 * @param color Text color (default: 'blue')
 * @returns Formatted section header
 */
export function createSection({
  title,
  emoji = '',
  color = 'blue',
}: {
  title: string;
  emoji?: string;
  color?: Color;
}): string {
  const emojiPrefix = emoji ? `${emoji}  ` : '';
  const content = `${emojiPrefix}${title}`.trim();

  // Apply chalk styles
  const colorFn = colors[color] || colors.blue;
  const coloredContent = colorFn(content);

  return `\n${chalk.bold(coloredContent)}\n${'─'.repeat(content.length)}`;
}

/**
 * Logs a success message
 * @param message Message to display
 */
export function logSuccess(message: string): void {
  console.log(chalk.green(`✓ ${message}`));
}

/**
 * Logs an info message
 * @param message Message to display
 */
export function logInfo(message: string): void {
  console.log(chalk.blue(`ℹ ${message}`));
}

/**
 * Logs a warning message
 * @param message Message to display
 */
export function logWarning(message: string): void {
  console.log(chalk.yellow(`⚠ ${message}`));
}

/**
 * Logs an error message
 * @param message Message to display
 */
export function logError(message: string): void {
  console.error(chalk.red(`✗ ${message}`));
}
