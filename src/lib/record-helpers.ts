import {
  Schema,
  TableData,
  DataRecord,
  TableDefinition,
  FieldDefinition,
  RelationDefinition,
} from '@/types/schema';

// ============================================================================
// NORMALISATION DES RECORDS
// ============================================================================

/**
 * Normalise un record selon les FieldDefinition de la table
 * Convertit les types et applique les valeurs par défaut
 */
export function normalizeRecord(
  record: Record<string, any>,
  fields: FieldDefinition[]
): DataRecord {
  const normalized: Record<string, any> = {
    id: record.id,
  };

  fields.forEach((field) => {
    const value = record[field.name];

    // Appliquer la valeur par défaut si manquante
    if (value === undefined || value === null || value === '') {
      if (field.default !== undefined) {
        normalized[field.name] = field.default;
      } else {
        normalized[field.name] = null;
      }
      return;
    }

    // Convertir selon le type
    normalized[field.name] = convertFieldValue(value, field.type);
  });

  return normalized as DataRecord;
}

/**
 * Convertit une valeur selon le type de champ
 */
export function convertFieldValue(value: any, type: string): any {
  if (value === null || value === undefined) return null;

  switch (type) {
    case 'number':
      const num = parseFloat(value);
      return isNaN(num) ? null : num;

    case 'integer':
      const int = parseInt(value, 10);
      return isNaN(int) ? null : int;

    case 'boolean':
      if (typeof value === 'boolean') return value;
      if (value === 'true' || value === '1') return true;
      if (value === 'false' || value === '0') return false;
      return Boolean(value);

    case 'json':
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return value;

    case 'date':
    case 'datetime':
    case 'string':
    case 'enum':
    default:
      return String(value);
  }
}

// ============================================================================
// GÉNÉRATION DE SCHÉMA AJV
// ============================================================================

/**
 * Génère un schéma AJV pour valider un record d'une table
 * Note: Aucun champ n'est marqué comme required pour plus de flexibilité
 */
export function generateAjvSchema(table: TableDefinition): object {
  const properties: Record<string, any> = {
    id: { type: ['string', 'number', 'integer', 'null'] },
  };

  table.fields.forEach((field) => {
    properties[field.name] = fieldToAjvSchema(field);
  });

  return {
    type: 'object',
    properties,
    required: [], // Aucun champ obligatoire
    additionalProperties: true,
  };
}

/**
 * Convertit un FieldDefinition en schéma AJV
 * Note: Tous les types sont toujours nullable
 */
function fieldToAjvSchema(field: FieldDefinition): any {
  const schema: any = {};

  // Toujours permettre null
  const makeNullable = (types: string | string[]): string[] => {
    if (Array.isArray(types)) {
      return types.includes('null') ? types : [...types, 'null'];
    }
    return [types, 'null'];
  };

  switch (field.type) {
    case 'string':
      schema.type = makeNullable('string');
      break;

    case 'number':
      schema.type = makeNullable('number');
      break;

    case 'integer':
      schema.type = makeNullable(['integer', 'number']);
      break;

    case 'boolean':
      schema.type = makeNullable('boolean');
      break;

    case 'date':
    case 'datetime':
      schema.type = makeNullable('string');
      break;

    case 'enum':
      if (field.enumValues) {
        schema.enum = [...field.enumValues, null, ''];
      } else {
        schema.type = makeNullable('string');
      }
      break;

    case 'json':
      schema.type = ['object', 'array', 'string', 'number', 'boolean', 'null'];
      break;

    default:
      schema.type = makeNullable('string');
  }

  return schema;
}

// ============================================================================
// GESTION DES RELATIONS
// ============================================================================

export interface TableRelations {
  incoming: RelationDefinition[];
  outgoing: RelationDefinition[];
}

/**
 * Trouve toutes les relations impliquant une table
 */
export function getTableRelations(
  relations: RelationDefinition[],
  tableName: string
): TableRelations {
  return {
    incoming: relations.filter((r) => r.toTable === tableName),
    outgoing: relations.filter((r) => r.fromTable === tableName),
  };
}

/**
 * Récupère les enregistrements liés via une relation
 */
export function getRelatedRecords(
  data: TableData,
  record: DataRecord,
  relation: RelationDefinition,
  direction: 'from' | 'to'
): DataRecord[] {
  if (direction === 'from') {
    // Relation sortante: on cherche dans toTable où toField = record[fromField]
    const fkValue = record[relation.fromField];
    if (fkValue === null || fkValue === undefined) return [];

    const targetData = data[relation.toTable] || [];
    return targetData.filter((r) => r[relation.toField] === fkValue);
  } else {
    // Relation entrante: on cherche dans fromTable où fromField = record[toField]
    const pkValue = record[relation.toField];
    if (pkValue === null || pkValue === undefined) return [];

    const sourceData = data[relation.fromTable] || [];
    return sourceData.filter((r) => r[relation.fromField] === pkValue);
  }
}

export interface RelatedRecordsInfo {
  relation: RelationDefinition;
  direction: 'from' | 'to';
  relatedTable: string;
  relatedField: string;
  localField: string;
  records: DataRecord[];
}

/**
 * Récupère toutes les informations de relations pour un enregistrement
 */
export function getAllRelatedRecords(
  data: TableData,
  record: DataRecord,
  tableName: string,
  relations: RelationDefinition[]
): RelatedRecordsInfo[] {
  const tableRelations = getTableRelations(relations, tableName);
  const result: RelatedRecordsInfo[] = [];

  // Relations sortantes (FK dans cette table)
  tableRelations.outgoing.forEach((relation) => {
    const records = getRelatedRecords(data, record, relation, 'from');
    result.push({
      relation,
      direction: 'from',
      relatedTable: relation.toTable,
      relatedField: relation.toField,
      localField: relation.fromField,
      records,
    });
  });

  // Relations entrantes (FK dans d'autres tables pointant vers cette table)
  tableRelations.incoming.forEach((relation) => {
    const records = getRelatedRecords(data, record, relation, 'to');
    result.push({
      relation,
      direction: 'to',
      relatedTable: relation.fromTable,
      relatedField: relation.fromField,
      localField: relation.toField,
      records,
    });
  });

  return result;
}

// ============================================================================
// VALIDATION CÔTÉ CLIENT
// ============================================================================

export interface ClientValidationResult {
  valid: boolean;
  errors: { field: string; message: string }[];
}

/**
 * Valide un record côté client pour feedback immédiat
 * Note: Les champs requis ne bloquent plus, ils génèrent juste des avertissements
 */
export function validateRecordClient(
  record: Record<string, any>,
  table: TableDefinition
): ClientValidationResult {
  const errors: { field: string; message: string }[] = [];

  // L'ID n'est pas obligatoire non plus
  // if (!record.id) {
  //   errors.push({ field: 'id', message: "L'identifiant est requis" });
  // }

  // Vérifier chaque champ
  table.fields.forEach((field) => {
    const value = record[field.name];

    // Les champs requis ne génèrent plus d'erreur bloquante
    // Ils seront gérés comme warnings côté serveur

    // Pas de validation supplémentaire si valeur vide
    if (value === undefined || value === null || value === '') return;

    // Validation par type
    switch (field.type) {
      case 'number':
      case 'integer':
        if (isNaN(Number(value))) {
          errors.push({
            field: field.name,
            message: `${field.label || field.name} doit être un nombre`,
          });
        } else {
          if (field.min !== undefined && Number(value) < field.min) {
            errors.push({
              field: field.name,
              message: `${field.label || field.name} doit être >= ${field.min}`,
            });
          }
          if (field.max !== undefined && Number(value) > field.max) {
            errors.push({
              field: field.name,
              message: `${field.label || field.name} doit être <= ${field.max}`,
            });
          }
        }
        break;

      case 'string':
        const strValue = String(value);
        if (field.min !== undefined && strValue.length < field.min) {
          errors.push({
            field: field.name,
            message: `${field.label || field.name} doit avoir au moins ${field.min} caractères`,
          });
        }
        if (field.max !== undefined && strValue.length > field.max) {
          errors.push({
            field: field.name,
            message: `${field.label || field.name} doit avoir au plus ${field.max} caractères`,
          });
        }
        if (field.regex) {
          try {
            if (!new RegExp(field.regex).test(strValue)) {
              errors.push({
                field: field.name,
                message: `${field.label || field.name} ne correspond pas au format attendu`,
              });
            }
          } catch {
            // Regex invalide, ignorer
          }
        }
        break;

      case 'enum':
        if (field.enumValues && !field.enumValues.includes(value)) {
          errors.push({
            field: field.name,
            message: `${field.label || field.name} doit être une des valeurs: ${field.enumValues.join(', ')}`,
          });
        }
        break;

      case 'json':
        if (typeof value === 'string') {
          try {
            JSON.parse(value);
          } catch {
            errors.push({
              field: field.name,
              message: `${field.label || field.name} contient du JSON invalide`,
            });
          }
        }
        break;
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Génère un nouvel ID unique pour un record
 */
export function generateRecordId(): string {
  return crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
}

/**
 * Clone profond d'un record
 */
export function cloneRecord(record: DataRecord): DataRecord {
  return JSON.parse(JSON.stringify(record));
}

/**
 * Compare deux records pour détecter les changements
 */
export function hasRecordChanged(
  original: DataRecord,
  modified: DataRecord
): boolean {
  return JSON.stringify(original) !== JSON.stringify(modified);
}

/**
 * Récupère les champs modifiés entre deux versions d'un record
 */
export function getChangedFields(
  original: DataRecord,
  modified: DataRecord
): string[] {
  const changed: string[] = [];
  const allKeys = new Set([...Object.keys(original), ...Object.keys(modified)]);

  allKeys.forEach((key) => {
    if (JSON.stringify(original[key]) !== JSON.stringify(modified[key])) {
      changed.push(key);
    }
  });

  return changed;
}
