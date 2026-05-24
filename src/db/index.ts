/**
 * sql.js Database initialization and connection management
 */

import initSqlJs from 'sql.js'
import type { Database } from 'sql.js'
import { CREATE_TASKS_TABLE, CREATE_TAGS_TABLE, CREATE_SYNC_LOG_TABLE } from './schema'
import { readFileSync } from 'fs'
import { resolve } from 'path'

let db: Database | null = null
let dbPromise: Promise<Database> | null = null

export interface DbConfig {
  location?: string // localStorage key for persistence
}

/**
 * Initialize sql.js and open/create the database
 */
export async function initDatabase(config: DbConfig = {}): Promise<Database> {
  if (db) return db

  if (!dbPromise) {
    dbPromise = (async () => {
      // In test environment (JSDOM), pass wasmBinary directly to avoid network access
      // In browser, let sql.js load from CDN via locateFile
      const initOptions: Parameters<typeof initSqlJs>[0] = {}
      if (process.env.NODE_ENV === 'test') {
        // Node.js / JSDOM: use local wasm file
        const wasmPath = resolve(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm')
        initOptions.wasmBinary = readFileSync(wasmPath)
      } else {
        initOptions.locateFile = (file: string) => `https://sql.js.org/dist/${file}`
      }

      const SQL = await initSqlJs(initOptions)

      const savedData = localStorage.getItem(config.location || 'todolist-sqlite-db')
      if (savedData) {
        const data = Uint8Array.from(atob(savedData), c => c.charCodeAt(0))
        db = new SQL.Database(data)
      } else {
        db = new SQL.Database()
      }

      db.run(CREATE_TASKS_TABLE)
      db.run(CREATE_TAGS_TABLE)
      db.run(CREATE_SYNC_LOG_TABLE)

      return db
    })()
  }

  return dbPromise
}

/**
 * Get the database instance (must call initDatabase first)
 */
export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

/**
 * Check if database is initialized
 */
export function isDbInitialized(): boolean {
  return db !== null
}

/**
 * Save database to localStorage for persistence
 */
export function persistDatabase(location?: string): void {
  if (!db) return
  const data = db.export()
  const base64 = btoa(String.fromCharCode(...data))
  localStorage.setItem(location || 'todolist-sqlite-db', base64)
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    persistDatabase()
    db.close()
    db = null
    dbPromise = null
  }
}

/**
 * Run a query (graceful no-op when DB not initialized)
 */
export function runQuery(sql: string, params: unknown[] = []): void {
  if (!db) return
  db.run(sql, params as (string | number | null | Uint8Array)[])
}

/**
 * Execute a SQL query and return all results
 */
export function execQuery<T>(sql: string, params: unknown[] = []): T[] {
  if (!db) return []
  const stmt = db.prepare(sql)
  stmt.bind(params as (string | number | null | Uint8Array)[])
  const results: T[] = []
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T)
  }
  stmt.free()
  return results
}

/**
 * Get a single row
 */
export function getOne<T>(sql: string, params: unknown[] = []): T | undefined {
  const results = execQuery<T>(sql, params)
  return results[0]
}

/**
 * Log an operation to the sync_log table
 */
export function logSync(op: string, entity: string, entityId: string): void {
  const ts = new Date().toISOString()
  runQuery(
    'INSERT INTO sync_log (op, entity, entity_id, ts) VALUES (?, ?, ?, ?)',
    [op, entity, entityId, ts]
  )
}