import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Schema, TableDefinition } from '@/types/schema';
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
  Database
} from 'lucide-react';
import { getTables, findTable } from '@/lib/data-helpers';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

export default function SchemaExplorer() {
  const [schema, setSchema] = useState<Schema | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [jsonMode, setJsonMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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

  const tables = getTables(schema);
  const filteredTables = searchQuery
    ? tables.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.label?.toLowerCase() || '').includes(searchQuery.toLowerCase())
      )
    : tables;
  const table = selectedTable ? findTable(schema, selectedTable) : null;

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
                <div className="text-3xl font-bold">{tables.length}</div>
                <div className="text-primary-200 text-sm">Tables</div>
              </div>
              <div className="w-px h-12 bg-white/20"></div>
              <div className="text-right">
                <div className="text-3xl font-bold">
                  {tables.reduce((acc, t) => acc + t.fields.length, 0)}
                </div>
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

        {jsonMode ? (
          <div className="card overflow-hidden">
            <div className="h-[600px]">
              <MonacoEditor
                height="100%"
                defaultLanguage="json"
                value={JSON.stringify(schema, null, 2)}
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
            <div className="p-4 border-t border-dark-100 bg-dark-50">
              <button
                onClick={handleSaveJson}
                className="btn btn-primary"
              >
                Sauvegarder les modifications
              </button>
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
                    <button className="btn btn-ghost p-2">
                      <Plus size={18} className="text-primary-600" />
                    </button>
                  </div>
                </div>
                <div className="max-h-[600px] overflow-y-auto">
                  {filteredTables.length === 0 ? (
                    <div className="p-8 text-center text-dark-500">
                      Aucune table trouvée
                    </div>
                  ) : (
                    <div className="divide-y divide-dark-100">
                      {filteredTables.map((t) => (
                        <button
                          key={t.name}
                          onClick={() => setSelectedTable(t.name)}
                          className={`w-full text-left p-4 transition-all duration-200 hover:bg-dark-50 flex items-center justify-between group ${
                            selectedTable === t.name
                              ? 'bg-primary-50 border-l-4 border-primary-500'
                              : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              selectedTable === t.name
                                ? 'bg-primary-100 text-primary-600'
                                : 'bg-dark-100 text-dark-500 group-hover:bg-primary-100 group-hover:text-primary-600'
                            }`}>
                              <Table size={20} />
                            </div>
                            <div>
                              <div className={`font-medium ${
                                selectedTable === t.name ? 'text-primary-700' : 'text-dark-800'
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
                            className={`transition-transform ${
                              selectedTable === t.name
                                ? 'text-primary-500'
                                : 'text-dark-300 group-hover:translate-x-1'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Table details */}
            <div className="lg:col-span-2">
              {table ? (
                <div className="card animate-fade-in">
                  {/* Header */}
                  <div className="p-6 border-b border-dark-100">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-dark-900 mb-1">
                          {table.label || table.name}
                        </h2>
                        {table.description && (
                          <p className="text-dark-500">{table.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost p-2">
                          <Edit2 size={18} />
                        </button>
                        <button className="btn btn-ghost p-2 text-red-500 hover:bg-red-50">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    {/* Meta badges */}
                    <div className="flex flex-wrap gap-2 mt-4">
                      {table.primaryKey && (
                        <span className="badge badge-primary flex items-center gap-1">
                          <Key size={12} />
                          PK: {Array.isArray(table.primaryKey) ? table.primaryKey.join(', ') : table.primaryKey}
                        </span>
                      )}
                      {table.owner && (
                        <span className="badge badge-gray flex items-center gap-1">
                          <User size={12} />
                          {table.owner}
                        </span>
                      )}
                      {table.sensitivity && (
                        <span className="badge badge-warning flex items-center gap-1">
                          <Shield size={12} />
                          {table.sensitivity}
                        </span>
                      )}
                      {table.status && (
                        <span className="badge badge-accent flex items-center gap-1">
                          <Clock size={12} />
                          {table.status}
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
                          <th className="px-6 py-3 text-center">Requis</th>
                          <th className="px-6 py-3 text-center">Unique</th>
                          <th className="px-6 py-3 text-left">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {table.fields.map((field, index) => (
                          <tr
                            key={field.name}
                            className={`hover:bg-dark-50 transition-colors ${
                              index % 2 === 0 ? 'bg-white' : 'bg-dark-50/50'
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
                              {field.required ? (
                                <span className="inline-flex w-6 h-6 items-center justify-center bg-green-100 text-green-600 rounded-full text-xs font-bold">
                                  ✓
                                </span>
                              ) : (
                                <span className="text-dark-300">—</span>
                              )}
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
    </Layout>
  );
}
