import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Schema, TableDefinition } from '@/types/schema';
import dynamic from 'next/dynamic';
import { Edit2, Plus, Trash2, Code } from 'lucide-react';
import { getTables, findTable } from '@/lib/data-helpers';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

export default function SchemaExplorer() {
  const [schema, setSchema] = useState<Schema | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [jsonMode, setJsonMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSchema();
  }, []);

  const loadSchema = async () => {
    try {
      const res = await fetch('/api/state');
      const state = await res.json();
      setSchema(state.schema);
      setLoading(false);
    } catch (error) {
      console.error('Erreur de chargement:', error);
      setLoading(false);
    }
  };

  const saveSchema = async (newSchema: Schema) => {
    try {
      await fetch('/api/apply-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SCHEMA_UPDATE',
          target: { type: 'schema', ref: 'schema.json' },
          before: schema,
          after: newSchema,
          reason: 'Manual schema update',
        }),
      });
      setSchema(newSchema);
    } catch (error) {
      console.error('Erreur de sauvegarde:', error);
    }
  };

  const handleJsonChange = (value: string | undefined) => {
    if (!value) return;
    try {
      const parsed = JSON.parse(value);
      setSchema(parsed);
    } catch (e) {
      // Invalid JSON, ignore
    }
  };

  const handleSaveJson = () => {
    if (schema) {
      saveSchema(schema);
      setJsonMode(false);
    }
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

  if (!schema) {
    return (
      <Layout>
        <div className="text-center">
          <p className="text-red-500">Erreur de chargement du schéma</p>
        </div>
      </Layout>
    );
  }

  const tables = getTables(schema);
  const table = selectedTable ? findTable(schema, selectedTable) : null;

  return (
    <Layout>
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold text-gray-800">Schema Explorer</h2>
          <button
            onClick={() => setJsonMode(!jsonMode)}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
          >
            <Code size={18} />
            <span>{jsonMode ? 'Mode UI' : 'Mode JSON'}</span>
          </button>
        </div>

        {jsonMode ? (
          <div className="flex-1 flex flex-col">
            <MonacoEditor
              height="100%"
              defaultLanguage="json"
              value={JSON.stringify(schema, null, 2)}
              onChange={handleJsonChange}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
              }}
            />
            <div className="mt-4">
              <button
                onClick={handleSaveJson}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Sauvegarder
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex gap-6">
            {/* Sidebar: Tables list */}
            <div className="w-64 bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-700">Tables</h3>
                <button className="p-1 hover:bg-gray-100 rounded">
                  <Plus size={18} className="text-blue-600" />
                </button>
              </div>
              <ul className="space-y-2">
                {tables.map((t) => (
                  <li key={t.name}>
                    <button
                      onClick={() => setSelectedTable(t.name)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        selectedTable === t.name
                          ? 'bg-blue-100 text-blue-700'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {t.label || t.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Main: Table details */}
            <div className="flex-1 bg-white rounded-lg shadow p-6">
              {table ? (
                <div>
                  <div className="mb-6">
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">{table.label || table.name}</h3>
                    {table.description && (
                      <p className="text-gray-600">{table.description}</p>
                    )}
                  </div>

                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-700 mb-3">Champs</h4>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-200 px-4 py-2 text-left">Nom</th>
                          <th className="border border-gray-200 px-4 py-2 text-left">Type</th>
                          <th className="border border-gray-200 px-4 py-2 text-left">Requis</th>
                          <th className="border border-gray-200 px-4 py-2 text-left">Unique</th>
                          <th className="border border-gray-200 px-4 py-2 text-left">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {table.fields.map((field) => (
                          <tr key={field.name} className="hover:bg-gray-50">
                            <td className="border border-gray-200 px-4 py-2 font-mono text-sm">
                              {field.name}
                            </td>
                            <td className="border border-gray-200 px-4 py-2">
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                                {field.type}
                              </span>
                            </td>
                            <td className="border border-gray-200 px-4 py-2">
                              {field.required ? '✓' : '-'}
                            </td>
                            <td className="border border-gray-200 px-4 py-2">
                              {field.unique ? '✓' : '-'}
                            </td>
                            <td className="border border-gray-200 px-4 py-2 text-sm text-gray-600">
                              {field.description || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-semibold text-gray-700">Clé primaire:</span>
                      <span className="ml-2 font-mono">
                        {Array.isArray(table.primaryKey)
                          ? table.primaryKey.join(', ')
                          : table.primaryKey}
                      </span>
                    </div>
                    {table.owner && (
                      <div>
                        <span className="font-semibold text-gray-700">Propriétaire:</span>
                        <span className="ml-2">{table.owner}</span>
                      </div>
                    )}
                    {table.sensitivity && (
                      <div>
                        <span className="font-semibold text-gray-700">Sensibilité:</span>
                        <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                          {table.sensitivity}
                        </span>
                      </div>
                    )}
                    {table.status && (
                      <div>
                        <span className="font-semibold text-gray-700">Statut:</span>
                        <span className="ml-2">{table.status}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-12">
                  Sélectionnez une table pour voir les détails
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
