import type { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '@/lib/storage';
import { Schema, TableDefinition, FieldDefinition, TableData, RelationDefinition } from '@/types/schema';

/**
 * API endpoint pour exporter les données au format SQL
 * Génère un fichier SQL complet avec:
 * - CREATE TABLE statements en haut
 * - INSERT statements pour les données en bas
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const state = await storage.loadState();
    const { schema, data } = state;

    // Générer le SQL complet
    const sql = generateFullSQL(schema, data);

    // Envoyer la réponse
    res.setHeader('Content-Type', 'application/sql');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=data-explore-export-${Date.now()}.sql`
    );
    res.status(200).send(sql);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erreur lors de l\'export SQL' });
  }
}

/**
 * Génère le SQL complet avec CREATE TABLE et INSERT
 */
function generateFullSQL(schema: Schema, data: TableData): string {
  const lines: string[] = [];

  // En-tête
  lines.push('-- ============================================================================');
  lines.push('-- Data Explore - Export SQL');
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push(`-- Schema Version: ${schema.version}`);
  lines.push('-- ============================================================================');
  lines.push('');
  lines.push('-- Configuration');
  lines.push('SET NAMES utf8mb4;');
  lines.push('SET FOREIGN_KEY_CHECKS = 0;');
  lines.push('');

  // Trier les tables pour respecter les dépendances (tables référencées en premier)
  const sortedTables = sortTablesByDependencies(schema.tables, schema.relations);

  // Section CREATE TABLE
  lines.push('-- ============================================================================');
  lines.push('-- STRUCTURE DES TABLES');
  lines.push('-- ============================================================================');
  lines.push('');

  for (const table of sortedTables) {
    lines.push(generateCreateTable(table, schema.relations));
    lines.push('');
  }

  // Section INSERT
  lines.push('-- ============================================================================');
  lines.push('-- DONNEES');
  lines.push('-- ============================================================================');
  lines.push('');

  for (const table of sortedTables) {
    const tableData = data[table.name];
    if (tableData && tableData.length > 0) {
      lines.push(`-- Table: ${table.name}`);
      lines.push(generateInsertStatements(table, tableData));
      lines.push('');
    }
  }

  // Réactiver les contraintes
  lines.push('-- ============================================================================');
  lines.push('-- FIN DE L\'EXPORT');
  lines.push('-- ============================================================================');
  lines.push('SET FOREIGN_KEY_CHECKS = 1;');
  lines.push('');

  return lines.join('\n');
}

/**
 * Trie les tables pour que les tables référencées soient créées en premier
 */
function sortTablesByDependencies(tables: TableDefinition[], relations: RelationDefinition[]): TableDefinition[] {
  const tableMap = new Map(tables.map(t => [t.name, t]));
  const dependencies = new Map<string, Set<string>>();

  // Initialiser les dépendances
  for (const table of tables) {
    dependencies.set(table.name, new Set());
  }

  // Ajouter les dépendances basées sur les relations
  for (const relation of relations) {
    if (tableMap.has(relation.fromTable) && tableMap.has(relation.toTable)) {
      // fromTable dépend de toTable (la FK pointe vers toTable)
      dependencies.get(relation.fromTable)?.add(relation.toTable);
    }
  }

  // Tri topologique
  const sorted: TableDefinition[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(tableName: string): void {
    if (visited.has(tableName)) return;
    if (visiting.has(tableName)) {
      // Cycle détecté, ignorer
      return;
    }

    visiting.add(tableName);
    const deps = dependencies.get(tableName) || new Set();
    for (const dep of deps) {
      visit(dep);
    }
    visiting.delete(tableName);
    visited.add(tableName);

    const table = tableMap.get(tableName);
    if (table) {
      sorted.push(table);
    }
  }

  for (const table of tables) {
    visit(table.name);
  }

  return sorted;
}

/**
 * Génère le CREATE TABLE pour une table
 */
function generateCreateTable(table: TableDefinition, relations: RelationDefinition[]): string {
  const lines: string[] = [];

  lines.push(`-- Table: ${table.label || table.name}`);
  if (table.description) {
    lines.push(`-- ${table.description}`);
  }
  lines.push(`DROP TABLE IF EXISTS \`${table.name}\`;`);
  lines.push(`CREATE TABLE \`${table.name}\` (`);

  const columnDefs: string[] = [];

  // Colonnes
  for (const field of table.fields) {
    columnDefs.push(`  ${generateColumnDefinition(field)}`);
  }

  // Clé primaire
  const pk = Array.isArray(table.primaryKey) ? table.primaryKey : [table.primaryKey];
  columnDefs.push(`  PRIMARY KEY (${pk.map(k => `\`${k}\``).join(', ')})`);

  // Indexes
  if (table.indexes) {
    for (const index of table.indexes) {
      const indexType = index.unique ? 'UNIQUE KEY' : 'KEY';
      const indexFields = index.fields.map(f => `\`${f}\``).join(', ');
      columnDefs.push(`  ${indexType} \`${index.name}\` (${indexFields})`);
    }
  }

  // Contraintes de clé étrangère
  const tableRelations = relations.filter(r => r.fromTable === table.name);
  for (const relation of tableRelations) {
    const onDelete = relation.onDelete ? ` ON DELETE ${relation.onDelete.toUpperCase()}` : '';
    const onUpdate = relation.onUpdate ? ` ON UPDATE ${relation.onUpdate.toUpperCase()}` : '';
    columnDefs.push(
      `  CONSTRAINT \`fk_${table.name}_${relation.fromField}\` ` +
      `FOREIGN KEY (\`${relation.fromField}\`) ` +
      `REFERENCES \`${relation.toTable}\` (\`${relation.toField}\`)${onDelete}${onUpdate}`
    );
  }

  lines.push(columnDefs.join(',\n'));
  lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);

  return lines.join('\n');
}

/**
 * Génère la définition d'une colonne
 */
function generateColumnDefinition(field: FieldDefinition): string {
  let def = `\`${field.name}\` ${mapFieldTypeToSQL(field.type)}`;

  // Taille pour les strings
  if (field.type === 'string' && field.max) {
    def = `\`${field.name}\` VARCHAR(${field.max})`;
  }

  // NOT NULL
  if (field.required) {
    def += ' NOT NULL';
  }

  // UNIQUE
  if (field.unique) {
    def += ' UNIQUE';
  }

  // DEFAULT
  if (field.default !== undefined) {
    def += ` DEFAULT ${formatDefaultValue(field.default, field.type)}`;
  }

  // COMMENT
  if (field.description) {
    def += ` COMMENT '${escapeSQL(field.description)}'`;
  }

  return def;
}

/**
 * Mappe les types de champs vers les types SQL
 */
function mapFieldTypeToSQL(type: string): string {
  const typeMap: Record<string, string> = {
    'string': 'VARCHAR(255)',
    'number': 'DECIMAL(15,4)',
    'integer': 'INT',
    'boolean': 'TINYINT(1)',
    'date': 'DATE',
    'datetime': 'DATETIME',
    'enum': 'VARCHAR(100)',
    'json': 'JSON',
  };

  return typeMap[type] || 'TEXT';
}

/**
 * Formate une valeur par défaut pour SQL
 */
function formatDefaultValue(value: any, type: string): string {
  if (value === null) return 'NULL';

  switch (type) {
    case 'string':
    case 'enum':
      return `'${escapeSQL(String(value))}'`;
    case 'boolean':
      return value ? '1' : '0';
    case 'number':
    case 'integer':
      return String(value);
    case 'date':
    case 'datetime':
      if (value === 'CURRENT_TIMESTAMP') return value;
      return `'${escapeSQL(String(value))}'`;
    case 'json':
      return `'${escapeSQL(JSON.stringify(value))}'`;
    default:
      return `'${escapeSQL(String(value))}'`;
  }
}

/**
 * Génère les INSERT statements pour une table
 */
function generateInsertStatements(table: TableDefinition, records: any[]): string {
  if (records.length === 0) return '';

  const lines: string[] = [];
  const batchSize = 100; // Nombre d'enregistrements par INSERT

  // Récupérer les noms de colonnes depuis le premier enregistrement
  const allColumns = new Set<string>();
  for (const record of records) {
    for (const key of Object.keys(record)) {
      allColumns.add(key);
    }
  }
  const columns = Array.from(allColumns);

  // Générer les INSERT par lots
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    const columnList = columns.map(c => `\`${c}\``).join(', ');
    lines.push(`INSERT INTO \`${table.name}\` (${columnList}) VALUES`);

    const valueRows: string[] = [];
    for (const record of batch) {
      const values = columns.map(col => formatValue(record[col]));
      valueRows.push(`  (${values.join(', ')})`);
    }

    lines.push(valueRows.join(',\n') + ';');
  }

  return lines.join('\n');
}

/**
 * Formate une valeur pour un INSERT
 */
function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'object') {
    return `'${escapeSQL(JSON.stringify(value))}'`;
  }

  return `'${escapeSQL(String(value))}'`;
}

/**
 * Échappe les caractères spéciaux pour SQL
 */
function escapeSQL(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\0/g, '\\0');
}
