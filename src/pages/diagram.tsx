import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import { Schema, RelationDefinition } from '@/types/schema';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { getTables, getRelations } from '@/lib/data-helpers';
import { GitBranch, ArrowRight, Trash2, Link2 } from 'lucide-react';
import { fetchWithCacheBusting } from '@/lib/cache-helper';

export default function ERDiagram() {
  const [schema, setSchema] = useState<Schema | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSchema();
  }, []);

  useEffect(() => {
    if (schema) {
      buildDiagram();
    }
  }, [schema]);

  const loadSchema = async () => {
    try {
      const res = await fetchWithCacheBusting('/api/state');
      const state = await res.json();
      setSchema(state.schema);
      setLoading(false);
    } catch (error) {
      console.error('Erreur de chargement:', error);
      setLoading(false);
    }
  };

  const buildDiagram = () => {
    if (!schema) return;

    const tables = getTables(schema);
    const relations = getRelations(schema);

    const newNodes: Node[] = tables.map((table, index) => {
      const x = 100 + (index % 3) * 350;
      const y = 100 + Math.floor(index / 3) * 250;

      return {
        id: table.name,
        type: 'default',
        data: {
          label: (
            <div className="p-3 min-w-[200px]">
              <div className="font-bold text-sm mb-3 text-dark-800 flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-primary-100 flex items-center justify-center">
                  <span className="text-xs text-primary-600">T</span>
                </div>
                {table.label || table.name}
              </div>
              <div className="text-xs space-y-1.5">
                {table.fields.slice(0, 5).map((field) => (
                  <div key={field.name} className="flex items-center justify-between">
                    <span className={`${field.required ? 'font-semibold text-dark-700' : 'text-dark-600'}`}>
                      {field.name}
                    </span>
                    <span className="text-dark-400 text-[10px] bg-dark-100 px-1.5 py-0.5 rounded">
                      {field.type}
                    </span>
                  </div>
                ))}
                {table.fields.length > 5 && (
                  <div className="text-dark-400 text-[10px] pt-1 border-t border-dark-100">
                    +{table.fields.length - 5} autres champs
                  </div>
                )}
              </div>
            </div>
          ),
        },
        position: { x, y },
        style: {
          background: '#fff',
          border: '2px solid #3b82f6',
          borderRadius: '12px',
          width: 'auto',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        },
      };
    });

    const newEdges: Edge[] = relations.map((relation) => ({
      id: relation.id,
      source: relation.fromTable,
      target: relation.toTable,
      label: `${relation.cardinality}`,
      type: 'smoothstep',
      animated: true,
      markerEnd: {
        type: MarkerType.ArrowClosed,
      },
      style: {
        stroke: '#6366f1',
        strokeWidth: 2,
      },
      labelStyle: {
        fill: '#6366f1',
        fontWeight: 600,
        fontSize: 12,
      },
      labelBgStyle: {
        fill: '#f0f9ff',
        fillOpacity: 0.9,
      },
    }));

    setNodes(newNodes);
    setEdges(newEdges);
  };

  const onConnect = useCallback(
    (params: Connection) => {
      if (schema && params.source && params.target) {
        const newRelation: RelationDefinition = {
          id: `rel_${Date.now()}`,
          fromTable: params.source,
          fromField: 'id',
          toTable: params.target,
          toField: 'id',
          cardinality: '1-n',
        };

        const updatedSchema = {
          ...schema,
          relations: [...schema.relations, newRelation],
        };

        saveSchema(updatedSchema);
      }

      setEdges((eds) => addEdge(params, eds));
    },
    [schema, setEdges]
  );

  const saveSchema = async (newSchema: Schema) => {
    try {
      await fetch('/api/apply-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RELATION_CREATE',
          target: { type: 'relation', ref: 'relations' },
          before: schema,
          after: newSchema,
          reason: 'Relation created via ER diagram',
        }),
      });
      setSchema(newSchema);
    } catch (error) {
      console.error('Erreur de sauvegarde:', error);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-dark-500">Chargement du diagramme...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const relations = schema ? getRelations(schema) : [];

  return (
    <Layout>
      <div className="animate-fade-in">
        {/* Hero Section */}
        <div className="card p-8 mb-8 gradient-hero text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">ER Diagram</h1>
              <p className="text-primary-200">
                Visualisez et gérez les relations entre vos tables
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-3xl font-bold">{relations.length}</div>
                <div className="text-primary-200 text-sm">Relations</div>
              </div>
            </div>
          </div>
        </div>

        {/* Diagram */}
        <div className="card overflow-hidden mb-6" style={{ height: '600px' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
          >
            <Controls className="!rounded-xl !overflow-hidden !shadow-soft" />
            <Background color="#e2e8f0" gap={16} />
          </ReactFlow>
        </div>

        {/* Relations list */}
        {relations.length > 0 && (
          <div className="card">
            <div className="p-4 border-b border-dark-100">
              <h3 className="font-semibold text-dark-800 flex items-center gap-2">
                <Link2 size={18} />
                Relations configurées
              </h3>
            </div>
            <div className="divide-y divide-dark-100">
              {relations.map((rel) => (
                <div
                  key={rel.id}
                  className="p-4 flex items-center justify-between hover:bg-dark-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-primary-50 px-3 py-2 rounded-lg">
                      <code className="text-sm font-mono text-primary-700">
                        {rel.fromTable}
                      </code>
                      <span className="text-dark-400">.</span>
                      <code className="text-sm font-mono text-primary-600">
                        {rel.fromField}
                      </code>
                    </div>
                    <ArrowRight className="text-dark-400" size={20} />
                    <div className="flex items-center gap-2 bg-accent-50 px-3 py-2 rounded-lg">
                      <code className="text-sm font-mono text-accent-700">
                        {rel.toTable}
                      </code>
                      <span className="text-dark-400">.</span>
                      <code className="text-sm font-mono text-accent-600">
                        {rel.toField}
                      </code>
                    </div>
                    <span className="badge badge-primary ml-2">
                      {rel.cardinality}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-dark-500">
                      onDelete: <code className="font-mono">{rel.onDelete || 'restrict'}</code>
                    </span>
                    <button className="btn btn-ghost p-2 text-red-500 hover:bg-red-50">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {relations.length === 0 && (
          <div className="card p-12 text-center">
            <div className="w-16 h-16 bg-dark-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <GitBranch className="w-8 h-8 text-dark-400" />
            </div>
            <h3 className="text-lg font-semibold text-dark-700 mb-2">
              Aucune relation
            </h3>
            <p className="text-dark-500">
              Glissez une connexion entre deux tables pour créer une relation
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
