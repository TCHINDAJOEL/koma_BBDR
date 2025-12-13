import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  Schema,
  TableData,
  RuleDefinition,
  AuditEvent,
  ApplicationState,
  AuditAction,
} from '@/types/schema';
import { normalizeSchema } from './schema-adapter';

// ============================================================================
// STORAGE MANAGER
// ============================================================================

const STORAGE_DIR = path.join(process.cwd(), 'storage');
const SCHEMA_FILE = path.join(STORAGE_DIR, 'schema.json');
const DATA_FILE = path.join(STORAGE_DIR, 'data.json');
const RULES_FILE = path.join(STORAGE_DIR, 'rules.json');
const AUDIT_FILE = path.join(STORAGE_DIR, 'audit.ndjson');

export class StorageManager {
  constructor() {
    this.ensureStorageDir();
  }

  private async ensureStorageDir() {
    try {
      await fs.access(STORAGE_DIR);
    } catch {
      await fs.mkdir(STORAGE_DIR, { recursive: true });
    }
  }

  // ==========================================================================
  // READ OPERATIONS
  // ==========================================================================

  async loadSchema(): Promise<Schema> {
    try {
      const content = await fs.readFile(SCHEMA_FILE, 'utf-8');
      const rawSchema = JSON.parse(content);
      return normalizeSchema(rawSchema);
    } catch (error) {
      return this.getDefaultSchema();
    }
  }

  async loadData(): Promise<TableData> {
    try {
      const content = await fs.readFile(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(content);

      let data: TableData = {};

      // Support multiple formats
      if (parsed.data) {
        data = parsed.data;
      } else if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        // If it's an object at the root, assume it's the data directly
        data = parsed;
      }

      // Transform data if it has the { table: "...", records: [...] } structure
      const transformedData: TableData = {};
      for (const [tableName, tableData] of Object.entries(data)) {
        if (
          typeof tableData === 'object' &&
          tableData !== null &&
          'records' in tableData &&
          Array.isArray(tableData.records)
        ) {
          // Extract the records array
          transformedData[tableName] = tableData.records;
        } else if (Array.isArray(tableData)) {
          // Already in the correct format
          transformedData[tableName] = tableData;
        } else {
          // Keep as is
          transformedData[tableName] = tableData;
        }
      }

      return transformedData;
    } catch (error) {
      return {};
    }
  }

  async loadRules(): Promise<RuleDefinition[]> {
    try {
      const content = await fs.readFile(RULES_FILE, 'utf-8');
      const parsed = JSON.parse(content);

      // Support multiple formats
      if (Array.isArray(parsed.rules)) {
        return parsed.rules;
      } else if (Array.isArray(parsed)) {
        return parsed;
      }

      return [];
    } catch (error) {
      return [];
    }
  }

  async loadAudit(): Promise<AuditEvent[]> {
    try {
      const content = await fs.readFile(AUDIT_FILE, 'utf-8');
      const lines = content.trim().split('\n').filter((l) => l.length > 0);
      return lines.map((line, index) => {
        const event = JSON.parse(line);
        // Ensure eventId exists
        if (!event.eventId) {
          event.eventId = `evt_imported_${index}`;
        }
        return event as AuditEvent;
      });
    } catch (error) {
      return [];
    }
  }

  async loadState(): Promise<ApplicationState> {
    const [schema, data, rules, audit] = await Promise.all([
      this.loadSchema(),
      this.loadData(),
      this.loadRules(),
      this.loadAudit(),
    ]);

    return { schema, data, rules, audit };
  }

  // ==========================================================================
  // WRITE OPERATIONS
  // ==========================================================================

  async saveSchema(schema: Schema): Promise<void> {
    await this.ensureStorageDir();
    await fs.writeFile(SCHEMA_FILE, JSON.stringify(schema, null, 2), 'utf-8');
  }

  async saveData(data: TableData): Promise<void> {
    await this.ensureStorageDir();
    const dataStore = {
      updatedAt: new Date().toISOString(),
      data,
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(dataStore, null, 2), 'utf-8');
  }

  async saveRules(rules: RuleDefinition[]): Promise<void> {
    await this.ensureStorageDir();
    const rulesStore = {
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
      rules,
    };
    await fs.writeFile(RULES_FILE, JSON.stringify(rulesStore, null, 2), 'utf-8');
  }

  async appendAuditEvent(event: AuditEvent): Promise<void> {
    await this.ensureStorageDir();
    const line = JSON.stringify(event) + '\n';
    await fs.appendFile(AUDIT_FILE, line, 'utf-8');
  }

  // ==========================================================================
  // AUDIT EVENT CREATOR
  // ==========================================================================

  createAuditEvent(
    action: AuditAction,
    target: AuditEvent['target'],
    before?: any,
    after?: any,
    reason?: string,
    actor: string = 'local-user'
  ): AuditEvent {
    return {
      eventId: uuidv4(),
      ts: new Date().toISOString(),
      actor,
      action,
      target,
      before,
      after,
      reason,
    };
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private getDefaultSchema(): Schema {
    return {
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
      tables: [],
      relations: [],
      businessDictionary: {},
    };
  }

  async fileExists(filename: string): Promise<boolean> {
    try {
      await fs.access(path.join(STORAGE_DIR, filename));
      return true;
    } catch {
      return false;
    }
  }

  async readFile(filename: string): Promise<string> {
    return await fs.readFile(path.join(STORAGE_DIR, filename), 'utf-8');
  }

  async writeFile(filename: string, content: string): Promise<void> {
    await this.ensureStorageDir();
    await fs.writeFile(path.join(STORAGE_DIR, filename), content, 'utf-8');
  }

  async deleteFile(filename: string): Promise<void> {
    try {
      await fs.unlink(path.join(STORAGE_DIR, filename));
    } catch {
      // Fichier n'existe pas, ignorer
    }
  }

  async listFiles(): Promise<string[]> {
    try {
      return await fs.readdir(STORAGE_DIR);
    } catch {
      return [];
    }
  }
}

export const storage = new StorageManager();
