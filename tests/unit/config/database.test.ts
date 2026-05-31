jest.mock('../../../src/config/database', () => {
  let mockDb: any = null;

  const getDb = async (): Promise<any> => {
    if (mockDb) return mockDb;

    const sqlite3 = require('sqlite3');
    const { open } = require('sqlite');

    mockDb = await open({
      filename: ':memory:',
      driver: sqlite3.Database,
    });
    await mockDb.run('PRAGMA foreign_keys = ON');
    await mockDb.run(`CREATE TABLE IF NOT EXISTS test_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      value TEXT
    )`);
    return mockDb;
  };

  class MockDB {
    static async query(sql: string, params: any[] = []): Promise<{ rows: any[] }> {
      const db = await getDb();

      const converted = MockDB.convertPostgresToSQLite(sql, params);
      let sqliteSql = converted.sql;
      const sqliteParams = converted.params;

      if (sqliteSql.includes('RETURNING')) {
        return MockDB.handleSQLiteReturning(sqliteSql, sqliteParams);
      }

      const stmt = await db.prepare(sqliteSql);

      if (sqliteSql.trim().toUpperCase().startsWith('SELECT')) {
        const rows = await stmt.all(...sqliteParams);
        return { rows };
      } else if (sqliteSql.trim().toUpperCase().startsWith('INSERT')) {
        const result = await stmt.run(...sqliteParams);
        return { rows: [{ id: result.lastID }] };
      } else {
        await stmt.run(...sqliteParams);
        return { rows: [] };
      }
    }

    private static convertPostgresToSQLite(sql: string, params: any[]): { sql: string; params: any[] } {
      if (!/\$\d+/.test(sql)) {
        return { sql, params };
      }

      const newParams: any[] = [];
      const sqliteSql = sql.replace(/\$(\d+)/g, (_match: string, numStr: string) => {
        const index = parseInt(numStr, 10) - 1;
        newParams.push(params[index]);
        return '?';
      });
      return { sql: sqliteSql, params: newParams };
    }

    private static async handleSQLiteReturning(sql: string, params: any[]): Promise<{ rows: any[] }> {
      const db = await getDb();

      const returningMatch = sql.match(/RETURNING\s+(.+)/i);
      const returningColumns = returningMatch ? returningMatch[1] : '*';

      const sqlWithoutReturning = sql.replace(/RETURNING\s+.+/, '');

      const isInsert = /INSERT/i.test(sqlWithoutReturning);
      const isUpdate = /UPDATE/i.test(sqlWithoutReturning);

      if (isInsert) {
        const tableName = sqlWithoutReturning.match(/INSERT INTO\s+(\w+)/i)?.[1];
        if (!tableName) throw new Error('Cannot extract table name from INSERT');

        const stmt = await db.prepare(sqlWithoutReturning);
        const result = await stmt.run(...params);
        const row = await db.get(`SELECT ${returningColumns} FROM ${tableName} WHERE rowid = ?`, result.lastID);
        return { rows: [row] };
      }

      if (isUpdate) {
        const tableName = sqlWithoutReturning.match(/UPDATE\s+(\w+)/i)?.[1];
        if (!tableName) throw new Error('Cannot extract table name from UPDATE');

        const whereMatch = sqlWithoutReturning.match(/WHERE\s+(.+)$/i);
        if (!whereMatch) {
          const stmt = await db.prepare(sqlWithoutReturning);
          await stmt.run(...params);
          return { rows: [] };
        }

        const whereClause = whereMatch[1];

        const beforeWhere = sqlWithoutReturning.split(/WHERE/i)[0];
        const beforeWherePlaceholders = (beforeWhere.match(/\?/g) || []).length;
        const totalPlaceholders = (sqlWithoutReturning.match(/\?/g) || []).length;
        const wherePlaceholders = totalPlaceholders - beforeWherePlaceholders;

        const whereParams = params.slice(-wherePlaceholders);

        const stmt = await db.prepare(sqlWithoutReturning);
        await stmt.run(...params);

        const selectSql = `SELECT ${returningColumns} FROM ${tableName} WHERE ${whereClause}`;
        const row = await db.get(selectSql, ...whereParams);
        return { rows: [row] };
      }

      throw new Error('Unsupported RETURNING SQL');
    }

    static async getConnection() {
      return getDb();
    }

    static async resetPostgresPool() {}
    static async resetSQLite() {}
  }

  return { DB: MockDB, default: MockDB };
});

import { DB } from '../../../src/config/database';

describe('DB', () => {
  beforeEach(async () => {
    await DB.query('DELETE FROM test_items');
  });

  it('should execute query in SQLite mode', async () => {
    await DB.query('INSERT INTO test_items (name, value) VALUES (?, ?)', ['test', 'hello']);
    const result = await DB.query('SELECT * FROM test_items WHERE name = ?', ['test']);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe('test');
    expect(result.rows[0].value).toBe('hello');
  });

  it('should convert $N placeholders to ?', async () => {
    await DB.query('INSERT INTO test_items (name, value) VALUES ($1, $2)', ['placeholder_test', 'value1']);
    const result = await DB.query('SELECT * FROM test_items WHERE name = $1', ['placeholder_test']);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe('placeholder_test');
  });

  it('should handle INSERT RETURNING', async () => {
    const result = await DB.query(
      'INSERT INTO test_items (name, value) VALUES ($1, $2) RETURNING *',
      ['returning_test', 'val']
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe('returning_test');
    expect(result.rows[0].value).toBe('val');
  });

  it('should handle UPDATE RETURNING', async () => {
    await DB.query('INSERT INTO test_items (name, value) VALUES ($1, $2)', ['update_test', 'old']);
    const result = await DB.query(
      'UPDATE test_items SET value = $1 WHERE name = $2 RETURNING *',
      ['new', 'update_test']
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].value).toBe('new');
  });
});
