import { JSONSchemaType } from 'ajv';
import { Schema, TableDefinition, FieldDefinition, RelationDefinition } from '@/types/schema';

export const fieldDefinitionSchema: JSONSchemaType<FieldDefinition> = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    type: {
      type: 'string',
      enum: ['string', 'number', 'integer', 'boolean', 'date', 'datetime', 'enum', 'json'],
    },
    label: { type: 'string', nullable: true },
    description: { type: 'string', nullable: true },
    required: { type: 'boolean', nullable: true },
    unique: { type: 'boolean', nullable: true },
    default: { type: 'string', nullable: true } as any,
    regex: { type: 'string', nullable: true },
    min: { type: 'number', nullable: true },
    max: { type: 'number', nullable: true },
    enumValues: {
      type: 'array',
      items: { type: 'string' },
      nullable: true,
    },
    sensitivity: { type: 'string', nullable: true }, // Pas de contrainte enum
    owner: { type: 'string', nullable: true },
    source: { type: 'string', nullable: true },
    tags: {
      type: 'array',
      items: { type: 'string' },
      nullable: true,
    },
  },
  required: ['name', 'type'],
  additionalProperties: true,
};

export const tableDefinitionSchema: JSONSchemaType<TableDefinition> = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    label: { type: 'string', nullable: true },
    description: { type: 'string', nullable: true },
    fields: {
      type: 'array',
      items: fieldDefinitionSchema,
    },
    primaryKey: {
      anyOf: [
        { type: 'string' },
        { type: 'array', items: { type: 'string' } },
      ],
    } as any,
    indexes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          fields: {
            type: 'array',
            items: { type: 'string' },
          },
          unique: { type: 'boolean', nullable: true },
        },
        required: ['name', 'fields'],
        additionalProperties: true,
      },
      nullable: true,
    },
    sensitivity: { type: 'string', nullable: true }, // Pas de contrainte enum
    owner: { type: 'string', nullable: true },
    source: { type: 'string', nullable: true },
    status: { type: 'string', nullable: true }, // Pas de contrainte enum
    tags: {
      type: 'array',
      items: { type: 'string' },
      nullable: true,
    },
  },
  required: ['name', 'fields'],
  additionalProperties: true,
};

export const relationDefinitionSchema: JSONSchemaType<RelationDefinition> = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string', nullable: true },
    fromTable: { type: 'string' },
    fromField: { type: 'string' },
    toTable: { type: 'string' },
    toField: { type: 'string' },
    cardinality: {
      type: 'string',
      enum: ['1-1', '1-n', 'n-1', 'n-n'],
    },
    onDelete: {
      type: 'string',
      enum: ['restrict', 'cascade', 'setNull', 'noAction'],
      nullable: true,
    },
    onUpdate: {
      type: 'string',
      enum: ['restrict', 'cascade', 'setNull', 'noAction'],
      nullable: true,
    },
    description: { type: 'string', nullable: true },
  },
  required: ['id', 'fromTable', 'fromField', 'toTable', 'toField', 'cardinality'],
  additionalProperties: true,
};

export const schemaMetaSchema: JSONSchemaType<Schema> = {
  type: 'object',
  properties: {
    version: { type: 'string' },
    updatedAt: { type: 'string' },
    tables: {
      type: 'array',
      items: tableDefinitionSchema,
    },
    relations: {
      type: 'array',
      items: relationDefinitionSchema,
    },
    businessDictionary: {
      type: 'object',
      nullable: true,
      required: [],
    },
  },
  required: ['version', 'tables'],
  additionalProperties: true,
};
