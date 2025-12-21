import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Schema,
  TableData,
  DataRecord,
  ValidationAlert,
  RuleDefinition,
} from '@/types/schema';
import { fetchWithCacheBusting, updateCacheVersion } from './cache-helper';
import { generateRecordId, normalizeRecord } from './record-helpers';
import { findTable, getTableData, getTables } from './data-helpers';

// ============================================================================
// TYPES
// ============================================================================

export interface AppState {
  schema: Schema | null;
  data: TableData;
  rules: RuleDefinition[];
}

export interface UseAppStateReturn {
  // État
  schema: Schema | null;
  data: TableData;
  rules: RuleDefinition[];
  loading: boolean;
  error: string | null;

  // Alertes de validation
  alerts: ValidationAlert[];
  setAlerts: (alerts: ValidationAlert[]) => void;
  clearAlerts: () => void;
  addAlert: (alert: ValidationAlert) => void;

  // Mutations pour les records
  createRecord: (
    tableName: string,
    record: Omit<DataRecord, 'id'>
  ) => Promise<DataRecord | null>;
  updateRecord: (
    tableName: string,
    recordId: string,
    updates: Partial<DataRecord>
  ) => Promise<DataRecord | null>;
  deleteRecord: (tableName: string, recordId: string) => Promise<boolean>;
  upsertRecords: (
    tableName: string,
    records: DataRecord[]
  ) => Promise<boolean>;

  // Mutations pour le schéma
  updateSchema: (newSchema: Schema, reason?: string) => Promise<boolean>;

  // Rafraîchissement
  refresh: (forceReload?: boolean) => Promise<void>;
  invalidateTable: (tableName: string) => void;

  // Helpers
  getTable: (tableName: string) => ReturnType<typeof findTable>;
  getRecords: (tableName: string) => DataRecord[];
  tables: ReturnType<typeof getTables>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useAppState(): UseAppStateReturn {
  // État principal
  const [schema, setSchema] = useState<Schema | null>(null);
  const [data, setData] = useState<TableData>({});
  const [rules, setRules] = useState<RuleDefinition[]>([]);

  // État de chargement et erreurs
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Alertes de validation
  const [alerts, setAlerts] = useState<ValidationAlert[]>([]);

  // ============================================================================
  // CHARGEMENT INITIAL
  // ============================================================================

  const loadState = useCallback(async (forceReload = false) => {
    try {
      setLoading(true);
      setError(null);

      const url = forceReload ? '/api/state?reload=true' : '/api/state';
      const res = await fetchWithCacheBusting(url);

      if (!res.ok) {
        throw new Error(`Erreur HTTP: ${res.status}`);
      }

      const state: AppState = await res.json();

      setSchema(state.schema);
      setData(state.data || {});
      setRules(state.rules || []);
    } catch (err: any) {
      console.error('Erreur de chargement:', err);
      setError(err.message || 'Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  // ============================================================================
  // GESTION DES ALERTES
  // ============================================================================

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  const addAlert = useCallback((alert: ValidationAlert) => {
    setAlerts((prev) => [...prev, alert]);
  }, []);

  // ============================================================================
  // MUTATIONS CRUD RECORDS
  // ============================================================================

  const createRecord = useCallback(
    async (
      tableName: string,
      recordData: Omit<DataRecord, 'id'>
    ): Promise<DataRecord | null> => {
      if (!schema) {
        addAlert({
          severity: 'error',
          code: 'NO_SCHEMA',
          location: '/app',
          message: 'Schéma non chargé',
        });
        return null;
      }

      const table = findTable(schema, tableName);
      if (!table) {
        addAlert({
          severity: 'error',
          code: 'TABLE_NOT_FOUND',
          location: `/table/${tableName}`,
          message: `Table ${tableName} non trouvée`,
        });
        return null;
      }

      const newRecord: DataRecord = {
        id: generateRecordId(),
        ...recordData,
      };

      // Normaliser le record
      const normalizedRecord = normalizeRecord(newRecord, table.fields);

      // Construire les nouvelles données
      const currentRecords = getTableData(data, tableName);
      const newData = {
        ...data,
        [tableName]: [...currentRecords, normalizedRecord],
      };

      try {
        const response = await fetch('/api/apply-change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'DATA_UPSERT',
            target: { type: 'record', ref: `${tableName}/${normalizedRecord.id}` },
            before: data,
            after: newData,
            reason: 'Record creation via useAppState',
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          setAlerts(result.alerts || []);
          return null;
        }

        // Mettre à jour l'état local
        setData(newData);
        updateCacheVersion();

        // Propager les alertes (warnings/infos)
        if (result.alerts && result.alerts.length > 0) {
          setAlerts(result.alerts);
        }

        return normalizedRecord;
      } catch (err: any) {
        addAlert({
          severity: 'error',
          code: 'NETWORK_ERROR',
          location: '/api/apply-change',
          message: err.message || 'Erreur réseau',
        });
        return null;
      }
    },
    [schema, data, addAlert]
  );

  const updateRecord = useCallback(
    async (
      tableName: string,
      recordId: string,
      updates: Partial<DataRecord>
    ): Promise<DataRecord | null> => {
      if (!schema) {
        addAlert({
          severity: 'error',
          code: 'NO_SCHEMA',
          location: '/app',
          message: 'Schéma non chargé',
        });
        return null;
      }

      const table = findTable(schema, tableName);
      if (!table) {
        addAlert({
          severity: 'error',
          code: 'TABLE_NOT_FOUND',
          location: `/table/${tableName}`,
          message: `Table ${tableName} non trouvée`,
        });
        return null;
      }

      const currentRecords = getTableData(data, tableName);
      const existingRecord = currentRecords.find((r) => r.id === recordId);

      if (!existingRecord) {
        addAlert({
          severity: 'error',
          code: 'RECORD_NOT_FOUND',
          location: `/data/${tableName}/${recordId}`,
          message: `Enregistrement ${recordId} non trouvé`,
        });
        return null;
      }

      const updatedRecord: DataRecord = {
        ...existingRecord,
        ...updates,
        id: recordId, // S'assurer que l'ID ne change pas
      };

      // Normaliser le record
      const normalizedRecord = normalizeRecord(updatedRecord, table.fields);

      const newData = {
        ...data,
        [tableName]: currentRecords.map((r) =>
          r.id === recordId ? normalizedRecord : r
        ),
      };

      try {
        const response = await fetch('/api/apply-change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'DATA_UPSERT',
            target: { type: 'record', ref: `${tableName}/${recordId}` },
            before: data,
            after: newData,
            reason: 'Record update via useAppState',
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          setAlerts(result.alerts || []);
          return null;
        }

        setData(newData);
        updateCacheVersion();

        if (result.alerts && result.alerts.length > 0) {
          setAlerts(result.alerts);
        }

        return normalizedRecord;
      } catch (err: any) {
        addAlert({
          severity: 'error',
          code: 'NETWORK_ERROR',
          location: '/api/apply-change',
          message: err.message || 'Erreur réseau',
        });
        return null;
      }
    },
    [schema, data, addAlert]
  );

  const deleteRecord = useCallback(
    async (tableName: string, recordId: string): Promise<boolean> => {
      const currentRecords = getTableData(data, tableName);
      const newData = {
        ...data,
        [tableName]: currentRecords.filter((r) => r.id !== recordId),
      };

      try {
        const response = await fetch('/api/apply-change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'DATA_DELETE',
            target: { type: 'record', ref: `${tableName}/${recordId}` },
            before: data,
            after: newData,
            reason: 'Record deletion via useAppState',
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          setAlerts(result.alerts || []);
          return false;
        }

        setData(newData);
        updateCacheVersion();

        if (result.alerts && result.alerts.length > 0) {
          setAlerts(result.alerts);
        }

        return true;
      } catch (err: any) {
        addAlert({
          severity: 'error',
          code: 'NETWORK_ERROR',
          location: '/api/apply-change',
          message: err.message || 'Erreur réseau',
        });
        return false;
      }
    },
    [data, addAlert]
  );

  const upsertRecords = useCallback(
    async (tableName: string, records: DataRecord[]): Promise<boolean> => {
      if (!schema) {
        addAlert({
          severity: 'error',
          code: 'NO_SCHEMA',
          location: '/app',
          message: 'Schéma non chargé',
        });
        return false;
      }

      const table = findTable(schema, tableName);
      if (!table) {
        addAlert({
          severity: 'error',
          code: 'TABLE_NOT_FOUND',
          location: `/table/${tableName}`,
          message: `Table ${tableName} non trouvée`,
        });
        return false;
      }

      const currentRecords = getTableData(data, tableName);
      const recordMap = new Map(currentRecords.map((r) => [r.id, r]));

      // Upsert: mise à jour ou insertion
      records.forEach((record) => {
        const normalizedRecord = normalizeRecord(
          { ...record, id: record.id || generateRecordId() },
          table.fields
        );
        recordMap.set(normalizedRecord.id, normalizedRecord);
      });

      const newData = {
        ...data,
        [tableName]: Array.from(recordMap.values()),
      };

      try {
        const response = await fetch('/api/apply-change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'DATA_UPSERT',
            target: { type: 'record', ref: tableName },
            before: data,
            after: newData,
            reason: 'Batch upsert via useAppState',
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          setAlerts(result.alerts || []);
          return false;
        }

        setData(newData);
        updateCacheVersion();

        if (result.alerts && result.alerts.length > 0) {
          setAlerts(result.alerts);
        }

        return true;
      } catch (err: any) {
        addAlert({
          severity: 'error',
          code: 'NETWORK_ERROR',
          location: '/api/apply-change',
          message: err.message || 'Erreur réseau',
        });
        return false;
      }
    },
    [schema, data, addAlert]
  );

  // ============================================================================
  // MUTATIONS SCHÉMA
  // ============================================================================

  const updateSchema = useCallback(
    async (newSchema: Schema, reason = 'Schema update via useAppState'): Promise<boolean> => {
      try {
        const response = await fetch('/api/apply-change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'SCHEMA_UPDATE',
            target: { type: 'schema', ref: 'schema' },
            before: schema,
            after: newSchema,
            reason,
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          setAlerts(result.alerts || []);
          return false;
        }

        setSchema(newSchema);
        updateCacheVersion();

        if (result.alerts && result.alerts.length > 0) {
          setAlerts(result.alerts);
        }

        return true;
      } catch (err: any) {
        addAlert({
          severity: 'error',
          code: 'NETWORK_ERROR',
          location: '/api/apply-change',
          message: err.message || 'Erreur réseau',
        });
        return false;
      }
    },
    [schema, addAlert]
  );

  // ============================================================================
  // HELPERS
  // ============================================================================

  const refresh = useCallback(
    async (forceReload = false) => {
      await loadState(forceReload);
    },
    [loadState]
  );

  const invalidateTable = useCallback((tableName: string) => {
    updateCacheVersion();
    // Optionnel: recharger seulement les données de cette table
    // Pour l'instant, on invalide juste le cache
  }, []);

  const getTable = useCallback(
    (tableName: string) => findTable(schema, tableName),
    [schema]
  );

  const getRecords = useCallback(
    (tableName: string) => getTableData(data, tableName),
    [data]
  );

  const tables = useMemo(() => getTables(schema), [schema]);

  // ============================================================================
  // RETOUR DU HOOK
  // ============================================================================

  return {
    // État
    schema,
    data,
    rules,
    loading,
    error,

    // Alertes
    alerts,
    setAlerts,
    clearAlerts,
    addAlert,

    // Mutations records
    createRecord,
    updateRecord,
    deleteRecord,
    upsertRecords,

    // Mutations schéma
    updateSchema,

    // Rafraîchissement
    refresh,
    invalidateTable,

    // Helpers
    getTable,
    getRecords,
    tables,
  };
}

export default useAppState;
