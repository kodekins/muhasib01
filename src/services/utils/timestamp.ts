/**
 * Timestamp Utility
 * Handles updated_at timestamp management for all entities
 */

/**
 * Adds updated_at timestamp to update data
 */
export function withTimestamp<T extends Record<string, any>>(data: T): T & { updated_at: string } {
  return {
    ...data,
    updated_at: new Date().toISOString()
  };
}

/**
 * Adds created_at and updated_at timestamps for new records
 */
export function withTimestamps<T extends Record<string, any>>(data: T): T & { 
  created_at: string;
  updated_at: string;
} {
  const now = new Date().toISOString();
  return {
    ...data,
    created_at: now,
    updated_at: now
  };
}

/**
 * Strips timestamp fields from data (useful for comparisons)
 */
export function withoutTimestamps<T extends Record<string, any>>(data: T): Omit<T, 'created_at' | 'updated_at'> {
  const { created_at, updated_at, ...rest } = data;
  return rest;
}

