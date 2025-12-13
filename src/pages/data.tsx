import { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import { Schema, TableData, DataRecord, TableDefinition, FieldDefinition } from '@/types/schema';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { useForm } from 'react-hook-form';
import { v4 as uuidv4 } from 'uuid';
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Search,
  Settings,
  Undo,
  Database,
  Table,
  Layers
} from 'lucide-react';
import { getTables, findTable, getTableData } from '@/lib/data-helpers';

export default function DataEnrichment() {
  const [schema, setSchema] = useState<Schema | null>(null);
  const [data, setData] = useState<TableData>({});
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DataRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [recordSearchQuery, setRecordSearchQuery] = useState('');
  const [showFieldManager, setShowFieldManager] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const { register, handleSubmit, reset, setValue } = useForm();

  useEffect(() => {
    loadState();
  }, []);

  const loadState = async () => {
    try {
      const res = await fetch('/api/state');
      const state = await res.json();
      setSchema(state.schema);
      setData(state.data);
      setLoading(false);
    } catch (error) {
      console.error('Erreur de chargement:', error);
      setLoading(false);
    }
  };

  const tables = getTables(schema);
  const filteredTables = useMemo(() => {
    if (!tableSearchQuery) return tables;
    const query = tableSearchQuery.toLowerCase();
    return tables.filter((t) =>
      t.name.toLowerCase().includes(query) ||
      (t.label?.toLowerCase() || '').includes(query)
    );
  }, [tables, tableSearchQuery]);

  const table = selectedTable ? findTable(schema, selectedTable) : null;
  const tableData = selectedTable ? getTableData(data, selectedTable) : [];

  const filteredRecords = useMemo(() => {
    if (!recordSearchQuery || !table) return tableData;
    const query = recordSearchQuery.toLowerCase();
    return tableData.filter((record) => {
      return Object.values(record).some((value) =>
        String(value).toLowerCase().includes(query)
      );
    });
  }, [tableData, recordSearchQuery, table]);

  const columnDefs = useMemo(() => {
    if (!table) return [];

    const fieldColumns = table.fields.map((field) => ({
      field: field.name,
      headerName: field.label || field.name,
      editable: false,
      filter: true,
      sortable: true,
    }));

    const actionColumn = {
      headerName: 'Actions',
      field: 'actions',
      cellRenderer: (params: any) => {
        return (
          <div className="flex gap-2 items-center h-full">
            <button
              onClick={() => onEditRecord(params.data)}
              className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              title="Éditer"
            >
              <Edit2 size={16} />
            </button>
            <button
              onClick={() => onDeleteRecord(params.data)}
              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Supprimer"
            >
              <Trash2 size={16} />
            </button>
          </div>
        );
      },
      width: 100,
      pinned: 'right' as const,
      sortable: false,
      filter: false,
    };

    return [...fieldColumns, actionColumn];
  }, [table]);

  const onAddRecord = () => {
    setEditingRecord(null);
    reset();
    setShowForm(true);
  };

  const onEditRecord = (record: DataRecord) => {
    setEditingRecord(record);
    Object.keys(record).forEach((key) => {
      setValue(key, record[key]);
    });
    setShowForm(true);
  };

  const onDeleteRecord = async (record: DataRecord) => {
    if (!selectedTable || !confirm('Supprimer cet enregistrement ?')) return;

    const newData = {
      ...data,
      [selectedTable]: tableData.filter((r) => r.id !== record.id),
    };

    await saveData(newData);
  };

  const onSubmit = async (formData: any) => {
    if (!selectedTable || !table) return;

    const record: DataRecord = {
      id: editingRecord?.id || uuidv4(),
      ...formData,
    };

    const newTableData = editingRecord
      ? tableData.map((r) => (r.id === record.id ? record : r))
      : [...tableData, record];

    const newData = {
      ...data,
      [selectedTable]: newTableData,
    };

    await saveData(newData);
    setShowForm(false);
    reset();
  };

  const saveData = async (newData: TableData) => {
    try {
      setHistory([...history, { schema, data }]);

      await fetch('/api/apply-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DATA_UPSERT',
          target: { type: 'record', ref: selectedTable || 'unknown' },
          before: data,
          after: newData,
          reason: 'Data enrichment',
        }),
      });
      setData(newData);
    } catch (error) {
      console.error('Erreur de sauvegarde:', error);
    }
  };

  const saveSchema = async (newSchema: Schema) => {
    try {
      setHistory([...history, { schema, data }]);

      await fetch('/api/apply-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SCHEMA_UPDATE',
          target: { type: 'schema', ref: 'schema' },
          before: schema,
          after: newSchema,
          reason: 'Schema modification',
        }),
      });
      setSchema(newSchema);
    } catch (error) {
      console.error('Erreur de sauvegarde du schéma:', error);
    }
  };

  const handleUndo = () => {
    if (history.length === 0) return;

    const previousState = history[history.length - 1];
    setSchema(previousState.schema);
    setData(previousState.data);
    setHistory(history.slice(0, -1));
  };

  const onAddField = async (fieldName: string, fieldType: string) => {
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

    await saveSchema(newSchema);
  };

  const onDeleteField = async (fieldName: string) => {
    if (!table || !schema || !confirm(`Supprimer le champ "${fieldName}" ?`)) return;

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

    const newTableData = tableData.map((record) => {
      const { [fieldName]: removed, ...rest } = record;
      return rest;
    });

    const newData = {
      ...data,
      [selectedTable!]: newTableData,
    };

    await saveSchema(newSchema);
    setData(newData);
  };

  const onRenameField = async (oldName: string, newName: string) => {
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

    const newTableData = tableData.map((record) => {
      const { [oldName]: value, ...rest } = record;
      return { ...rest, [newName]: value };
    });

    const newData = {
      ...data,
      [selectedTable!]: newTableData,
    };

    await saveSchema(newSchema);
    setData(newData);
  };

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
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-3xl font-bold">{Object.values(data).reduce((acc, arr) => acc + arr.length, 0)}</div>
                <div className="text-primary-200 text-sm">Enregistrements</div>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex-1 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={20} />
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
              onChange={(e) => setSelectedTable(e.target.value)}
              className="select max-w-xs"
            >
              <option value="">Sélectionner une table...</option>
              {filteredTables.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.label || t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            {selectedTable && (
              <>
                <button
                  onClick={onAddRecord}
                  className="btn btn-primary gap-2"
                >
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
                history.length === 0 ? 'btn-ghost opacity-50 cursor-not-allowed' : 'btn-secondary'
              }`}
              title="Annuler la dernière action"
            >
              <Undo size={18} />
              <span className="hidden sm:inline">Annuler</span>
            </button>
          </div>
        </div>

        {selectedTable && table && (
          <div className="mb-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={20} />
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

        {/* Record Form Modal */}
        {showForm && table && (
          <div className="modal-overlay">
            <div className="modal-content w-full max-w-2xl p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-dark-900">
                  {editingRecord ? 'Éditer' : 'Ajouter'} un enregistrement
                </h3>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-2 text-dark-500 hover:bg-dark-100 rounded-lg transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {table.fields.map((field) => (
                  <div key={field.name}>
                    <label className="block text-sm font-medium text-dark-700 mb-1.5">
                      {field.label || field.name}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>

                    {field.type === 'boolean' ? (
                      <input
                        type="checkbox"
                        {...register(field.name)}
                        className="h-5 w-5 rounded border-dark-300 text-primary-600 focus:ring-primary-500"
                      />
                    ) : field.type === 'enum' && field.enumValues ? (
                      <select
                        {...register(field.name, { required: field.required })}
                        className="select"
                      >
                        <option value="">Sélectionner...</option>
                        {field.enumValues.map((val) => (
                          <option key={val} value={val}>
                            {val}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'number' || field.type === 'integer' ? (
                      <input
                        type="number"
                        step={field.type === 'integer' ? '1' : 'any'}
                        {...register(field.name, {
                          required: field.required,
                          min: field.min,
                          max: field.max,
                        })}
                        className="input"
                      />
                    ) : field.type === 'date' || field.type === 'datetime' ? (
                      <input
                        type={field.type === 'date' ? 'date' : 'datetime-local'}
                        {...register(field.name, { required: field.required })}
                        className="input"
                      />
                    ) : (
                      <input
                        type="text"
                        {...register(field.name, {
                          required: field.required,
                          pattern: field.regex ? new RegExp(field.regex) : undefined,
                          minLength: field.min,
                          maxLength: field.max,
                        })}
                        className="input"
                      />
                    )}

                    {field.description && (
                      <p className="text-xs text-dark-500 mt-1">{field.description}</p>
                    )}
                  </div>
                ))}

                <div className="flex justify-end gap-3 pt-4 border-t border-dark-100">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="btn btn-secondary"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                  >
                    {editingRecord ? 'Mettre à jour' : 'Créer'}
                  </button>
                </div>
              </form>
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
      </div>
    </Layout>
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
          <h4 className="font-semibold text-dark-800 mb-3">Ajouter un nouveau champ</h4>
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
            <button
              onClick={handleAddField}
              className="btn btn-primary"
            >
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
                          {field.required && <span className="badge badge-warning">Requis</span>}
                          {field.unique && <span className="badge badge-accent">Unique</span>}
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
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
