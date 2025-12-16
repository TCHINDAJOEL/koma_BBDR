import { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '@/components/Layout';
import { Schema, TableDefinition, FieldDefinition, ValidationAlert, ApplyChangeResponse } from '@/types/schema';
import dynamic from 'next/dynamic';
import {
  Edit2,
  Plus,
  Trash2,
  Code,
  Table,
  Key,
  User,
  Shield,
  Clock,
  ChevronRight,
  Search,
  Layers,
  Database,
  X,
  Save,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { getTables, findTable } from '@/lib/data-helpers';
import { fetchWithCacheBusting } from '@/lib/cache-helper';
import { useToast } from '@/components/Toast';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

export default function SchemaExplorer() {
  const [schema, setSchema] = useState<Schema | null>(null);
  const [pendingSchema, setPendingSchema] = useState<Schema | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [jsonMode, setJsonMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<ValidationAlert[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);

  // Hook pour les notifications
  const toast = useToast();

  // Modal states
  const [showTableModal, setShowTableModal] = useState(false);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [editingTable, setEditingTable] = useState<TableDefinition | null>(null);
  const [editingField, setEditingField] = useState<FieldDefinition | null>(null);

  useEffect(() => {
    loadSchema();
  }, []);

  const loadSchema = async () => {
    try {
      // Vérifier si on doit forcer le rechargement via les paramètres URL
      const urlParams = new URLSearchParams(window.location.search);
      const shouldReload = urlParams.get('reload') === 'true';

      const res = await fetchWithCacheBusting(
        shouldReload ? '/api/state?reload=true' : '/api/state'
      );
      const state = await res.json();
      setSchema(state.schema);
      setPendingSchema(null);
      setLoading(false);

      // Nettoyer les paramètres URL après le rechargement
      if (shouldReload) {
        window.history.replaceState({}, '', '/');
      }
    } catch (error) {
      console.error('Erreur de chargement:', error);
      setLoading(false);
    }
  };

  const saveSchema = async (newSchema: Schema): Promise<boolean> => {
    setSaving(true);
    setAlerts([]);
    try {
      // S'assurer que le schéma a tous les champs requis
      const schemaToSave = {
        ...newSchema,
        version: newSchema.version || '1.0.0',
        updatedAt: new Date().toISOString(),
        relations: newSchema.relations || [],
        tables: newSchema.tables.map(t => ({
          ...t,
          fields: t.fields || [],
          primaryKey: t.primaryKey || 'id',
        })),
      };

      const res = await fetch('/api/apply-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SCHEMA_UPDATE',
          target: { type: 'schema', ref: 'schema.json' },
          before: schema,
          after: schemaToSave,
          reason: 'Manual schema update',
        }),
      });

      // Vérifier si la réponse est du JSON valide
      const text = await res.text();
      let result: ApplyChangeResponse;
      try {
        result = JSON.parse(text);
      } catch (parseError) {
        console.error('Erreur de parsing JSON:', text);
        toast.error('Erreur serveur', 'La réponse du serveur est invalide');
        return false;
      }

      // Toujours afficher les alertes retournées
      if (result.alerts && result.alerts.length > 0) {
        setAlerts(result.alerts);
        setShowAlerts(true);
      }

      if (result.success) {
        // Mettre à jour l'état local SEULEMENT si le backend a réussi
        setSchema(result.newState?.schema || schemaToSave);
        setPendingSchema(null);
        toast.success('Schéma sauvegardé', 'Les modifications ont été enregistrées');
        return true;
      } else {
        // En cas d'erreur, ne pas mettre à jour l'état local
        console.error('Erreur de sauvegarde:', result.alerts);
        const errorMsg = result.alerts?.[0]?.message || 'Erreur de validation';
        toast.error('Erreur de sauvegarde', errorMsg);
        return false;
      }
    } catch (error: any) {
      console.error('Erreur de sauvegarde:', error);
      toast.error('Erreur réseau', error.message || 'Impossible de contacter le serveur');
      setAlerts([{
        severity: 'error',
        code: 'NETWORK_ERROR',
        location: '/api/apply-change',
        message: `Erreur réseau lors de la sauvegarde: ${error.message || 'Erreur inconnue'}`,
      }]);
      setShowAlerts(true);
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Table CRUD operations
  const handleAddTable = () => {
    setEditingTable(null);
    setShowTableModal(true);
  };

  const handleEditTable = (table: TableDefinition) => {
    setEditingTable(table);
    setShowTableModal(true);
  };

  const handleDeleteTable = async (tableName: string) => {
    if (!schema || !confirm(`Supprimer la table "${tableName}" et toutes ses données ?`)) return;

    const newSchema = {
      ...schema,
      tables: schema.tables.filter(t => t.name !== tableName),
      relations: schema.relations.filter(r => r.fromTable !== tableName && r.toTable !== tableName)
    };

    const success = await saveSchema(newSchema);
    if (success) {
      toast.success('Table supprimée', `La table "${tableName}" a été supprimée`);
      if (selectedTable === tableName) {
        setSelectedTable(null);
      }
    }
  };

  const handleSaveTable = async (tableData: { name: string; label: string; description: string; primaryKey: string }) => {
    if (!schema) return;

    let success = false;

    if (editingTable) {
      // Update existing table
      const newSchema = {
        ...schema,
        tables: schema.tables.map(t =>
          t.name === editingTable.name
            ? { ...t, name: tableData.name, label: tableData.label, description: tableData.description, primaryKey: tableData.primaryKey }
            : t
        )
      };
      success = await saveSchema(newSchema);
      if (success) {
        toast.success('Table modifiée', `La table "${tableData.name}" a été mise à jour`);
        if (selectedTable === editingTable.name) {
          setSelectedTable(tableData.name);
        }
      }
    } else {
      // Create new table
      const newTable: TableDefinition = {
        name: tableData.name,
        label: tableData.label,
        description: tableData.description,
        primaryKey: tableData.primaryKey || 'id',
        fields: [
          { name: tableData.primaryKey || 'id', type: 'integer', required: false }
        ]
      };
      const newSchema = {
        ...schema,
        tables: [...schema.tables, newTable]
      };
      success = await saveSchema(newSchema);
      if (success) {
        toast.success('Table créée', `La table "${tableData.name}" a été ajoutée`);
      }
    }

    if (success) {
      setShowTableModal(false);
    }
  };

  // Field CRUD operations
  const handleAddField = () => {
    setEditingField(null);
    setShowFieldModal(true);
  };

  const handleEditField = (field: FieldDefinition) => {
    setEditingField(field);
    setShowFieldModal(true);
  };

  const handleDeleteField = async (fieldName: string) => {
    if (!schema || !selectedTable || !confirm(`Supprimer le champ "${fieldName}" ?`)) return;

    const table = findTable(schema, selectedTable);
    if (!table) return;

    const newSchema = {
      ...schema,
      tables: schema.tables.map(t =>
        t.name === selectedTable
          ? { ...t, fields: t.fields.filter(f => f.name !== fieldName) }
          : t
      )
    };

    await saveSchema(newSchema);
  };

  const handleSaveField = async (fieldData: FieldDefinition) => {
    if (!schema || !selectedTable) return;

    const table = findTable(schema, selectedTable);
    if (!table) return;

    let newFields: FieldDefinition[];
    if (editingField) {
      newFields = table.fields.map(f =>
        f.name === editingField.name ? fieldData : f
      );
    } else {
      newFields = [...table.fields, fieldData];
    }

    const newSchema = {
      ...schema,
      tables: schema.tables.map(t =>
        t.name === selectedTable ? { ...t, fields: newFields } : t
      )
    };

    await saveSchema(newSchema);
    setShowFieldModal(false);
  };

  const validateJsonSchema = useCallback((value: string): { valid: boolean; schema?: Schema; error?: string } => {
    try {
      const parsed = JSON.parse(value);

      // Validation structurelle de base
      if (typeof parsed !== 'object' || parsed === null) {
        return { valid: false, error: 'Le JSON doit être un objet' };
      }
      if (!parsed.version || typeof parsed.version !== 'string') {
        return { valid: false, error: 'Le champ "version" est requis et doit être une chaîne' };
      }
      if (!parsed.tables || !Array.isArray(parsed.tables)) {
        return { valid: false, error: 'Le champ "tables" est requis et doit être un tableau' };
      }
      if (!parsed.relations || !Array.isArray(parsed.relations)) {
        return { valid: false, error: 'Le champ "relations" est requis et doit être un tableau' };
      }

      // Validation des tables
      for (const table of parsed.tables) {
        if (!table.name || typeof table.name !== 'string') {
          return { valid: false, error: `Chaque table doit avoir un nom (string)` };
        }
        if (!table.fields || !Array.isArray(table.fields)) {
          return { valid: false, error: `La table "${table.name}" doit avoir un champ "fields" (tableau)` };
        }
        if (!table.primaryKey) {
          return { valid: false, error: `La table "${table.name}" doit avoir une primaryKey` };
        }
      }

      return { valid: true, schema: parsed as Schema };
    } catch (e: any) {
      return { valid: false, error: `JSON invalide: ${e.message}` };
    }
  }, []);

  const handleJsonChange = useCallback((value: string | undefined) => {
    if (!value) return;

    const result = validateJsonSchema(value);
    if (result.valid && result.schema) {
      setPendingSchema(result.schema);
      setJsonError(null);
    } else {
      setJsonError(result.error || 'JSON invalide');
      // Ne pas mettre à jour pendingSchema si invalide
    }
  }, [validateJsonSchema]);

  const handleSaveJson = async () => {
    if (pendingSchema) {
      const success = await saveSchema(pendingSchema);
      if (success) {
        setJsonMode(false);
        setJsonError(null);
      }
    } else if (schema && !jsonError) {
      // Si aucune modification n'a été faite, juste fermer le mode JSON
      setJsonMode(false);
    }
  };

  const handleExitJsonMode = () => {
    setJsonMode(false);
    setPendingSchema(null);
    setJsonError(null);
  };

  // Pagination
  const TABLES_PER_PAGE = 20;
  const FIELDS_PER_PAGE = 50;
  const [tablePage, setTablePage] = useState(0);
  const [fieldPage, setFieldPage] = useState(0);

  // Reset pagination when search changes
  useEffect(() => {
    setTablePage(0);
  }, [searchQuery]);

  // Reset field pagination when selected table changes
  useEffect(() => {
    setFieldPage(0);
  }, [selectedTable]);

  // Mémoïsation des calculs coûteux
  const tables = useMemo(() => {
    if (!schema) return [];
    return getTables(schema);
  }, [schema]);

  const filteredTables = useMemo(() => {
    if (!searchQuery) return tables;
    const query = searchQuery.toLowerCase();
    return tables.filter(t =>
      t.name.toLowerCase().includes(query) ||
      (t.label?.toLowerCase() || '').includes(query)
    );
  }, [tables, searchQuery]);

  const paginatedTables = useMemo(() => {
    const start = tablePage * TABLES_PER_PAGE;
    return filteredTables.slice(start, start + TABLES_PER_PAGE);
  }, [filteredTables, tablePage]);

  const totalTablePages = useMemo(() => {
    return Math.ceil(filteredTables.length / TABLES_PER_PAGE);
  }, [filteredTables.length]);

  const tableStats = useMemo(() => ({
    totalTables: tables.length,
    totalFields: tables.reduce((acc, t) => acc + t.fields.length, 0),
  }), [tables]);

  const currentTable = useMemo(() => {
    if (!selectedTable || !schema) return null;
    return findTable(schema, selectedTable);
  }, [schema, selectedTable]);

  const paginatedFields = useMemo(() => {
    if (!currentTable) return [];
    const start = fieldPage * FIELDS_PER_PAGE;
    return currentTable.fields.slice(start, start + FIELDS_PER_PAGE);
  }, [currentTable, fieldPage]);

  const totalFieldPages = useMemo(() => {
    if (!currentTable) return 0;
    return Math.ceil(currentTable.fields.length / FIELDS_PER_PAGE);
  }, [currentTable]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-dark-500">Chargement du schéma...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!schema) {
    return (
      <Layout>
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Database className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-xl font-semibold text-dark-800 mb-2">Erreur de chargement</h3>
          <p className="text-dark-500">Impossible de charger le schéma</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="animate-fade-in">
        {/* Hero Section */}
        <div className="card p-8 mb-8 gradient-hero text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Schema Explorer</h1>
              <p className="text-primary-200">
                Explorez et gérez la structure de votre base de données
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-3xl font-bold">{tableStats.totalTables}</div>
                <div className="text-primary-200 text-sm">Tables</div>
              </div>
              <div className="w-px h-12 bg-white/20"></div>
              <div className="text-right">
                <div className="text-3xl font-bold">{tableStats.totalFields}</div>
                <div className="text-primary-200 text-sm">Champs</div>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={20} />
            <input
              type="text"
              placeholder="Rechercher une table..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input input-with-icon"
            />
          </div>
          <button
            onClick={() => setJsonMode(!jsonMode)}
            className={`btn ${jsonMode ? 'btn-primary' : 'btn-secondary'} gap-2`}
          >
            <Code size={18} />
            <span>{jsonMode ? 'Mode UI' : 'Mode JSON'}</span>
          </button>
        </div>

        {/* Affichage des alertes de validation */}
        {showAlerts && alerts.length > 0 && (
          <div className="mb-6 card overflow-hidden">
            <div className="p-4 border-b border-dark-100 bg-dark-50 flex items-center justify-between">
              <h3 className="font-semibold text-dark-800 flex items-center gap-2">
                <AlertCircle size={18} />
                Alertes de validation ({alerts.length})
              </h3>
              <button
                onClick={() => setShowAlerts(false)}
                className="btn btn-ghost p-2"
              >
                <XCircle size={18} />
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-dark-100">
              {alerts.map((alert, index) => (
                <div
                  key={index}
                  className={`p-3 flex items-start gap-3 ${
                    alert.severity === 'error' ? 'bg-red-50' :
                    alert.severity === 'warn' ? 'bg-yellow-50' : 'bg-blue-50'
                  }`}
                >
                  {alert.severity === 'error' ? (
                    <XCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                  ) : alert.severity === 'warn' ? (
                    <AlertCircle size={18} className="text-yellow-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-dark-800">{alert.message}</div>
                    <div className="text-xs text-dark-500 mt-1">
                      <code>{alert.location}</code> - {alert.code}
                    </div>
                    {alert.suggestion && (
                      <div className="text-xs text-dark-600 mt-1 italic">{alert.suggestion}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {jsonMode ? (
          <div className="card overflow-hidden">
            <div className="h-[600px]">
              <MonacoEditor
                height="100%"
                defaultLanguage="json"
                value={JSON.stringify(pendingSchema || schema, null, 2)}
                onChange={handleJsonChange}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  padding: { top: 16 },
                  scrollBeyondLastLine: false,
                }}
              />
            </div>
            {jsonError && (
              <div className="p-3 bg-red-50 border-t border-red-200 flex items-center gap-2">
                <XCircle size={18} className="text-red-500" />
                <span className="text-sm text-red-700">{jsonError}</span>
              </div>
            )}
            <div className="p-4 border-t border-dark-100 bg-dark-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {pendingSchema && !jsonError && (
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle size={14} />
                    Modifications en attente
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExitJsonMode}
                  className="btn btn-secondary"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveJson}
                  disabled={!!jsonError || saving || (!pendingSchema && !schema)}
                  className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Sauvegarde...' : 'Sauvegarder les modifications'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tables list */}
            <div className="lg:col-span-1">
              <div className="card">
                <div className="p-4 border-b border-dark-100">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-dark-800 flex items-center gap-2">
                      <Layers size={18} />
                      Tables
                    </h3>
                    <button onClick={handleAddTable} className="btn btn-ghost p-2" title="Ajouter une table">
                      <Plus size={18} className="text-primary-600" />
                    </button>
                  </div>
                </div>
                <div className="max-h-[500px] overflow-y-auto">
                  {filteredTables.length === 0 ? (
                    <div className="p-8 text-center text-dark-500">
                      Aucune table trouvée
                    </div>
                  ) : (
                    <div className="divide-y divide-dark-100">
                      {paginatedTables.map((t) => (
                        <button
                          key={t.name}
                          onClick={() => setSelectedTable(t.name)}
                          className={`w-full text-left p-4 transition-all duration-200 hover:bg-dark-50 flex items-center justify-between group ${selectedTable === t.name
                            ? 'bg-primary-50 border-l-4 border-primary-500'
                            : ''
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedTable === t.name
                              ? 'bg-primary-100 text-primary-600'
                              : 'bg-dark-100 text-dark-500 group-hover:bg-primary-100 group-hover:text-primary-600'
                              }`}>
                              <Table size={20} />
                            </div>
                            <div>
                              <div className={`font-medium ${selectedTable === t.name ? 'text-primary-700' : 'text-dark-800'
                                }`}>
                                {t.label || t.name}
                              </div>
                              <div className="text-xs text-dark-500">
                                {t.fields.length} champs
                              </div>
                            </div>
                          </div>
                          <ChevronRight
                            size={18}
                            className={`transition-transform ${selectedTable === t.name
                              ? 'text-primary-500'
                              : 'text-dark-300 group-hover:translate-x-1'
                              }`}
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Pagination des tables */}
                {totalTablePages > 1 && (
                  <div className="p-3 border-t border-dark-100 bg-dark-50 flex items-center justify-between">
                    <span className="text-xs text-dark-500">
                      {filteredTables.length} table{filteredTables.length > 1 ? 's' : ''}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setTablePage(p => Math.max(0, p - 1))}
                        disabled={tablePage === 0}
                        className="btn btn-ghost p-1 disabled:opacity-50"
                      >
                        <ChevronRight size={16} className="rotate-180" />
                      </button>
                      <span className="text-xs text-dark-600">
                        {tablePage + 1} / {totalTablePages}
                      </span>
                      <button
                        onClick={() => setTablePage(p => Math.min(totalTablePages - 1, p + 1))}
                        disabled={tablePage >= totalTablePages - 1}
                        className="btn btn-ghost p-1 disabled:opacity-50"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Table details */}
            <div className="lg:col-span-2">
              {currentTable ? (
                <div className="card animate-fade-in">
                  {/* Header */}
                  <div className="p-6 border-b border-dark-100">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-dark-900 mb-1">
                          {currentTable.label || currentTable.name}
                        </h2>
                        {currentTable.description && (
                          <p className="text-dark-500">{currentTable.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleEditTable(currentTable!)} className="btn btn-ghost p-2" title="Éditer la table">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => handleDeleteTable(currentTable!.name)} className="btn btn-ghost p-2 text-red-500 hover:bg-red-50" title="Supprimer la table">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    {/* Meta badges */}
                    <div className="flex flex-wrap gap-2 mt-4">
                      {currentTable.primaryKey && (
                        <span className="badge badge-primary flex items-center gap-1">
                          <Key size={12} />
                          PK: {Array.isArray(currentTable.primaryKey) ? currentTable.primaryKey.join(', ') : currentTable.primaryKey}
                        </span>
                      )}
                      {currentTable.owner && (
                        <span className="badge badge-gray flex items-center gap-1">
                          <User size={12} />
                          {currentTable.owner}
                        </span>
                      )}
                      {currentTable.sensitivity && (
                        <span className="badge badge-warning flex items-center gap-1">
                          <Shield size={12} />
                          {currentTable.sensitivity}
                        </span>
                      )}
                      {currentTable.status && (
                        <span className="badge badge-accent flex items-center gap-1">
                          <Clock size={12} />
                          {currentTable.status}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Fields table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="table-header">
                          <th className="px-6 py-3 text-left">Nom</th>
                          <th className="px-6 py-3 text-left">Type</th>
                          <th className="px-6 py-3 text-center">Unique</th>
                          <th className="px-6 py-3 text-left">Description</th>
                          <th className="px-6 py-3 text-center">
                            <button onClick={handleAddField} className="btn btn-ghost p-1" title="Ajouter un champ">
                              <Plus size={16} className="text-primary-600" />
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedFields.map((field, index) => (
                          <tr
                            key={field.name}
                            className={`hover:bg-dark-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-dark-50/50'
                              }`}
                          >
                            <td className="table-cell">
                              <code className="text-sm font-mono text-dark-700">
                                {field.name}
                              </code>
                            </td>
                            <td className="table-cell">
                              <span className="badge badge-primary">
                                {field.type}
                              </span>
                            </td>
                            <td className="table-cell text-center">
                              {field.unique ? (
                                <span className="inline-flex w-6 h-6 items-center justify-center bg-accent-100 text-accent-600 rounded-full text-xs font-bold">
                                  ✓
                                </span>
                              ) : (
                                <span className="text-dark-300">—</span>
                              )}
                            </td>
                            <td className="table-cell text-dark-600 text-sm">
                              {field.description || '—'}
                            </td>
                            <td className="table-cell text-center">
                              <div className="flex gap-1 justify-center">
                                <button onClick={() => handleEditField(field)} className="p-1 text-primary-600 hover:bg-primary-50 rounded" title="Éditer">
                                  <Edit2 size={14} />
                                </button>
                                <button onClick={() => handleDeleteField(field.name)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Supprimer">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination des champs */}
                  {totalFieldPages > 1 && (
                    <div className="p-3 border-t border-dark-100 bg-dark-50 flex items-center justify-between">
                      <span className="text-xs text-dark-500">
                        {currentTable.fields.length} champ{currentTable.fields.length > 1 ? 's' : ''}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setFieldPage(p => Math.max(0, p - 1))}
                          disabled={fieldPage === 0}
                          className="btn btn-ghost p-1 disabled:opacity-50"
                        >
                          <ChevronRight size={16} className="rotate-180" />
                        </button>
                        <span className="text-xs text-dark-600">
                          {fieldPage + 1} / {totalFieldPages}
                        </span>
                        <button
                          onClick={() => setFieldPage(p => Math.min(totalFieldPages - 1, p + 1))}
                          disabled={fieldPage >= totalFieldPages - 1}
                          className="btn btn-ghost p-1 disabled:opacity-50"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="card h-[600px] flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-dark-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Table className="w-8 h-8 text-dark-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-dark-700 mb-2">
                      Sélectionnez une table
                    </h3>
                    <p className="text-dark-500">
                      Cliquez sur une table pour voir ses détails
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Table Modal */}
      {showTableModal && (
        <TableModal
          table={editingTable}
          onSave={handleSaveTable}
          onClose={() => setShowTableModal(false)}
        />
      )}

      {/* Field Modal */}
      {showFieldModal && (
        <FieldModal
          field={editingField}
          onSave={handleSaveField}
          onClose={() => setShowFieldModal(false)}
        />
      )}
    </Layout>
  );
}

// Table Modal Component
interface TableModalProps {
  table: TableDefinition | null;
  onSave: (data: { name: string; label: string; description: string; primaryKey: string }) => void;
  onClose: () => void;
}

function TableModal({ table, onSave, onClose }: TableModalProps) {
  const [name, setName] = useState(table?.name || '');
  const [label, setLabel] = useState(table?.label || '');
  const [description, setDescription] = useState(table?.description || '');
  const [primaryKey, setPrimaryKey] = useState(
    table?.primaryKey
      ? (Array.isArray(table.primaryKey) ? table.primaryKey[0] : table.primaryKey)
      : 'id'
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name, label: label || name, description, primaryKey: primaryKey || 'id' });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content w-full max-w-lg p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-dark-900">
            {table ? 'Modifier la table' : 'Nouvelle table'}
          </h3>
          <button onClick={onClose} className="p-2 text-dark-500 hover:bg-dark-100 rounded-lg">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-700 mb-1">
              Nom technique <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.replace(/\s/g, '_').toLowerCase())}
              className="input"
              placeholder="ma_table"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 mb-1">
              Libellé
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="input"
              placeholder="Ma Table"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input"
              rows={3}
              placeholder="Description de la table..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 mb-1">
              Clé primaire
            </label>
            <input
              type="text"
              value={primaryKey}
              onChange={(e) => setPrimaryKey(e.target.value)}
              className="input"
              placeholder="id"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-dark-100">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Annuler
            </button>
            <button type="submit" className="btn btn-primary gap-2">
              <Save size={18} />
              {table ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Field Modal Component
interface FieldModalProps {
  field: FieldDefinition | null;
  onSave: (data: FieldDefinition) => void;
  onClose: () => void;
}

function FieldModal({ field, onSave, onClose }: FieldModalProps) {
  const [name, setName] = useState(field?.name || '');
  const [type, setType] = useState<string>(field?.type || 'string');
  const [label, setLabel] = useState(field?.label || '');
  const [description, setDescription] = useState(field?.description || '');
  const [unique, setUnique] = useState(field?.unique || false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name,
      type: type as any,
      label: label || name,
      description,
      required: false, // Toujours non obligatoire
      unique,
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content w-full max-w-lg p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-dark-900">
            {field ? 'Modifier le champ' : 'Nouveau champ'}
          </h3>
          <button onClick={onClose} className="p-2 text-dark-500 hover:bg-dark-100 rounded-lg">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-700 mb-1">
                Nom <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.replace(/\s/g, '_').toLowerCase())}
                className="input"
                placeholder="mon_champ"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-700 mb-1">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="select"
              >
                <option value="string">Texte</option>
                <option value="number">Nombre</option>
                <option value="integer">Entier</option>
                <option value="boolean">Booléen</option>
                <option value="date">Date</option>
                <option value="datetime">Date/Heure</option>
                <option value="enum">Énumération</option>
                <option value="json">JSON</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 mb-1">
              Libellé
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="input"
              placeholder="Mon Champ"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input"
              rows={2}
              placeholder="Description du champ..."
            />
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={unique}
                onChange={(e) => setUnique(e.target.checked)}
                className="h-5 w-5 rounded border-dark-300 text-primary-600"
              />
              <span className="text-sm text-dark-700">Unique</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-dark-100">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Annuler
            </button>
            <button type="submit" className="btn btn-primary gap-2">
              <Save size={18} />
              {field ? 'Mettre à jour' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
