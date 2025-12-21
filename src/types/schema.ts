// ============================================================================
// CORE SCHEMA TYPES
// ============================================================================

export type FieldType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'enum'
  | 'json';

export interface FieldDefinition {
  name: string;
  type: FieldType;
  label?: string;
  description?: string;
  required?: boolean;
  unique?: boolean;
  default?: any;
  regex?: string;
  min?: number;
  max?: number;
  enumValues?: string[];

  // Dictionnaire métier
  sensitivity?: 'public' | 'internal' | 'confidential' | 'restricted';
  owner?: string;
  source?: string;
  tags?: string[];
}

export interface IndexDefinition {
  name: string;
  fields: string[];
  unique?: boolean;
}

export interface TableDefinition {
  name: string;
  label?: string;
  description?: string;
  fields: FieldDefinition[];
  primaryKey: string | string[];
  indexes?: IndexDefinition[];

  // Dictionnaire métier au niveau table
  sensitivity?: 'public' | 'internal' | 'confidential' | 'restricted';
  owner?: string;
  source?: string;
  status?: 'active' | 'deprecated' | 'draft';
  tags?: string[];
}

export type Cardinality = '1-1' | '1-n' | 'n-1' | 'n-n';
export type ReferentialAction = 'restrict' | 'cascade' | 'setNull' | 'noAction';

export interface RelationDefinition {
  id: string;
  name?: string;
  fromTable: string;
  fromField: string;
  toTable: string;
  toField: string;
  cardinality: Cardinality;
  onDelete?: ReferentialAction;
  onUpdate?: ReferentialAction;
  description?: string;
}

export interface Schema {
  version: string;
  updatedAt: string;
  tables: TableDefinition[];
  relations: RelationDefinition[];
  businessDictionary?: Record<string, any>;
}

// ============================================================================
// DATA TYPES
// ============================================================================

export type DataRecord = Record<string, any> & {
  id: string;
};

export type TableData = Record<string, DataRecord[]>;

export interface DataStore {
  updatedAt: string;
  data: TableData;
}

// ============================================================================
// RULES ENGINE TYPES
// ============================================================================

export type RuleSeverity = 'info' | 'warn' | 'error';
export type RuleScope = 'table' | 'field' | 'global';

export interface RuleCondition {
  field?: string;
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'regex' | 'exists' | 'notExists' | 'in' | 'notIn';
  value?: any;
  values?: any[];
}

export interface RuleDefinition {
  id: string;
  name: string;
  description?: string;
  severity: RuleSeverity;
  scope: RuleScope;
  table?: string;
  field?: string;
  when: RuleCondition[];
  then: {
    message: string;
    suggestion?: string;
    quickFix?: {
      op: 'setDefault' | 'setNull' | 'removeField' | 'convertType';
      value?: any;
      targetField?: string;
    };
  };
}

export interface RulesStore {
  version: string;
  updatedAt: string;
  rules: RuleDefinition[];
}

// ============================================================================
// VALIDATION & ALERT TYPES
// ============================================================================

export type ValidationSeverity = 'error' | 'warn' | 'info';

export interface ValidationAlert {
  severity: ValidationSeverity;
  code: string;
  location: string;
  message: string;
  suggestion?: string;
  quickFix?: {
    op: string;
    value?: any;
    [key: string]: any;
  };
  context?: {
    table?: string;
    field?: string;
    recordId?: string;
    affectedCount?: number;
    [key: string]: any;
  };
}

export interface ValidationReport {
  timestamp: string;
  summary: {
    errors: number;
    warnings: number;
    infos: number;
  };
  alerts: ValidationAlert[];
  levelA: ValidationAlert[]; // Structure validation
  levelB: ValidationAlert[]; // Integrity validation
  levelC: ValidationAlert[]; // Impact validation
}

// ============================================================================
// MIGRATION TYPES
// ============================================================================

export interface MigrationStep {
  type: 'rename' | 'split' | 'merge' | 'delete' | 'convert' | 'addDefault';
  table: string;
  field?: string;
  from?: string;
  to?: string | string[];
  affectedRecords?: number;
  suggestion: string;
}

export interface MigrationReport {
  timestamp: string;
  changes: MigrationStep[];
  impacts: {
    table: string;
    issue: string;
    affectedRecords: number;
    remediation: string;
  }[];
}

// ============================================================================
// STATE TYPES (Full application state)
// ============================================================================

export interface ApplicationState {
  schema: Schema;
  data: TableData;
  rules: RuleDefinition[];
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface ValidateRequest {
  schema: Schema;
  data: TableData;
  rules?: RuleDefinition[];
}

export interface ValidateResponse {
  valid: boolean;
  report: ValidationReport;
}

export interface ExportResponse {
  filename: string;
  blob: Blob;
}
