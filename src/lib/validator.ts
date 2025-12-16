import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import {
  Schema,
  TableData,
  ValidationAlert,
  ValidationReport,
  RuleDefinition,
  FieldDefinition,
  TableDefinition,
  FieldType,
} from '@/types/schema';
import { schemaMetaSchema } from './meta-schema';

// ============================================================================
// VALIDATION ENGINE
// ============================================================================

export class Validator {
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
  }

  /**
   * Normalise les données d'une table en tableau
   * Gère les cas où les données sont un objet au lieu d'un tableau
   */
  private normalizeTableData(rawData: any): any[] {
    if (Array.isArray(rawData)) {
      return rawData;
    } else if (rawData && typeof rawData === 'object') {
      // Si c'est un objet, le traiter comme un seul enregistrement
      return [rawData];
    }
    return [];
  }

  /**
   * Validation complète (3 niveaux)
   */
  public validate(
    schema: Schema,
    data: TableData,
    rules?: RuleDefinition[]
  ): ValidationReport {
    const levelA = this.validateStructure(schema, data);
    const levelB = this.validateIntegrity(schema, data);
    const levelC = this.validateImpact(schema, data);

    const allAlerts = [...levelA, ...levelB, ...levelC];

    // Appliquer les règles métier si fournies
    if (rules && rules.length > 0) {
      const ruleAlerts = this.validateRules(schema, data, rules);
      allAlerts.push(...ruleAlerts);
    }

    const summary = {
      errors: allAlerts.filter((a) => a.severity === 'error').length,
      warnings: allAlerts.filter((a) => a.severity === 'warn').length,
      infos: allAlerts.filter((a) => a.severity === 'info').length,
    };

    return {
      timestamp: new Date().toISOString(),
      summary,
      alerts: allAlerts,
      levelA,
      levelB,
      levelC,
    };
  }

  // ==========================================================================
  // LEVEL A: Structure Validation (AJV)
  // ==========================================================================

  private validateStructure(schema: Schema, data: TableData): ValidationAlert[] {
    const alerts: ValidationAlert[] = [];

    // 1. Valider le schéma lui-même contre le meta-schema
    const schemaValidator = this.ajv.compile(schemaMetaSchema);
    if (!schemaValidator(schema)) {
      schemaValidator.errors?.forEach((err) => {
        alerts.push({
          severity: 'error',
          code: 'INVALID_SCHEMA_STRUCTURE',
          location: err.instancePath || '/schema',
          message: `Erreur de structure du schéma: ${err.message}`,
          suggestion: 'Corriger la structure du schema.json selon le meta-schema',
        });
      });
    }

    // 2. Valider les données contre le schéma
    schema.tables.forEach((table) => {
      const tableData = this.normalizeTableData(data[table.name]);
      const tableSchema = this.generateTableSchema(table);
      const dataValidator = this.ajv.compile(tableSchema);

      tableData.forEach((record: any, index) => {
        if (!dataValidator(record)) {
          dataValidator.errors?.forEach((err) => {
            alerts.push({
              severity: 'error',
              code: 'INVALID_DATA_STRUCTURE',
              location: `/data/${table.name}/${index}${err.instancePath}`,
              message: `${err.message} dans ${table.name}[${index}]`,
              suggestion: this.getValidationSuggestion(err.keyword, err.params),
              context: {
                table: table.name,
                recordId: record.id,
              },
            });
          });
        }
      });
    });

    return alerts;
  }

  /**
   * Génère un JSON Schema pour une table
   */
  private generateTableSchema(table: TableDefinition): any {
    const properties: any = {
      // id peut être string ou number
      id: { type: ['string', 'number', 'integer'] },
    };

    const requiredSet = new Set<string>(['id']);

    table.fields.forEach((field) => {
      properties[field.name] = this.fieldToJsonSchema(field);
      if (field.required) {
        requiredSet.add(field.name);
      }
    });

    return {
      type: 'object',
      properties,
      required: Array.from(requiredSet),
      additionalProperties: true, // Permettre les propriétés additionnelles pour plus de flexibilité
    };
  }

  /**
   * Convertit une définition de champ en JSON Schema
   */
  private fieldToJsonSchema(field: FieldDefinition): any {
    const schema: any = {};

    // Fonction pour ajouter null aux types si le champ n'est pas requis
    const makeNullable = (types: string | string[]): string | string[] => {
      if (field.required) return types;
      if (Array.isArray(types)) {
        return [...types, 'null'];
      }
      return [types, 'null'];
    };

    switch (field.type) {
      case 'string':
        schema.type = makeNullable('string');
        if (field.regex) schema.pattern = field.regex;
        if (field.min !== undefined) schema.minLength = field.min;
        if (field.max !== undefined) schema.maxLength = field.max;
        break;

      case 'number':
        schema.type = makeNullable('number');
        if (field.min !== undefined) schema.minimum = field.min;
        if (field.max !== undefined) schema.maximum = field.max;
        break;

      case 'integer':
        schema.type = makeNullable('integer');
        if (field.min !== undefined) schema.minimum = field.min;
        if (field.max !== undefined) schema.maximum = field.max;
        break;

      case 'boolean':
        schema.type = makeNullable('boolean');
        break;

      case 'date':
      case 'datetime':
        schema.type = makeNullable('string');
        // Ne pas appliquer le format strict pour plus de flexibilité
        break;

      case 'enum':
        schema.type = makeNullable('string');
        if (field.enumValues) {
          schema.enum = field.required ? field.enumValues : [...field.enumValues, null];
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

  private getValidationSuggestion(keyword: string, params: any): string {
    switch (keyword) {
      case 'required':
        return `Ajouter la propriété manquante: ${params.missingProperty}`;
      case 'type':
        return `Convertir la valeur en type ${params.type}`;
      case 'pattern':
        return `Vérifier que la valeur correspond au format attendu: ${params.pattern}`;
      case 'enum':
        return `Utiliser une des valeurs autorisées: ${params.allowedValues?.join(', ')}`;
      case 'minimum':
      case 'maximum':
        return `La valeur doit être entre ${params.limit}`;
      default:
        return 'Corriger la valeur selon les contraintes du schéma';
    }
  }

  // ==========================================================================
  // LEVEL B: Integrity Validation (Relations, FK, Constraints)
  // ==========================================================================

  private validateIntegrity(schema: Schema, data: TableData): ValidationAlert[] {
    const alerts: ValidationAlert[] = [];

    // 1. Valider les clés primaires
    schema.tables.forEach((table) => {
      const tableData = this.normalizeTableData(data[table.name]);
      const pkFields = Array.isArray(table.primaryKey)
        ? table.primaryKey
        : [table.primaryKey];

      // Vérifier que tous les enregistrements ont des PK
      tableData.forEach((record, index) => {
        pkFields.forEach((pkField) => {
          if (record[pkField] === undefined || record[pkField] === null) {
            alerts.push({
              severity: 'error',
              code: 'PRIMARY_KEY_MISSING',
              location: `/data/${table.name}/${index}/${pkField}`,
              message: `Clé primaire ${pkField} manquante`,
              suggestion: 'Ajouter une valeur pour la clé primaire',
              context: { table: table.name, recordId: record.id },
            });
          }
        });

        // Vérifier l'unicité des PK
        const pkValue = pkFields.map((f) => record[f]).join('|');
        const duplicates = tableData.filter(
          (r) => pkFields.map((f) => r[f]).join('|') === pkValue
        );
        if (duplicates.length > 1) {
          alerts.push({
            severity: 'error',
            code: 'PRIMARY_KEY_DUPLICATE',
            location: `/data/${table.name}/${index}`,
            message: `Clé primaire dupliquée: ${pkValue}`,
            suggestion: 'Assurer l\'unicité des clés primaires',
            context: { table: table.name, recordId: record.id },
          });
        }
      });
    });

    // 2. Valider les contraintes UNIQUE
    schema.tables.forEach((table) => {
      const tableData = data[table.name] || [];
      table.fields.forEach((field) => {
        if (field.unique) {
          const values = tableData.map((r) => r[field.name]);
          const uniqueValues = new Set(values.filter((v) => v !== null && v !== undefined));
          if (uniqueValues.size !== values.filter((v) => v !== null && v !== undefined).length) {
            alerts.push({
              severity: 'error',
              code: 'UNIQUE_CONSTRAINT_VIOLATION',
              location: `/data/${table.name}/*/${field.name}`,
              message: `Le champ ${field.name} doit être unique mais contient des doublons`,
              suggestion: 'Supprimer les valeurs dupliquées',
              context: { table: table.name, field: field.name },
            });
          }
        }
      });
    });

    // 3. Valider les relations (FK)
    schema.relations.forEach((relation) => {
      const fromData = data[relation.fromTable] || [];
      const toData = data[relation.toTable] || [];

      fromData.forEach((record, index) => {
        const fkValue = record[relation.fromField];

        if (fkValue !== null && fkValue !== undefined) {
          // Vérifier que la FK pointe vers un enregistrement existant
          const referenced = toData.find((r) => r[relation.toField] === fkValue);

          if (!referenced) {
            alerts.push({
              severity: 'error',
              code: 'FOREIGN_KEY_VIOLATION',
              location: `/data/${relation.fromTable}/${index}/${relation.fromField}`,
              message: `FK invalide: ${fkValue} n'existe pas dans ${relation.toTable}.${relation.toField}`,
              suggestion: `Supprimer l'enregistrement ou créer la référence dans ${relation.toTable}`,
              quickFix: { op: 'setNull', field: relation.fromField },
              context: {
                table: relation.fromTable,
                field: relation.fromField,
                recordId: record.id,
                referencedTable: relation.toTable,
              },
            });
          }
        }
      });

      // Vérifier les cardinalités
      if (relation.cardinality === '1-1') {
        // Chaque valeur de FK doit être unique
        const fkValues = fromData
          .map((r) => r[relation.fromField])
          .filter((v) => v !== null && v !== undefined);
        const uniqueFKs = new Set(fkValues);
        if (uniqueFKs.size !== fkValues.length) {
          alerts.push({
            severity: 'error',
            code: 'CARDINALITY_1_1_VIOLATION',
            location: `/relations/${relation.id}`,
            message: `Relation 1-1 violée: plusieurs enregistrements pointent vers la même référence`,
            suggestion: 'Vérifier que chaque FK est unique pour respecter la cardinalité 1-1',
            context: { relation: relation.id },
          });
        }
      }
    });

    return alerts;
  }

  // ==========================================================================
  // LEVEL C: Impact Validation (Schema changes → Data impact)
  // ==========================================================================

  private validateImpact(schema: Schema, data: TableData): ValidationAlert[] {
    const alerts: ValidationAlert[] = [];

    // Analyser l'impact potentiel des contraintes sur les données existantes
    schema.tables.forEach((table) => {
      const tableData = data[table.name] || [];

      table.fields.forEach((field) => {
        // Champ requis mais valeurs manquantes
        if (field.required) {
          const missing = tableData.filter(
            (r) => r[field.name] === undefined || r[field.name] === null || r[field.name] === ''
          );
          if (missing.length > 0) {
            alerts.push({
              severity: 'error',
              code: 'REQUIRED_FIELD_MISSING',
              location: `/data/${table.name}/*/${field.name}`,
              message: `Le champ ${field.name} est requis mais ${missing.length} enregistrement(s) n'ont pas de valeur`,
              suggestion: field.default !== undefined
                ? `Appliquer la valeur par défaut: ${field.default}`
                : 'Rendre le champ optionnel ou fournir des valeurs',
              quickFix: field.default !== undefined
                ? { op: 'setDefault', value: field.default }
                : undefined,
              context: {
                table: table.name,
                field: field.name,
                affectedCount: missing.length,
              },
            });
          }
        }

        // Valeurs hors enum
        if (field.type === 'enum' && field.enumValues) {
          const invalid = tableData.filter(
            (r) => r[field.name] && !field.enumValues!.includes(r[field.name])
          );
          if (invalid.length > 0) {
            alerts.push({
              severity: 'error',
              code: 'ENUM_VALUE_INVALID',
              location: `/data/${table.name}/*/${field.name}`,
              message: `${invalid.length} enregistrement(s) ont une valeur hors enum pour ${field.name}`,
              suggestion: `Utiliser une des valeurs: ${field.enumValues.join(', ')}`,
              quickFix: { op: 'setValid', value: field.enumValues[0] },
              context: {
                table: table.name,
                field: field.name,
                affectedCount: invalid.length,
                allowedValues: field.enumValues,
              },
            });
          }
        }

        // Type incompatible (détection basique)
        if (field.type === 'number' || field.type === 'integer') {
          const invalid = tableData.filter(
            (r) => r[field.name] !== null && r[field.name] !== undefined && isNaN(Number(r[field.name]))
          );
          if (invalid.length > 0) {
            alerts.push({
              severity: 'warn',
              code: 'TYPE_MISMATCH',
              location: `/data/${table.name}/*/${field.name}`,
              message: `${invalid.length} valeur(s) ne peuvent pas être converties en ${field.type}`,
              suggestion: 'Corriger les valeurs ou changer le type du champ',
              quickFix: { op: 'convert', targetType: field.type },
              context: {
                table: table.name,
                field: field.name,
                affectedCount: invalid.length,
              },
            });
          }
        }
      });
    });

    return alerts;
  }

  // ==========================================================================
  // BUSINESS RULES VALIDATION
  // ==========================================================================

  private validateRules(
    schema: Schema,
    data: TableData,
    rules: RuleDefinition[]
  ): ValidationAlert[] {
    const alerts: ValidationAlert[] = [];

    rules.forEach((rule) => {
      if (rule.scope === 'table' && rule.table) {
        const tableData = this.normalizeTableData(data[rule.table]);
        tableData.forEach((record, index) => {
          if (this.evaluateConditions(record, rule.when)) {
            alerts.push({
              severity: rule.severity,
              code: `RULE_${rule.id}`,
              location: `/data/${rule.table}/${index}`,
              message: rule.then.message,
              suggestion: rule.then.suggestion,
              quickFix: rule.then.quickFix,
              context: {
                table: rule.table,
                recordId: record.id,
                rule: rule.name,
              },
            });
          }
        });
      }
    });

    return alerts;
  }

  private evaluateConditions(record: any, conditions: any[]): boolean {
    return conditions.every((cond) => {
      const value = record[cond.field || ''];

      switch (cond.operator) {
        case '==':
          return value === cond.value;
        case '!=':
          return value !== cond.value;
        case '>':
          return value > cond.value;
        case '<':
          return value < cond.value;
        case '>=':
          return value >= cond.value;
        case '<=':
          return value <= cond.value;
        case 'regex':
          return new RegExp(cond.value).test(String(value));
        case 'exists':
          return value !== null && value !== undefined && value !== '';
        case 'notExists':
          return value === null || value === undefined || value === '';
        case 'in':
          return cond.values?.includes(value);
        case 'notIn':
          return !cond.values?.includes(value);
        default:
          return false;
      }
    });
  }
}

export const validator = new Validator();
