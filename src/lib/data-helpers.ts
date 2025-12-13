import { Schema, TableData, TableDefinition } from '@/types/schema';

/**
 * Helpers pour garantir que les données sont toujours au bon format
 */

/**
 * S'assure que schema.tables est un array
 */
export function getTables(schema: Schema | null): TableDefinition[] {
  if (!schema) return [];
  return Array.isArray(schema.tables) ? schema.tables : [];
}

/**
 * S'assure que les données d'une table sont un array
 */
export function getTableData(data: TableData, tableName: string): any[] {
  const tableData = data[tableName];
  return Array.isArray(tableData) ? tableData : [];
}

/**
 * S'assure que les relations sont un array
 */
export function getRelations(schema: Schema | null) {
  if (!schema) return [];
  return Array.isArray(schema.relations) ? schema.relations : [];
}

/**
 * Trouve une table par nom
 */
export function findTable(schema: Schema | null, tableName: string): TableDefinition | undefined {
  const tables = getTables(schema);
  return tables.find((t) => t.name === tableName);
}

/**
 * Vérifie si des données existent pour une table
 */
export function hasTableData(data: TableData, tableName: string): boolean {
  const tableData = getTableData(data, tableName);
  return tableData.length > 0;
}

/**
 * Compte le nombre d'enregistrements dans une table
 */
export function countRecords(data: TableData, tableName: string): number {
  return getTableData(data, tableName).length;
}
