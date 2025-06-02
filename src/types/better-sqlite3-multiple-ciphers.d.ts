declare module 'better-sqlite3-multiple-ciphers' {
  interface DatabaseOptions {
    key?: string;
    [key: string]: any;
  }

  class Database {
    constructor(path: string, options?: DatabaseOptions);
    close(): void;
    prepare(sql: string): Statement;
    exec(sql: string): this;
    pragma(sql: string, options?: { simple?: boolean }): any;
    transaction<T extends any[]>(source: (...args: T) => void): (...args: T) => void;
  }

  class Statement {
    run(...params: any[]): any;
    get(...params: any[]): any;
    all(...params: any[]): any[];
  }

  export = Database;
}
