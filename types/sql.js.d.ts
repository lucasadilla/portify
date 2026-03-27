declare module "sql.js" {
  export interface Database {
    exec(sql: string): { columns: string[]; values: unknown[][] }[];
    run(sql: string, params?: unknown[]): void;
    close(): void;
  }
  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => Database;
  }
  function initSqlJs(config?: { wasmBinary?: Buffer | Uint8Array }): Promise<SqlJsStatic>;
  export default initSqlJs;
}
