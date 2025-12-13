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
      const res = await fetch('/api/state');
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

    // Créer les nodes (tables)
    const newNodes: Node[] = tables.map((table, index) => {
      const x = 100 + (index % 3) * 300;
      const y = 100 + Math.floor(index / 3) * 200;

      return {
        id: table.name,
        type: 'default',
        data: {
          label: (
            <div className="p-2">
              <div className="font-bold text-sm mb-2">{table.label || table.name}</div>
              <div className="text-xs space-y-1">
                {table.fields.slice(0, 5).map((field) => (
                  <div key={field.name} className="flex items-center">
                    <span className={field.required ? 'font-semibold' : ''}>
                      {field.name}
                    </span>
                    <span className="ml-2 text-gray-500">: {field.type}</span>
                  </div>
                ))}
                {table.fields.length > 5 && (
                  <div className="text-gray-400">... +{table.fields.length - 5} champs</div>
                )}
              </div>
            </div>
          ),
        },
        position: { x, y },
        style: {
          background: '#fff',
          border: '2px solid #3b82f6',
          borderRadius: '8px',
          width: 220,
        },
      };
    });

    // Créer les edges (relations)
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
    }));

    setNodes(newNodes);
    setEdges(newEdges);
  };

  const onConnect = useCallback(
    (params: Connection) => {
      // Créer une nouvelle relation
      if (schema && params.source && params.target) {
        const newRelation: RelationDefinition = {
          id: `rel_${Date.now()}`,
          fromTable: params.source,
          fromField: 'id', // Default, should be configured
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
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500">Chargement...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="h-full flex flex-col">
        <div className="mb-4">
          <h2 className="text-3xl font-bold text-gray-800">ER Diagram</h2>
          <p className="text-gray-600 mt-2">
            Visualisez et gérez les relations entre tables. Glissez pour créer une nouvelle relation.
          </p>
        </div>

        <div className="flex-1 bg-white rounded-lg shadow">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
          >
            <Controls />
            <Background />
          </ReactFlow>
        </div>

        {schema && getRelations(schema).length > 0 && (
          <div className="mt-4 bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-gray-700 mb-3">Relations configurées</h3>
            <div className="space-y-2">
              {getRelations(schema).map((rel) => (
                <div key={rel.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="text-sm">
                    <span className="font-mono">{rel.fromTable}.{rel.fromField}</span>
                    <span className="mx-2 text-gray-400">→</span>
                    <span className="font-mono">{rel.toTable}.{rel.toField}</span>
                    <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                      {rel.cardinality}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    onDelete: {rel.onDelete || 'restrict'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
