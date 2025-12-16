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

// Configuration du debouncing et du cache
const DEBOUNCE_DELAY = 500; // ms
// Désactiver le cache en développement pour éviter les problèmes de données stales
const CACHE_TTL = process.env.NODE_ENV === 'development' ? 0 : 60000; // 0 en dev, 1 minute en prod

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface PendingWrite<T> {
  data: T;
  timer: NodeJS.Timeout | null;
  resolve: () => void;
  reject: (error: Error) => void;
}

export class StorageManager {
  private initPromise: Promise<void> | null = null;
  private isInitialized = false;

  // Cache en mémoire pour éviter les lectures répétées
  private schemaCache: CacheEntry<Schema> | null = null;
  private dataCache: CacheEntry<TableData> | null = null;
  private rulesCache: CacheEntry<RuleDefinition[]> | null = null;

  // Écritures en attente avec debouncing
  private pendingSchemaWrite: PendingWrite<Schema> | null = null;
  private pendingDataWrite: PendingWrite<TableData> | null = null;
  private pendingRulesWrite: PendingWrite<RuleDefinition[]> | null = null;

  // Verrou pour éviter les écritures concurrentes
  private writeLocks: Map<string, Promise<void>> = new Map();

  constructor() {
    // Lancer l'initialisation mais ne pas bloquer le constructeur
    this.initPromise = this.initialize();
  }

  /**
   * Vérifie si une entrée de cache est encore valide
   */
  private isCacheValid<T>(cache: CacheEntry<T> | null): boolean {
    if (!cache) return false;
    return Date.now() - cache.timestamp < CACHE_TTL;
  }

  /**
   * Invalide le cache pour un type de données
   */
  invalidateCache(type: 'schema' | 'data' | 'rules' | 'all'): void {
    if (type === 'schema' || type === 'all') this.schemaCache = null;
    if (type === 'data' || type === 'all') this.dataCache = null;
    if (type === 'rules' || type === 'all') this.rulesCache = null;
  }

  /**
   * Acquiert un verrou pour éviter les écritures concurrentes
   */
  private async acquireWriteLock(key: string): Promise<() => void> {
    while (this.writeLocks.has(key)) {
      await this.writeLocks.get(key);
    }
    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    this.writeLocks.set(key, lockPromise);
    return () => {
      this.writeLocks.delete(key);
      releaseLock!();
    };
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) return;
    try {
      await fs.access(STORAGE_DIR);
    } catch {
      await fs.mkdir(STORAGE_DIR, { recursive: true });
    }
    this.isInitialized = true;
  }

  /**
   * Attend que l'initialisation soit terminée avant toute opération
   */
  async ensureReady(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  private async ensureStorageDir(): Promise<void> {
    await this.ensureReady();
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  // ==========================================================================
  // READ OPERATIONS
  // ==========================================================================

  async loadSchema(): Promise<Schema> {
    await this.ensureReady();

    // Vérifier le cache d'abord
    if (this.isCacheValid(this.schemaCache)) {
      return this.schemaCache!.data;
    }

    // Si une écriture est en attente, retourner les données en attente
    if (this.pendingSchemaWrite) {
      return this.pendingSchemaWrite.data;
    }

    try {
      const content = await fs.readFile(SCHEMA_FILE, 'utf-8');
      const rawSchema = JSON.parse(content);
      const schema = normalizeSchema(rawSchema);

      // Mettre en cache
      this.schemaCache = { data: schema, timestamp: Date.now() };
      return schema;
    } catch (error) {
      return this.getDefaultSchema();
    }
  }

  async loadData(): Promise<TableData> {
    await this.ensureReady();

    // Vérifier le cache d'abord
    if (this.isCacheValid(this.dataCache)) {
      return this.dataCache!.data;
    }

    // Si une écriture est en attente, retourner les données en attente
    if (this.pendingDataWrite) {
      return this.pendingDataWrite.data;
    }

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
      let needsSave = false;

      for (const [tableName, tableData] of Object.entries(data)) {
        let records: any[];

        if (
          typeof tableData === 'object' &&
          tableData !== null &&
          'records' in tableData &&
          Array.isArray(tableData.records)
        ) {
          // Extract the records array
          records = tableData.records;
        } else if (Array.isArray(tableData)) {
          // Already in the correct format
          records = tableData;
        } else {
          // Keep as is
          transformedData[tableName] = tableData;
          continue;
        }

        // Ajouter des ids aux enregistrements qui n'en ont pas
        transformedData[tableName] = records.map((record) => {
          if (!record.id) {
            needsSave = true;
            return { ...record, id: uuidv4() };
          }
          return record;
        });
      }

      // Sauvegarder si des ids ont été ajoutés
      if (needsSave) {
        await this.saveData(transformedData);
      }

      // Mettre en cache
      this.dataCache = { data: transformedData, timestamp: Date.now() };
      return transformedData;
    } catch (error) {
      return {};
    }
  }

  async loadRules(): Promise<RuleDefinition[]> {
    await this.ensureReady();

    // Vérifier le cache d'abord
    if (this.isCacheValid(this.rulesCache)) {
      return this.rulesCache!.data;
    }

    // Si une écriture est en attente, retourner les données en attente
    if (this.pendingRulesWrite) {
      return this.pendingRulesWrite.data;
    }

    try {
      const content = await fs.readFile(RULES_FILE, 'utf-8');
      const parsed = JSON.parse(content);

      let rules: RuleDefinition[] = [];

      // Support multiple formats
      if (Array.isArray(parsed.rules)) {
        rules = parsed.rules;
      } else if (Array.isArray(parsed)) {
        rules = parsed;
      }

      // Mettre en cache
      this.rulesCache = { data: rules, timestamp: Date.now() };
      return rules;
    } catch (error) {
      return [];
    }
  }

  async loadAudit(): Promise<AuditEvent[]> {
    await this.ensureReady();
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

  /**
   * Sauvegarde le schéma avec debouncing
   * @param schema Le schéma à sauvegarder
   * @param immediate Si true, écrit immédiatement sans debouncing
   */
  async saveSchema(schema: Schema, immediate = false): Promise<void> {
    await this.ensureStorageDir();

    // Mettre à jour le cache immédiatement
    this.schemaCache = { data: schema, timestamp: Date.now() };

    if (immediate) {
      // Annuler le debounce en cours si présent
      if (this.pendingSchemaWrite?.timer) {
        clearTimeout(this.pendingSchemaWrite.timer);
        this.pendingSchemaWrite = null;
      }
      await this.writeSchemaToFile(schema);
      return;
    }

    // Debouncing: retarder l'écriture
    return new Promise((resolve, reject) => {
      // Annuler le timer précédent
      if (this.pendingSchemaWrite?.timer) {
        clearTimeout(this.pendingSchemaWrite.timer);
      }

      const timer = setTimeout(async () => {
        try {
          await this.writeSchemaToFile(schema);
          this.pendingSchemaWrite = null;
          resolve();
        } catch (error) {
          this.pendingSchemaWrite = null;
          reject(error);
        }
      }, DEBOUNCE_DELAY);

      this.pendingSchemaWrite = { data: schema, timer, resolve, reject };
    });
  }

  private async writeSchemaToFile(schema: Schema): Promise<void> {
    const release = await this.acquireWriteLock('schema');
    try {
      await fs.writeFile(SCHEMA_FILE, JSON.stringify(schema, null, 2), 'utf-8');
    } finally {
      release();
    }
  }

  /**
   * Sauvegarde les données avec debouncing
   * @param data Les données à sauvegarder
   * @param immediate Si true, écrit immédiatement sans debouncing
   */
  async saveData(data: TableData, immediate = false): Promise<void> {
    await this.ensureStorageDir();

    // Mettre à jour le cache immédiatement
    this.dataCache = { data, timestamp: Date.now() };

    if (immediate) {
      // Annuler le debounce en cours si présent
      if (this.pendingDataWrite?.timer) {
        clearTimeout(this.pendingDataWrite.timer);
        this.pendingDataWrite = null;
      }
      await this.writeDataToFile(data);
      return;
    }

    // Debouncing: retarder l'écriture
    return new Promise((resolve, reject) => {
      // Annuler le timer précédent
      if (this.pendingDataWrite?.timer) {
        clearTimeout(this.pendingDataWrite.timer);
      }

      const timer = setTimeout(async () => {
        try {
          await this.writeDataToFile(data);
          this.pendingDataWrite = null;
          resolve();
        } catch (error) {
          this.pendingDataWrite = null;
          reject(error);
        }
      }, DEBOUNCE_DELAY);

      this.pendingDataWrite = { data, timer, resolve, reject };
    });
  }

  private async writeDataToFile(data: TableData): Promise<void> {
    const release = await this.acquireWriteLock('data');
    try {
      const dataStore = {
        updatedAt: new Date().toISOString(),
        data,
      };
      await fs.writeFile(DATA_FILE, JSON.stringify(dataStore, null, 2), 'utf-8');
    } finally {
      release();
    }
  }

  /**
   * Sauvegarde les règles avec debouncing
   * @param rules Les règles à sauvegarder
   * @param immediate Si true, écrit immédiatement sans debouncing
   */
  async saveRules(rules: RuleDefinition[], immediate = false): Promise<void> {
    await this.ensureStorageDir();

    // Mettre à jour le cache immédiatement
    this.rulesCache = { data: rules, timestamp: Date.now() };

    if (immediate) {
      // Annuler le debounce en cours si présent
      if (this.pendingRulesWrite?.timer) {
        clearTimeout(this.pendingRulesWrite.timer);
        this.pendingRulesWrite = null;
      }
      await this.writeRulesToFile(rules);
      return;
    }

    // Debouncing: retarder l'écriture
    return new Promise((resolve, reject) => {
      // Annuler le timer précédent
      if (this.pendingRulesWrite?.timer) {
        clearTimeout(this.pendingRulesWrite.timer);
      }

      const timer = setTimeout(async () => {
        try {
          await this.writeRulesToFile(rules);
          this.pendingRulesWrite = null;
          resolve();
        } catch (error) {
          this.pendingRulesWrite = null;
          reject(error);
        }
      }, DEBOUNCE_DELAY);

      this.pendingRulesWrite = { data: rules, timer, resolve, reject };
    });
  }

  private async writeRulesToFile(rules: RuleDefinition[]): Promise<void> {
    const release = await this.acquireWriteLock('rules');
    try {
      const rulesStore = {
        version: '1.0.0',
        updatedAt: new Date().toISOString(),
        rules,
      };
      await fs.writeFile(RULES_FILE, JSON.stringify(rulesStore, null, 2), 'utf-8');
    } finally {
      release();
    }
  }

  /**
   * Force l'écriture de toutes les données en attente
   */
  async flush(): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.pendingSchemaWrite) {
      if (this.pendingSchemaWrite.timer) {
        clearTimeout(this.pendingSchemaWrite.timer);
      }
      promises.push(this.writeSchemaToFile(this.pendingSchemaWrite.data));
      this.pendingSchemaWrite = null;
    }

    if (this.pendingDataWrite) {
      if (this.pendingDataWrite.timer) {
        clearTimeout(this.pendingDataWrite.timer);
      }
      promises.push(this.writeDataToFile(this.pendingDataWrite.data));
      this.pendingDataWrite = null;
    }

    if (this.pendingRulesWrite) {
      if (this.pendingRulesWrite.timer) {
        clearTimeout(this.pendingRulesWrite.timer);
      }
      promises.push(this.writeRulesToFile(this.pendingRulesWrite.data));
      this.pendingRulesWrite = null;
    }

    await Promise.all(promises);
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

    // Invalider le cache correspondant au fichier écrit
    if (filename === 'schema.json') {
      this.schemaCache = null;
    } else if (filename === 'data.json') {
      this.dataCache = null;
    } else if (filename === 'rules.json') {
      this.rulesCache = null;
    }
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
