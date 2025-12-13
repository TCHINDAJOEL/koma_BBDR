import { Validator } from '@/lib/validator';
import { Schema, TableData, RuleDefinition } from '@/types/schema';

describe('Validator', () => {
  let validator: Validator;

  beforeEach(() => {
    validator = new Validator();
  });

  const mockSchema: Schema = {
    version: '1.0.0',
    updatedAt: '2025-01-15T10:00:00.000Z',
    tables: [
      {
        name: 'Users',
        primaryKey: 'id',
        fields: [
          { name: 'id', type: 'string', required: true },
          { name: 'email', type: 'string', required: true, regex: '^[^@]+@[^@]+\\.[^@]+$' },
          { name: 'age', type: 'integer', min: 0, max: 150 },
          { name: 'status', type: 'enum', enumValues: ['ACTIVE', 'INACTIVE'], required: true },
        ],
      },
    ],
    relations: [],
  };

  describe('Level A - Structure Validation', () => {
    it('should validate correct data structure', () => {
      const data: TableData = {
        Users: [
          {
            id: 'user_001',
            email: 'test@example.com',
            age: 25,
            status: 'ACTIVE',
          },
        ],
      };

      const report = validator.validate(mockSchema, data);
      const structureErrors = report.levelA.filter((a) => a.severity === 'error');
      expect(structureErrors.length).toBe(0);
    });

    it('should detect missing required field', () => {
      const data: TableData = {
        Users: [
          {
            id: 'user_001',
            // email manquant
            status: 'ACTIVE',
          },
        ],
      };

      const report = validator.validate(mockSchema, data);
      const errors = report.levelA.filter((a) => a.code === 'INVALID_DATA_STRUCTURE');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should detect invalid email format', () => {
      const data: TableData = {
        Users: [
          {
            id: 'user_001',
            email: 'invalid-email',
            status: 'ACTIVE',
          },
        ],
      };

      const report = validator.validate(mockSchema, data);
      const errors = report.levelA.filter((a) => a.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should detect out-of-range integer', () => {
      const data: TableData = {
        Users: [
          {
            id: 'user_001',
            email: 'test@example.com',
            age: 200, // > max
            status: 'ACTIVE',
          },
        ],
      };

      const report = validator.validate(mockSchema, data);
      const errors = report.levelA.filter((a) => a.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Level B - Integrity Validation', () => {
    it('should detect duplicate primary key', () => {
      const data: TableData = {
        Users: [
          { id: 'user_001', email: 'test1@example.com', status: 'ACTIVE' },
          { id: 'user_001', email: 'test2@example.com', status: 'ACTIVE' },
        ],
      };

      const report = validator.validate(mockSchema, data);
      const pkErrors = report.levelB.filter((a) => a.code === 'PRIMARY_KEY_DUPLICATE');
      expect(pkErrors.length).toBeGreaterThan(0);
    });

    it('should detect foreign key violation', () => {
      const schemaWithRelations: Schema = {
        ...mockSchema,
        tables: [
          ...mockSchema.tables,
          {
            name: 'Posts',
            primaryKey: 'id',
            fields: [
              { name: 'id', type: 'string', required: true },
              { name: 'authorId', type: 'string', required: true },
            ],
          },
        ],
        relations: [
          {
            id: 'rel_001',
            fromTable: 'Posts',
            fromField: 'authorId',
            toTable: 'Users',
            toField: 'id',
            cardinality: 'n-1',
          },
        ],
      };

      const data: TableData = {
        Users: [{ id: 'user_001', email: 'test@example.com', status: 'ACTIVE' }],
        Posts: [{ id: 'post_001', authorId: 'user_999' }], // FK invalide
      };

      const report = validator.validate(schemaWithRelations, data);
      const fkErrors = report.levelB.filter((a) => a.code === 'FOREIGN_KEY_VIOLATION');
      expect(fkErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Level C - Impact Validation', () => {
    it('should detect enum value violations', () => {
      const data: TableData = {
        Users: [
          { id: 'user_001', email: 'test@example.com', status: 'INVALID_STATUS' },
        ],
      };

      const report = validator.validate(mockSchema, data);
      const enumErrors = report.levelC.filter((a) => a.code === 'ENUM_VALUE_INVALID');
      expect(enumErrors.length).toBeGreaterThan(0);
    });

    it('should detect missing required values', () => {
      const data: TableData = {
        Users: [
          { id: 'user_001', email: '', status: 'ACTIVE' }, // email vide
        ],
      };

      const report = validator.validate(mockSchema, data);
      const missingErrors = report.levelC.filter((a) => a.code === 'REQUIRED_FIELD_MISSING');
      expect(missingErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Business Rules Validation', () => {
    it('should apply business rules', () => {
      const rules: RuleDefinition[] = [
        {
          id: 'rule_001',
          name: 'Active users must have email',
          severity: 'error',
          scope: 'table',
          table: 'Users',
          when: [
            { field: 'status', operator: '==', value: 'ACTIVE' },
            { field: 'email', operator: 'notExists' },
          ],
          then: {
            message: 'Active users must have an email',
            suggestion: 'Add email or change status',
          },
        },
      ];

      const data: TableData = {
        Users: [
          { id: 'user_001', status: 'ACTIVE' }, // pas d'email
        ],
      };

      const report = validator.validate(mockSchema, data, rules);
      const ruleErrors = report.alerts.filter((a) => a.code === 'RULE_rule_001');
      expect(ruleErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Summary', () => {
    it('should provide correct summary counts', () => {
      const data: TableData = {
        Users: [
          { id: 'user_001' }, // missing required fields
        ],
      };

      const report = validator.validate(mockSchema, data);
      expect(report.summary.errors).toBeGreaterThan(0);
      expect(report.summary.errors).toBe(
        report.alerts.filter((a) => a.severity === 'error').length
      );
    });
  });
});
