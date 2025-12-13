import { Schema, TableDefinition, RelationDefinition } from '@/types/schema';

/**
 * Adaptateur pour gérer les deux formats de schéma:
 * - Format original: tables est un array
 * - Format importé: tables est un objet/dictionnaire
 */

export interface SchemaRaw {
  version: string;
  updatedAt?: string;
  tables: TableDefinition[] | Record<string, any>;
  relations: RelationDefinition[] | any[];
  businessDictionary?: Record<string, any>;
  dictionary?: Record<string, any>;
}

export function normalizeSchema(rawSchema: any): Schema {
  // Si tables est déjà un array, on retourne tel quel
  if (Array.isArray(rawSchema.tables)) {
    return {
      version: rawSchema.version || '1.0.0',
      updatedAt: rawSchema.updatedAt || new Date().toISOString(),
      tables: rawSchema.tables,
      relations: normalizeRelations(rawSchema.relations || []),
      businessDictionary: rawSchema.businessDictionary || rawSchema.dictionary || {},
    };
  }

  // Sinon, convertir l'objet en array
  const tables: TableDefinition[] = Object.entries(rawSchema.tables || {}).map(
    ([tableName, tableConfig]: [string, any]) => {
      return {
        name: tableName,
        label: tableConfig.label || tableName,
        description: tableConfig.description || '',
        primaryKey: extractPrimaryKey(tableConfig.fields),
        fields: normalizeFields(tableConfig.fields || {}),
        sensitivity: tableConfig.dictionary?.sensitivity,
        owner: tableConfig.dictionary?.owner,
        status: tableConfig.dictionary?.status || 'active',
      };
    }
  );

  return {
    version: rawSchema.version || '1.0.0',
    updatedAt: rawSchema.updatedAt || new Date().toISOString(),
    tables,
    relations: normalizeRelations(rawSchema.relations || []),
    businessDictionary: rawSchema.businessDictionary || rawSchema.dictionary || {},
  };
}

function extractPrimaryKey(fields: Record<string, any>): string | string[] {
  const pkFields = Object.entries(fields || {})
    .filter(([_, config]: [string, any]) => config.pk === true)
    .map(([name]) => name);

  if (pkFields.length === 0) return 'id'; // Default
  if (pkFields.length === 1) return pkFields[0];
  return pkFields;
}

function normalizeFields(fieldsObj: Record<string, any>) {
  return Object.entries(fieldsObj).map(([fieldName, fieldConfig]: [string, any]) => ({
    name: fieldName,
    type: normalizeFieldType(fieldConfig.type),
    label: fieldConfig.label || fieldName,
    description: fieldConfig.description,
    required: fieldConfig.required === true,
    unique: fieldConfig.unique === true,
    default: fieldConfig.default,
    regex: fieldConfig.regex || fieldConfig.pattern,
    min: fieldConfig.min || fieldConfig.minLength || fieldConfig.minimum,
    max: fieldConfig.max || fieldConfig.maxLength || fieldConfig.maximum,
    enumValues: fieldConfig.enumValues || fieldConfig.enum,
    sensitivity: fieldConfig.sensitivity,
    owner: fieldConfig.owner,
    source: fieldConfig.source,
    tags: fieldConfig.tags,
  }));
}

function normalizeFieldType(type: string): any {
  // Mapper les types possibles
  const typeMap: Record<string, string> = {
    int: 'integer',
    float: 'number',
    double: 'number',
    text: 'string',
    varchar: 'string',
    char: 'string',
    timestamp: 'datetime',
    bool: 'boolean',
    object: 'json',
    array: 'json',
  };

  return typeMap[type?.toLowerCase()] || type || 'string';
}

function normalizeRelations(relations: any[]): RelationDefinition[] {
  return relations.map((rel, index) => {
    // Format original
    if (rel.fromTable && rel.toTable) {
      return {
        id: rel.id || `rel_${index}`,
        name: rel.name,
        fromTable: rel.fromTable,
        fromField: rel.fromField,
        toTable: rel.toTable,
        toField: rel.toField,
        cardinality: rel.cardinality || '1-n',
        onDelete: rel.onDelete,
        onUpdate: rel.onUpdate,
        description: rel.description || rel.note,
      };
    }

    // Format importé: from = "table.field", to = "table.field"
    if (rel.from && rel.to) {
      const [fromTable, fromField] = rel.from.split('.');
      const [toTable, toField] = rel.to.split('.');

      return {
        id: rel.id || `rel_${index}`,
        name: rel.name,
        fromTable,
        fromField,
        toTable,
        toField,
        cardinality: rel.cardinality || 'n-1',
        onDelete: rel.onDelete || 'restrict',
        onUpdate: rel.onUpdate || 'restrict',
        description: rel.description || rel.note,
      };
    }

    // Fallback
    return {
      id: `rel_${index}`,
      fromTable: '',
      fromField: '',
      toTable: '',
      toField: '',
      cardinality: 'n-1',
    };
  });
}

export function getTables(schema: Schema): TableDefinition[] {
  return schema.tables || [];
}

export function getTableByName(schema: Schema, tableName: string): TableDefinition | undefined {
  return schema.tables.find((t) => t.name === tableName);
}

export function getTableNames(schema: Schema): string[] {
  return schema.tables.map((t) => t.name);
}
