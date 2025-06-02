/**
 * Redirects all console output to stderr
 * This is useful when stdout needs to be kept clean for protocol communication
 */

// Store original console methods
const originalConsole = {
  log: console.log,
  info: console.info,
  debug: console.debug,
  warn: console.warn,
  error: console.error,
};

/**
 * Redirects console output to stderr
 */
export function redirectConsoleToStderr() {
  // Override console methods to use stderr
  console.log = (...args: any[]) => {
    process.stderr.write(
      `${args
        .map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
        .join(' ')}` + '\n'
    );
  };

  console.info = (...args: any[]) => {
    process.stderr.write(
      `[INFO] ${args
        .map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
        .join(' ')}` + '\n'
    );
  };

  console.debug = (...args: any[]) => {
    process.stderr.write(
      `[DEBUG] ${args
        .map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
        .join(' ')}` + '\n'
    );
  };

  // Keep warn and error as they already use stderr by default
  console.warn = (...args: any[]) => {
    process.stderr.write(
      `[WARN] ${args
        .map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
        .join(' ')}` + '\n'
    );
  };

  console.error = originalConsole.error; // Already uses stderr
}

/**
 * Restores the original console methods
 */
export function restoreConsole() {
  Object.assign(console, originalConsole);
}

// Auto-redirect when imported
redirectConsoleToStderr();
