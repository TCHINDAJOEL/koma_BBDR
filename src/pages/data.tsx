import { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import { Schema, TableData, DataRecord, TableDefinition, FieldDefinition } from '@/types/schema';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { useForm } from 'react-hook-form';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Edit2, Trash2, X, Search, Settings, Undo, Database } from 'lucide-react';
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
              className="text-blue-600 hover:text-blue-800 p-1"
              title="Éditer"
            >
              <Edit2 size={16} />
            </button>
            <button
              onClick={() => onDeleteRecord(params.data)}
              className="text-red-600 hover:text-red-800 p-1"
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
      // Save current state to history before making changes
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
      // Save current state to history before making changes
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

    // Remove field data from all records
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

    // Rename field in all records
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
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500">Chargement...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="h-full flex flex-col">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Data Enrichment</h2>
            <p className="text-gray-600 mt-2">
              Gérez les données de vos tables avec validation automatique
            </p>
          </div>
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
              history.length === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gray-600 text-white hover:bg-gray-700'
            }`}
            title="Annuler la dernière action"
          >
            <Undo size={18} />
            <span>Annuler</span>
          </button>
        </div>

        <div className="flex gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher une table..."
              value={tableSearchQuery}
              onChange={(e) => setTableSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={selectedTable || ''}
            onChange={(e) => setSelectedTable(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Sélectionner une table...</option>
            {filteredTables.map((t) => (
              <option key={t.name} value={t.name}>
                {t.label || t.name}
              </option>
            ))}
          </select>

          {selectedTable && (
            <>
              <button
                onClick={onAddRecord}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus size={18} />
                <span>Ajouter</span>
              </button>
              <button
                onClick={() => setShowFieldManager(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <Settings size={18} />
                <span>Gérer les champs</span>
              </button>
            </>
          )}
        </div>

        {selectedTable && table && (
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Rechercher dans les enregistrements..."
                value={recordSearchQuery}
                onChange={(e) => setRecordSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {selectedTable && table && (
          <div className="flex-1 bg-white rounded-lg shadow overflow-hidden">
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
        )}

        {showForm && table && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">
                  {editingRecord ? 'Éditer' : 'Ajouter'} un enregistrement
                </h3>
                <button onClick={() => setShowForm(false)}>
                  <X size={24} className="text-gray-500 hover:text-gray-700" />
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {table.fields.map((field) => (
                  <div key={field.name}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.label || field.name}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>

                    {field.type === 'boolean' ? (
                      <input
                        type="checkbox"
                        {...register(field.name)}
                        className="h-4 w-4"
                      />
                    ) : field.type === 'enum' && field.enumValues ? (
                      <select
                        {...register(field.name, { required: field.required })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    ) : field.type === 'date' || field.type === 'datetime' ? (
                      <input
                        type={field.type === 'date' ? 'date' : 'datetime-local'}
                        {...register(field.name, { required: field.required })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    )}

                    {field.description && (
                      <p className="text-xs text-gray-500 mt-1">{field.description}</p>
                    )}
                  </div>
                ))}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingRecord ? 'Mettre à jour' : 'Créer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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

// Field Manager Modal Component
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-3xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-800">
            Gérer les champs - {table.label || table.name}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {/* Add Field Section */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-semibold text-gray-700 mb-3">Ajouter un nouveau champ</h4>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Nom du champ"
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={newFieldType}
              onChange={(e) => setNewFieldType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        {/* Fields List */}
        <div>
          <h4 className="font-semibold text-gray-700 mb-3">Champs existants</h4>
          <div className="space-y-2">
            {table.fields.map((field) => (
              <div
                key={field.name}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
              >
                <div className="flex-1">
                  {renamingField === field.name ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder={field.name}
                        className="flex-1 px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                      <button
                        onClick={() => handleRename(field.name)}
                        className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        OK
                      </button>
                      <button
                        onClick={() => {
                          setRenamingField(null);
                          setNewName('');
                        }}
                        className="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="font-medium text-gray-800">
                        {field.label || field.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        Type: {field.type}
                        {field.required && ' • Requis'}
                        {field.unique && ' • Unique'}
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
                      className="p-2 text-blue-600 hover:bg-blue-100 rounded"
                      title="Renommer"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => onDeleteField(field.name)}
                      className="p-2 text-red-600 hover:bg-red-100 rounded"
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

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
