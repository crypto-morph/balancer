/**
 * Database and project path configuration utilities.
 * Provides single point of truth for path resolution across API routes.
 */

import path from 'path'

/**
 * Get the project root directory (parent of web/ directory).
 */
export function getProjectRoot(): string {
  return path.resolve(process.cwd(), '..')
}

/**
 * Get the database file path.
 * Uses DB_PATH environment variable if set, otherwise defaults to balancer.db in project root.
 */
export function getDbPath(): string {
  const projectRoot = getProjectRoot()
  return process.env.DB_PATH || path.join(projectRoot, 'balancer.db')
}

/**
 * Get the cache directory path.
 */
export function getCacheDir(): string {
  return path.join(getProjectRoot(), '.cache')
}

