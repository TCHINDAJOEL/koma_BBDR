import { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Layout from '@/components/Layout';
import { DataRecord, TableDefinition, FieldDefinition, ValidationAlert } from '@/types/schema';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Search,
  Settings,
  Undo,
  Layers,
  AlertCircle,
  CheckCircle,
  Info,
  Link2,
  Table,
  GitBranch,
  LayoutGrid,
  History,
} from 'lucide-react';
import { getTableData } from '@/lib/data-helpers';
import useAppState from '@/lib/useAppState';
import RecordForm from '@/components/RecordForm';
import RelatedRecords from '@/components/RelatedRecords';
import AuditPanel from '@/components/AuditPanel';
import { useToast } from '@/components/Toast';

// Import dynamique pour éviter les erreurs SSR avec ReactFlow
const RecordGraph = dynamic(() => import('@/components/RecordGraph'), { ssr: false });

export default function DataEnrichment() {
  // Utiliser le hook centralisé
  const {
    schema,
    data,
    loading,
    error,
    alerts,
    clearAlerts,
    tables,
    createRecord,
    updateRecord,
    deleteRecord,
    updateSchema,
    refresh,
    audit,
  } = useAppState();

  // Hook pour les notifications
  const toast = useToast();

  // État local UI
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DataRecord | null>(null);
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [recordSearchQuery, setRecordSearchQuery] = useState('');
  const [showFieldManager, setShowFieldManager] = useState(false);
  const [showRelations, setShowRelations] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [showGraphView, setShowGraphView] = useState(false);
  const [graphRecord, setGraphRecord] = useState<DataRecord | null>(null);
  const [graphTableName, setGraphTableName] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'graph'>('table');
  const [showAuditPanel, setShowAuditPanel] = useState(false);

  // Tables filtrées
  const filteredTables = useMemo(() => {
    if (!tableSearchQuery) return tables;
    const query = tableSearchQuery.toLowerCase();
    return tables.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        (t.label?.toLowerCase() || '').includes(query)
    );
  }, [tables, tableSearchQuery]);

  // Table et données sélectionnées
  const table = useMemo(
    () => (selectedTable ? tables.find((t) => t.name === selectedTable) : null),
    [selectedTable, tables]
  );

  const tableData = useMemo(
    () => (selectedTable ? getTableData(data, selectedTable) : []),
    [selectedTable, data]
  );

  // Records filtrés
  const filteredRecords = useMemo(() => {
    if (!recordSearchQuery || !table) return tableData;
    const query = recordSearchQuery.toLowerCase();
    return tableData.filter((record) =>
      Object.values(record).some((value) =>
        String(value).toLowerCase().includes(query)
      )
    );
  }, [tableData, recordSearchQuery, table]);

  // Colonnes AgGrid
  const columnDefs = useMemo(() => {
    if (!table) return [];

    // Colonne ID en premier
    const idColumn = {
      field: 'id',
      headerName: 'ID',
      editable: false,
      filter: true,
      sortable: true,
      width: 120,
      pinned: 'left' as const,
      cellRenderer: (params: any) => (
        <span className="font-mono text-xs text-dark-600 bg-dark-50 px-2 py-0.5 rounded">
          {params.value}
        </span>
      ),
    };

    const fieldColumns = table.fields.map((field) => ({
      field: field.name,
      headerName: field.label || field.name,
      editable: false,
      filter: true,
      sortable: true,
      minWidth: 100,
      cellRenderer: (params: any) => {
        const value = params.value;
        if (value === null || value === undefined) {
          return <span className="text-dark-300 italic">-</span>;
        }
        if (typeof value === 'boolean') {
          return (
            <span className={`badge ${value ? 'badge-success' : 'badge-gray'}`}>
              {value ? 'Oui' : 'Non'}
            </span>
          );
        }
        if (field.type === 'date' || field.type === 'datetime') {
          try {
            const date = new Date(value);
            return (
              <span className="text-dark-700">
                {field.type === 'datetime'
                  ? date.toLocaleString('fr-FR')
                  : date.toLocaleDateString('fr-FR')}
              </span>
            );
          } catch {
            return String(value);
          }
        }
        if (field.type === 'number' || field.type === 'integer') {
          return (
            <span className="font-mono text-dark-700">
              {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
            </span>
          );
        }
        if (field.type === 'enum') {
          return <span className="badge badge-primary">{String(value)}</span>;
        }
        if (typeof value === 'object') {
          const jsonStr = JSON.stringify(value);
          return (
            <span className="font-mono text-xs text-dark-500 bg-dark-50 px-1.5 py-0.5 rounded" title={jsonStr}>
              {jsonStr.length > 40 ? jsonStr.substring(0, 40) + '...' : jsonStr}
            </span>
          );
        }
        const strValue = String(value);
        return (
          <span className="text-dark-700" title={strValue.length > 50 ? strValue : undefined}>
            {strValue.length > 50 ? strValue.substring(0, 50) + '...' : strValue}
          </span>
        );
      },
    }));

    const actionColumn = {
      headerName: 'Actions',
      field: 'actions',
      cellRenderer: (params: any) => (
        <div className="flex gap-1 items-center h-full">
          <button
            onClick={() => onEditRecord(params.data)}
            className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            title="Éditer"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => onViewRelations(params.data)}
            className="p-1.5 text-accent-600 hover:bg-accent-50 rounded-lg transition-colors"
            title="Relations"
          >
            <Link2 size={16} />
          </button>
          <button
            onClick={() => onViewGraph(params.data)}
            className="p-1.5 text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
            title="Vue graphique"
          >
            <GitBranch size={16} />
          </button>
          <button
            onClick={() => onDeleteRecord(params.data)}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Supprimer"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
      width: 160,
      pinned: 'right' as const,
      sortable: false,
      filter: false,
    };

    return [idColumn, ...fieldColumns, actionColumn];
  }, [table]);

  // Handlers
  const onAddRecord = useCallback(() => {
    setEditingRecord(null);
    setShowForm(true);
  }, []);

  const onEditRecord = useCallback((record: DataRecord) => {
    setEditingRecord(record);
    setShowForm(true);
  }, []);

  const onViewRelations = useCallback((record: DataRecord) => {
    setEditingRecord(record);
    setShowRelations(true);
  }, []);

  // Ouvrir la vue graphique centrée sur un enregistrement
  const onViewGraph = useCallback((record: DataRecord) => {
    if (!selectedTable) return;
    setGraphRecord(record);
    setGraphTableName(selectedTable);
    setShowGraphView(true);
  }, [selectedTable]);

  const onDeleteRecord = useCallback(
    async (record: DataRecord) => {
      if (!selectedTable || !confirm('Supprimer cet enregistrement ?')) return;

      // Sauvegarder l'état pour undo
      setHistory((prev) => [...prev, { data }]);

      const success = await deleteRecord(selectedTable, record.id);
      if (success) {
        toast.success('Enregistrement supprimé', `ID: ${record.id.slice(0, 8)}...`);
      } else {
        toast.error('Erreur de suppression', 'Vérifiez les alertes pour plus de détails');
        setShowAlerts(true);
      }
    },
    [selectedTable, data, deleteRecord, toast]
  );

  const onSaveRecord = useCallback(
    async (record: DataRecord) => {
      if (!selectedTable) return;

      // Sauvegarder l'état pour undo
      setHistory((prev) => [...prev, { data }]);

      let result;
      if (editingRecord) {
        result = await updateRecord(selectedTable, record.id, record);
      } else {
        result = await createRecord(selectedTable, record);
      }

      if (result) {
        setShowForm(false);
        setEditingRecord(null);
        if (editingRecord) {
          toast.success('Enregistrement mis à jour', `Les modifications ont été sauvegardées`);
        } else {
          toast.success('Enregistrement créé', `ID: ${result.id.slice(0, 8)}...`);
        }
      } else {
        toast.error('Erreur de sauvegarde', 'Vérifiez les alertes pour plus de détails');
        setShowAlerts(true);
      }
    },
    [selectedTable, editingRecord, data, createRecord, updateRecord, toast]
  );

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;

    const previousState = history[history.length - 1];
    // Note: Pour un vrai undo, il faudrait sauvegarder via l'API
    // Pour l'instant, on recharge simplement les données
    refresh(true);
    setHistory((prev) => prev.slice(0, -1));
  }, [history, refresh]);

  // Gestion des champs
  const onAddField = useCallback(
    async (fieldName: string, fieldType: string) => {
      if (!table || !schema) return;

      const newField: FieldDefinition = {
        name: fieldName,
        type: fieldType as any,
        label: fieldName,
        required: false,
      };

      const updatedTable = {
        ...table,
        fields: [...table.fields, newField],
      };

      const newSchema = {
        ...schema,
        tables: schema.tables.map((t) =>
          t.name === selectedTable ? updatedTable : t
        ),
      };

      const success = await updateSchema(newSchema, `Ajout du champ ${fieldName}`);
      if (!success) {
        setShowAlerts(true);
      }
    },
    [table, schema, selectedTable, updateSchema]
  );

  const onDeleteField = useCallback(
    async (fieldName: string) => {
      if (!table || !schema || !confirm(`Supprimer le champ "${fieldName}" ?`))
        return;

      const updatedTable = {
        ...table,
        fields: table.fields.filter((f) => f.name !== fieldName),
      };

      const newSchema = {
        ...schema,
        tables: schema.tables.map((t) =>
          t.name === selectedTable ? updatedTable : t
        ),
      };

      const success = await updateSchema(
        newSchema,
        `Suppression du champ ${fieldName}`
      );
      if (!success) {
        setShowAlerts(true);
      }
    },
    [table, schema, selectedTable, updateSchema]
  );

  const onRenameField = useCallback(
    async (oldName: string, newName: string) => {
      if (!table || !schema) return;

      const updatedTable = {
        ...table,
        fields: table.fields.map((f) =>
          f.name === oldName ? { ...f, name: newName } : f
        ),
      };

      const newSchema = {
        ...schema,
        tables: schema.tables.map((t) =>
          t.name === selectedTable ? updatedTable : t
        ),
      };

      const success = await updateSchema(
        newSchema,
        `Renommage du champ ${oldName} en ${newName}`
      );
      if (!success) {
        setShowAlerts(true);
      }
    },
    [table, schema, selectedTable, updateSchema]
  );

  // Navigation vers un enregistrement lié
  const handleNavigateToRelated = useCallback(
    (tableName: string, recordId: string) => {
      setSelectedTable(tableName);
      setShowRelations(false);

      // Trouver et éditer le record
      const targetData = getTableData(data, tableName);
      const record = targetData.find((r) => r.id === recordId);
      if (record) {
        setEditingRecord(record);
        setShowForm(true);
      }
    },
    [data]
  );

  // Sauvegarde depuis le graphe
  const handleGraphSave = useCallback(
    async (tblName: string, record: DataRecord): Promise<boolean> => {
      setHistory((prev) => [...prev, { data }]);

      const result = await updateRecord(tblName, record.id, record);
      if (!result) {
        setShowAlerts(true);
      }
      return !!result;
    },
    [data, updateRecord]
  );

  // Navigation dans le graphe (changer l'enregistrement central)
  const handleGraphNavigate = useCallback(
    (newTableName: string, recordId: string) => {
      const tableRecords = getTableData(data, newTableName);
      const newRecord = tableRecords.find((r) => r.id === recordId);
      if (newRecord) {
        setGraphRecord(newRecord);
        setGraphTableName(newTableName);
      }
    },
    [data]
  );

  // Fermer la vue graphique
  const handleCloseGraph = useCallback(() => {
    setShowGraphView(false);
    setGraphRecord(null);
    setGraphTableName(null);
  }, []);

  // Statistiques des alertes
  const alertStats = useMemo(() => {
    return {
      errors: alerts.filter((a) => a.severity === 'error').length,
      warnings: alerts.filter((a) => a.severity === 'warn').length,
      infos: alerts.filter((a) => a.severity === 'info').length,
    };
  }, [alerts]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-dark-500">Chargement des données...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600">{error}</p>
            <button
              onClick={() => refresh(true)}
              className="mt-4 btn btn-primary"
            >
              Réessayer
            </button>
          </div>
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
              <h1 className="text-3xl font-bold mb-2">Data Enrichment</h1>
              <p className="text-primary-200">
                Gérez les données de vos tables avec validation automatique
              </p>
            </div>
            <div className="flex items-center gap-6">
              {/* Alertes résumées */}
              {alerts.length > 0 && (
                <button
                  onClick={() => setShowAlerts(!showAlerts)}
                  className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                >
                  {alertStats.errors > 0 && (
                    <span className="flex items-center gap-1 text-red-300">
                      <AlertCircle size={16} />
                      {alertStats.errors}
                    </span>
                  )}
                  {alertStats.warnings > 0 && (
                    <span className="flex items-center gap-1 text-yellow-300">
                      <AlertCircle size={16} />
                      {alertStats.warnings}
                    </span>
                  )}
                  {alertStats.infos > 0 && (
                    <span className="flex items-center gap-1 text-blue-300">
                      <Info size={16} />
                      {alertStats.infos}
                    </span>
                  )}
                </button>
              )}
              <div className="text-right">
                <div className="text-3xl font-bold">
                  {Object.values(data).reduce((acc, arr) => acc + arr.length, 0)}
                </div>
                <div className="text-primary-200 text-sm">Enregistrements</div>
              </div>
            </div>
          </div>
        </div>

        {/* Panneau d'alertes */}
        {showAlerts && alerts.length > 0 && (
          <div className="mb-6 card p-4 border-l-4 border-l-yellow-500">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-dark-800">
                Alertes de validation
              </h3>
              <button
                onClick={() => {
                  clearAlerts();
                  setShowAlerts(false);
                }}
                className="text-dark-400 hover:text-dark-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {alerts.map((alert, index) => (
                <AlertItem key={index} alert={alert} />
              ))}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex-1 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-xs">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400"
                size={20}
              />
              <input
                type="text"
                placeholder="Rechercher une table..."
                value={tableSearchQuery}
                onChange={(e) => setTableSearchQuery(e.target.value)}
                className="input input-with-icon"
              />
            </div>
            <select
              value={selectedTable || ''}
              onChange={(e) => setSelectedTable(e.target.value || null)}
              className="select max-w-xs"
            >
              <option value="">Sélectionner une table...</option>
              {filteredTables.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.label || t.name} ({getTableData(data, t.name).length})
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            {selectedTable && (
              <>
                <button onClick={onAddRecord} className="btn btn-primary gap-2">
                  <Plus size={18} />
                  <span>Ajouter</span>
                </button>
                <button
                  onClick={() => setShowFieldManager(true)}
                  className="btn btn-secondary gap-2"
                >
                  <Settings size={18} />
                  <span>Champs</span>
                </button>
              </>
            )}
            <button
              onClick={handleUndo}
              disabled={history.length === 0}
              className={`btn gap-2 ${
                history.length === 0
                  ? 'btn-ghost opacity-50 cursor-not-allowed'
                  : 'btn-secondary'
              }`}
              title="Annuler la dernière action"
            >
              <Undo size={18} />
              <span className="hidden sm:inline">Annuler</span>
            </button>
            <button
              onClick={() => setShowAuditPanel(true)}
              className="btn btn-secondary gap-2"
              title="Voir l'historique des modifications"
            >
              <History size={18} />
              <span className="hidden sm:inline">Historique</span>
              {audit.length > 0 && (
                <span className="bg-primary-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {audit.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Recherche dans les records */}
        {selectedTable && table && (
          <div className="mb-4">
            <div className="relative max-w-md">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400"
                size={20}
              />
              <input
                type="text"
                placeholder="Rechercher dans les enregistrements..."
                value={recordSearchQuery}
                onChange={(e) => setRecordSearchQuery(e.target.value)}
                className="input input-with-icon"
              />
            </div>
          </div>
        )}

        {/* Grille de données */}
        {selectedTable && table ? (
          <div className="card overflow-hidden" style={{ height: '500px' }}>
            <div className="ag-theme-alpine h-full">
              <AgGridReact
                rowData={filteredRecords}
                columnDefs={columnDefs}
                defaultColDef={{
                  flex: 1,
                  minWidth: 100,
                  resizable: true,
                }}
                pagination={true}
                paginationPageSize={20}
                suppressCellFocus={true}
                onRowDoubleClicked={(e) => onEditRecord(e.data)}
              />
            </div>
          </div>
        ) : (
          <div className="card p-12 text-center">
            <div className="w-16 h-16 bg-dark-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Layers className="w-8 h-8 text-dark-400" />
            </div>
            <h3 className="text-lg font-semibold text-dark-700 mb-2">
              Sélectionnez une table
            </h3>
            <p className="text-dark-500">
              Choisissez une table pour gérer ses données
            </p>
          </div>
        )}

        {/* Modal Formulaire d'édition */}
        {showForm && table && (
          <div className="modal-overlay">
            <div className="modal-content w-full max-w-3xl p-6 animate-fade-in max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-dark-900">
                  {editingRecord ? 'Éditer' : 'Ajouter'} un enregistrement
                </h3>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingRecord(null);
                  }}
                  className="p-2 text-dark-500 hover:bg-dark-100 rounded-lg transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <RecordForm
                table={table}
                record={editingRecord || undefined}
                onSave={onSaveRecord}
                onCancel={() => {
                  setShowForm(false);
                  setEditingRecord(null);
                }}
              />

              {/* Section Relations (en édition) */}
              {editingRecord && schema && (
                <div className="mt-6 pt-6 border-t border-dark-200">
                  <RelatedRecords
                    record={editingRecord}
                    tableName={selectedTable!}
                    schema={schema}
                    data={data}
                    onNavigate={handleNavigateToRelated}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Relations seules */}
        {showRelations && editingRecord && selectedTable && schema && (
          <div className="modal-overlay">
            <div className="modal-content w-full max-w-2xl p-6 animate-fade-in max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-dark-900">
                  Relations de l&apos;enregistrement
                </h3>
                <button
                  onClick={() => {
                    setShowRelations(false);
                    setEditingRecord(null);
                  }}
                  className="p-2 text-dark-500 hover:bg-dark-100 rounded-lg transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Aperçu de l'enregistrement */}
              <div className="mb-6 p-4 bg-dark-50 rounded-xl">
                <div className="text-sm text-dark-500 mb-1">ID</div>
                <div className="font-mono text-dark-800">{editingRecord.id}</div>
              </div>

              <RelatedRecords
                record={editingRecord}
                tableName={selectedTable}
                schema={schema}
                data={data}
                onNavigate={handleNavigateToRelated}
              />

              <div className="flex justify-end mt-6 pt-4 border-t border-dark-100">
                <button
                  onClick={() => {
                    setShowRelations(false);
                    setEditingRecord(null);
                  }}
                  className="btn btn-secondary"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Field Manager Modal */}
        {showFieldManager && table && (
          <FieldManagerModal
            table={table}
            onClose={() => setShowFieldManager(false)}
            onAddField={onAddField}
            onDeleteField={onDeleteField}
            onRenameField={onRenameField}
          />
        )}

        {/* Modal Vue Graphique centrée sur un enregistrement */}
        {showGraphView && graphRecord && graphTableName && schema && (
          <div className="fixed inset-0 z-50 bg-dark-900/80 backdrop-blur-sm">
            <div className="absolute inset-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
              <RecordGraph
                schema={schema}
                data={data}
                record={graphRecord}
                tableName={graphTableName}
                onSaveRecord={handleGraphSave}
                onNavigate={handleGraphNavigate}
                onClose={handleCloseGraph}
              />
            </div>
          </div>
        )}

        {/* Panneau d'audit */}
        {showAuditPanel && (
          <AuditPanel
            audit={audit}
            onClose={() => setShowAuditPanel(false)}
            onRefresh={() => refresh(true)}
          />
        )}
      </div>
    </Layout>
  );
}

// ============================================================================
// COMPOSANTS AUXILIAIRES
// ============================================================================

interface AlertItemProps {
  alert: ValidationAlert;
}

function AlertItem({ alert }: AlertItemProps) {
  const iconClass =
    alert.severity === 'error'
      ? 'text-red-500'
      : alert.severity === 'warn'
      ? 'text-yellow-500'
      : 'text-blue-500';

  const bgClass =
    alert.severity === 'error'
      ? 'bg-red-50'
      : alert.severity === 'warn'
      ? 'bg-yellow-50'
      : 'bg-blue-50';

  return (
    <div className={`flex items-start gap-2 p-2 rounded-lg ${bgClass}`}>
      {alert.severity === 'error' ? (
        <AlertCircle className={`w-4 h-4 mt-0.5 ${iconClass}`} />
      ) : alert.severity === 'warn' ? (
        <AlertCircle className={`w-4 h-4 mt-0.5 ${iconClass}`} />
      ) : (
        <Info className={`w-4 h-4 mt-0.5 ${iconClass}`} />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-dark-800">{alert.message}</div>
        {alert.suggestion && (
          <div className="text-xs text-dark-500 mt-0.5">{alert.suggestion}</div>
        )}
        {alert.location && (
          <div className="text-xs font-mono text-dark-400 mt-0.5">
            {alert.location}
          </div>
        )}
      </div>
    </div>
  );
}

interface FieldManagerModalProps {
  table: TableDefinition;
  onClose: () => void;
  onAddField: (fieldName: string, fieldType: string) => void;
  onDeleteField: (fieldName: string) => void;
  onRenameField: (oldName: string, newName: string) => void;
}

function FieldManagerModal({
  table,
  onClose,
  onAddField,
  onDeleteField,
  onRenameField,
}: FieldManagerModalProps) {
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('string');
  const [renamingField, setRenamingField] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const handleAddField = () => {
    if (!newFieldName.trim()) return;
    onAddField(newFieldName, newFieldType);
    setNewFieldName('');
    setNewFieldType('string');
  };

  const handleRename = (oldName: string) => {
    if (!newName.trim()) return;
    onRenameField(oldName, newName);
    setRenamingField(null);
    setNewName('');
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content w-full max-w-3xl p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-dark-900">
            Gérer les champs — {table.label || table.name}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-dark-500 hover:bg-dark-100 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Add Field Section */}
        <div className="mb-6 p-4 bg-primary-50 rounded-xl border border-primary-100">
          <h4 className="font-semibold text-dark-800 mb-3">
            Ajouter un nouveau champ
          </h4>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Nom du champ"
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
              className="input flex-1"
            />
            <select
              value={newFieldType}
              onChange={(e) => setNewFieldType(e.target.value)}
              className="select w-40"
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
            <button onClick={handleAddField} className="btn btn-primary">
              <Plus size={18} />
            </button>
          </div>
        </div>

        {/* Fields List */}
        <div>
          <h4 className="font-semibold text-dark-800 mb-3">Champs existants</h4>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {table.fields.map((field) => (
              <div
                key={field.name}
                className="flex items-center justify-between p-3 bg-dark-50 rounded-xl hover:bg-dark-100 transition-colors"
              >
                <div className="flex-1">
                  {renamingField === field.name ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder={field.name}
                        className="input flex-1 py-1.5"
                        autoFocus
                      />
                      <button
                        onClick={() => handleRename(field.name)}
                        className="btn btn-primary py-1.5"
                      >
                        OK
                      </button>
                      <button
                        onClick={() => {
                          setRenamingField(null);
                          setNewName('');
                        }}
                        className="btn btn-secondary py-1.5"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                        <Table size={14} className="text-primary-600" />
                      </div>
                      <div>
                        <div className="font-medium text-dark-800">
                          {field.label || field.name}
                        </div>
                        <div className="text-xs text-dark-500 flex items-center gap-2">
                          <span className="badge badge-primary">{field.type}</span>
                          {field.unique && (
                            <span className="badge badge-accent">Unique</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {renamingField !== field.name && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setRenamingField(field.name);
                        setNewName(field.name);
                      }}
                      className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      title="Renommer"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => onDeleteField(field.name)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end mt-6 pt-4 border-t border-dark-100">
          <button onClick={onClose} className="btn btn-secondary">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
