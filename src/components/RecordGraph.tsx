import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  NodeProps,
  Handle,
  Position,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Schema,
  TableData,
  DataRecord,
  TableDefinition,
} from '@/types/schema';
import { getTableData, getRelations, findTable } from '@/lib/data-helpers';
import { getAllRelatedRecords } from '@/lib/record-helpers';
import {
  Edit2,
  Save,
  ChevronDown,
  ChevronUp,
  Database,
  Star,
  X,
  Navigation,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface RecordGraphProps {
  schema: Schema;
  data: TableData;
  record: DataRecord;
  tableName: string;
  onSaveRecord: (tableName: string, record: DataRecord) => Promise<void>;
  onNavigate?: (tableName: string, recordId: string) => void;
  onClose?: () => void;
}

interface RecordNodeData {
  record: DataRecord;
  table: TableDefinition;
  tableName: string;
  isCenter: boolean;
  isExpanded: boolean;
  isEditing: boolean;
  onToggleExpand: () => void;
  onStartEdit: () => void;
  onSave: (record: DataRecord) => void;
  onCancel: () => void;
  onNavigate?: () => void;
}

// ============================================================================
// CUSTOM NODE - NOEUD CENTRAL (l'enregistrement sélectionné)
// ============================================================================

function CenterRecordNode({ data }: NodeProps<RecordNodeData>) {
  const {
    record,
    table,
    tableName,
    isExpanded,
    isEditing,
    onToggleExpand,
    onStartEdit,
    onSave,
    onCancel,
  } = data;

  const [editedRecord, setEditedRecord] = useState<DataRecord>({ ...record });

  // Reset edited record when record changes (but not during editing)
  useEffect(() => {
    if (!isEditing) {
      setEditedRecord({ ...record });
    }
  }, [record, isEditing]);

  const handleFieldChange = (fieldName: string, value: any) => {
    setEditedRecord((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleSave = () => {
    onSave(editedRecord);
  };

  const handleCancel = () => {
    setEditedRecord({ ...record });
    onCancel();
  };

  const displayFields = isExpanded ? table.fields : table.fields.slice(0, 5);

  return (
    <div
      className={`bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl shadow-2xl border-4 border-primary-300 min-w-[300px] max-w-[400px] ${
        isEditing ? 'ring-4 ring-accent-400' : ''
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-4 h-4 bg-white border-2 border-primary-500"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-4 h-4 bg-white border-2 border-primary-500"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="w-4 h-4 bg-white border-2 border-primary-500"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="w-4 h-4 bg-white border-2 border-primary-500"
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-primary-400">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-300 fill-yellow-300" />
          <span className="text-white font-bold">{table.label || tableName}</span>
        </div>
        <div className="flex items-center gap-1">
          {!isEditing && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartEdit();
              }}
              className="p-1.5 text-primary-200 hover:text-white hover:bg-primary-400 rounded-lg transition-colors"
              title="Éditer"
            >
              <Edit2 size={16} />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="p-1.5 text-primary-200 hover:text-white hover:bg-primary-400 rounded-lg transition-colors"
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* ID */}
      <div className="px-4 py-2 bg-primary-400/50">
        <div className="text-[10px] text-primary-200 uppercase tracking-wide">ID</div>
        <div className="text-sm font-mono font-bold text-white truncate">{record.id}</div>
      </div>

      {/* Champs */}
      <div className="bg-white rounded-b-xl p-4 space-y-3 max-h-[350px] overflow-y-auto">
        {displayFields.map((field) => (
          <div key={field.name}>
            <div className="text-[10px] text-dark-400 uppercase tracking-wide mb-0.5">
              {field.label || field.name}
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </div>
            {isEditing ? (
              <FieldEditor
                field={field}
                value={editedRecord[field.name]}
                onChange={(value) => handleFieldChange(field.name, value)}
              />
            ) : (
              <div className="text-sm text-dark-800 font-medium">
                {formatValue(record[field.name], field.type)}
              </div>
            )}
          </div>
        ))}

        {!isExpanded && table.fields.length > 5 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
          >
            +{table.fields.length - 5} champs...
          </button>
        )}

        {isEditing && (
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-dark-100">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCancel();
              }}
              className="px-3 py-1.5 text-sm text-dark-600 hover:bg-dark-100 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSave();
              }}
              className="px-3 py-1.5 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-1"
            >
              <Save size={14} />
              Sauvegarder
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// CUSTOM NODE - NOEUD LIÉ (les enregistrements connectés)
// ============================================================================

function LinkedRecordNode({ data }: NodeProps<RecordNodeData>) {
  const {
    record,
    table,
    tableName,
    isExpanded,
    isEditing,
    onToggleExpand,
    onStartEdit,
    onSave,
    onCancel,
    onNavigate,
  } = data;

  const [editedRecord, setEditedRecord] = useState<DataRecord>({ ...record });

  useEffect(() => {
    if (!isEditing) {
      setEditedRecord({ ...record });
    }
  }, [record, isEditing]);

  const handleFieldChange = (fieldName: string, value: any) => {
    setEditedRecord((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleSave = () => {
    onSave(editedRecord);
  };

  const handleCancel = () => {
    setEditedRecord({ ...record });
    onCancel();
  };

  const previewFields = table.fields.slice(0, 3);
  const displayFields = isExpanded ? table.fields : previewFields;

  return (
    <div
      className={`bg-white rounded-xl shadow-lg border-2 transition-all min-w-[220px] max-w-[300px] ${
        isEditing ? 'border-accent-500 ring-2 ring-accent-300' : 'border-dark-200 hover:border-accent-300'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-accent-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-accent-500 border-2 border-white"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="w-3 h-3 bg-accent-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="w-3 h-3 bg-accent-500 border-2 border-white"
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-accent-50 rounded-t-xl border-b border-accent-100">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-accent-600" />
          <span className="text-xs font-semibold text-accent-700">{table.label || tableName}</span>
        </div>
        <div className="flex items-center gap-1">
          {!isEditing && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartEdit();
              }}
              className="p-1 text-dark-400 hover:text-accent-600 hover:bg-accent-100 rounded transition-colors"
              title="Éditer"
            >
              <Edit2 size={12} />
            </button>
          )}
          {onNavigate && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNavigate();
              }}
              className="p-1 text-dark-400 hover:text-primary-600 hover:bg-primary-100 rounded transition-colors"
              title="Voir au centre"
            >
              <Navigation size={12} />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="p-1 text-dark-400 hover:text-dark-600 hover:bg-dark-100 rounded transition-colors"
          >
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {/* ID */}
      <div className="px-3 py-2 bg-dark-50 border-b border-dark-100">
        <div className="text-[10px] text-dark-400 uppercase tracking-wide">ID</div>
        <div className="text-xs font-mono font-medium text-dark-700 truncate">{record.id}</div>
      </div>

      {/* Champs */}
      <div className="p-3 space-y-2 max-h-[200px] overflow-y-auto">
        {displayFields.map((field) => (
          <div key={field.name}>
            <div className="text-[9px] text-dark-400 uppercase tracking-wide">
              {field.label || field.name}
            </div>
            {isEditing ? (
              <FieldEditor
                field={field}
                value={editedRecord[field.name]}
                onChange={(value) => handleFieldChange(field.name, value)}
                small
              />
            ) : (
              <div className="text-xs text-dark-700 truncate">
                {formatValue(record[field.name], field.type)}
              </div>
            )}
          </div>
        ))}

        {!isExpanded && table.fields.length > 3 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="text-[10px] text-accent-600 hover:text-accent-700"
          >
            +{table.fields.length - 3} champs
          </button>
        )}

        {isEditing && (
          <div className="flex items-center justify-end gap-1 pt-2 border-t border-dark-100">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCancel();
              }}
              className="px-2 py-1 text-[10px] text-dark-600 hover:bg-dark-100 rounded transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSave();
              }}
              className="px-2 py-1 text-[10px] bg-accent-500 text-white rounded hover:bg-accent-600 transition-colors flex items-center gap-1"
            >
              <Save size={10} />
              Sauver
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// FIELD EDITOR
// ============================================================================

interface FieldEditorProps {
  field: { name: string; type: string; enumValues?: string[] };
  value: any;
  onChange: (value: any) => void;
  small?: boolean;
}

function FieldEditor({ field, value, onChange, small = false }: FieldEditorProps) {
  const inputClass = small
    ? 'w-full text-[10px] px-1.5 py-0.5 border border-dark-200 rounded focus:ring-1 focus:ring-accent-500 focus:outline-none'
    : 'w-full text-xs px-2 py-1 border border-dark-200 rounded focus:ring-1 focus:ring-primary-500 focus:outline-none';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  switch (field.type) {
    case 'boolean':
      return (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          onClick={handleClick}
          className={small ? 'h-3 w-3' : 'h-4 w-4'}
        />
      );

    case 'enum':
      return (
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onClick={handleClick}
          className={inputClass}
        >
          <option value="">-</option>
          {field.enumValues?.map((val) => (
            <option key={val} value={val}>{val}</option>
          ))}
        </select>
      );

    case 'number':
    case 'integer':
      return (
        <input
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          onClick={handleClick}
          step={field.type === 'integer' ? '1' : 'any'}
          className={inputClass}
        />
      );

    case 'date':
      return (
        <input
          type="date"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onClick={handleClick}
          className={inputClass}
        />
      );

    case 'datetime':
      return (
        <input
          type="datetime-local"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onClick={handleClick}
          className={inputClass}
        />
      );

    default:
      return (
        <input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onClick={handleClick}
          className={inputClass}
        />
      );
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function formatValue(value: any, type: string): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';

  // Dates
  if (type === 'date' || type === 'datetime') {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return type === 'datetime'
          ? date.toLocaleString('fr-FR')
          : date.toLocaleDateString('fr-FR');
      }
    } catch {
      // fallback to string
    }
  }

  // Numbers
  if ((type === 'number' || type === 'integer') && typeof value === 'number') {
    return value.toLocaleString('fr-FR');
  }

  // Objects/JSON
  if (typeof value === 'object') {
    const jsonStr = JSON.stringify(value);
    return jsonStr.length > 30 ? jsonStr.substring(0, 30) + '...' : jsonStr;
  }

  const str = String(value);
  return str.length > 35 ? str.substring(0, 35) + '...' : str;
}

function getRelationColor(cardinality: string): string {
  switch (cardinality) {
    case '1-1':
      return '#8b5cf6';
    case '1-n':
      return '#3b82f6';
    case 'n-1':
      return '#14b8a6';
    case 'n-n':
      return '#f59e0b';
    default:
      return '#6b7280';
  }
}

// Node types - défini en dehors du composant pour éviter les re-renders
const nodeTypes = {
  centerNode: CenterRecordNode,
  linkedNode: LinkedRecordNode,
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function RecordGraph({
  schema,
  data,
  record,
  tableName,
  onSaveRecord,
  onNavigate,
  onClose,
}: RecordGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [editingNode, setEditingNode] = useState<string | null>(null);

  // Ref pour stocker les positions des nodes
  const nodePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const isInitializedRef = useRef(false);

  const tableDefinition = findTable(schema, tableName);
  const relations = useMemo(() => getRelations(schema), [schema]);

  // Calculer les positions initiales une seule fois
  const calculateInitialPositions = useCallback(() => {
    if (!tableDefinition || !record) return new Map();

    const positions = new Map<string, { x: number; y: number }>();
    const centerX = 400;
    const centerY = 300;
    const centerNodeId = `${tableName}:${record.id}`;

    positions.set(centerNodeId, { x: centerX - 150, y: centerY - 100 });

    const relatedRecordsInfo = getAllRelatedRecords(data, record, tableName, relations);
    const groupedByTable = new Map<string, { records: DataRecord[]; relation: any; direction: string }>();

    relatedRecordsInfo.forEach((info) => {
      const key = info.relatedTable;
      if (!groupedByTable.has(key)) {
        groupedByTable.set(key, {
          records: [],
          relation: info.relation,
          direction: info.direction,
        });
      }
      groupedByTable.get(key)!.records.push(...info.records);
    });

    const groups = Array.from(groupedByTable.entries());
    const angleStep = (2 * Math.PI) / Math.max(groups.length, 1);
    const baseRadius = 350;

    groups.forEach(([relatedTableName, groupInfo], groupIndex) => {
      const groupAngle = angleStep * groupIndex - Math.PI / 2;
      const groupCenterX = centerX + baseRadius * Math.cos(groupAngle);
      const groupCenterY = centerY + baseRadius * Math.sin(groupAngle);

      const uniqueRecords = groupInfo.records.filter(
        (r, i, arr) => arr.findIndex((x) => x.id === r.id) === i
      );

      const recordRadius = Math.min(80, 200 / Math.max(uniqueRecords.length, 1));

      uniqueRecords.forEach((relatedRecord, recordIndex) => {
        const nodeId = `${relatedTableName}:${relatedRecord.id}`;
        const recordAngle = (2 * Math.PI * recordIndex) / Math.max(uniqueRecords.length, 1);
        const offsetX = uniqueRecords.length > 1 ? recordRadius * Math.cos(recordAngle) : 0;
        const offsetY = uniqueRecords.length > 1 ? recordRadius * Math.sin(recordAngle) : 0;

        positions.set(nodeId, {
          x: groupCenterX + offsetX - 110,
          y: groupCenterY + offsetY - 50,
        });
      });
    });

    return positions;
  }, [tableDefinition, record, tableName, data, relations]);

  // Construire le graphe - appelé seulement quand record/tableName change
  useEffect(() => {
    if (!tableDefinition || !record) return;

    // Réinitialiser quand l'enregistrement central change
    isInitializedRef.current = false;
    nodePositionsRef.current = calculateInitialPositions();
    setExpandedNodes(new Set());
    setEditingNode(null);

    buildGraph();
  }, [record.id, tableName]);

  // Mettre à jour les données des nodes sans changer les positions
  useEffect(() => {
    if (!tableDefinition || !record || !isInitializedRef.current) return;

    updateNodeData();
  }, [expandedNodes, editingNode, data]);

  const buildGraph = useCallback(() => {
    if (!tableDefinition || !record) return;

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    const centerNodeId = `${tableName}:${record.id}`;

    // Noeud central
    const centerPos = nodePositionsRef.current.get(centerNodeId) || { x: 250, y: 200 };
    newNodes.push({
      id: centerNodeId,
      type: 'centerNode',
      position: centerPos,
      draggable: true,
      data: {
        record,
        table: tableDefinition,
        tableName,
        isCenter: true,
        isExpanded: expandedNodes.has(centerNodeId),
        isEditing: editingNode === centerNodeId,
        onToggleExpand: () => toggleExpand(centerNodeId),
        onStartEdit: () => setEditingNode(centerNodeId),
        onSave: (updatedRecord: DataRecord) => handleSave(tableName, updatedRecord),
        onCancel: () => setEditingNode(null),
      },
    });

    // Enregistrements liés
    const relatedRecordsInfo = getAllRelatedRecords(data, record, tableName, relations);
    const groupedByTable = new Map<string, { records: DataRecord[]; relation: any; direction: string }>();

    relatedRecordsInfo.forEach((info) => {
      const key = info.relatedTable;
      if (!groupedByTable.has(key)) {
        groupedByTable.set(key, {
          records: [],
          relation: info.relation,
          direction: info.direction,
        });
      }
      groupedByTable.get(key)!.records.push(...info.records);
    });

    groupedByTable.forEach((groupInfo, relatedTableName) => {
      const relatedTable = findTable(schema, relatedTableName);
      if (!relatedTable) return;

      const uniqueRecords = groupInfo.records.filter(
        (r, i, arr) => arr.findIndex((x) => x.id === r.id) === i
      );

      uniqueRecords.forEach((relatedRecord) => {
        const nodeId = `${relatedTableName}:${relatedRecord.id}`;
        const pos = nodePositionsRef.current.get(nodeId) || { x: 0, y: 0 };

        newNodes.push({
          id: nodeId,
          type: 'linkedNode',
          position: pos,
          draggable: true,
          data: {
            record: relatedRecord,
            table: relatedTable,
            tableName: relatedTableName,
            isCenter: false,
            isExpanded: expandedNodes.has(nodeId),
            isEditing: editingNode === nodeId,
            onToggleExpand: () => toggleExpand(nodeId),
            onStartEdit: () => setEditingNode(nodeId),
            onSave: (updatedRecord: DataRecord) => handleSave(relatedTableName, updatedRecord),
            onCancel: () => setEditingNode(null),
            onNavigate: onNavigate ? () => onNavigate(relatedTableName, relatedRecord.id) : undefined,
          },
        });

        // Edge
        const isOutgoing = groupInfo.direction === 'from';
        newEdges.push({
          id: `${centerNodeId}-${nodeId}`,
          source: isOutgoing ? centerNodeId : nodeId,
          target: isOutgoing ? nodeId : centerNodeId,
          type: 'smoothstep',
          animated: false,
          label: groupInfo.relation.cardinality,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: {
            stroke: getRelationColor(groupInfo.relation.cardinality),
            strokeWidth: 2,
          },
          labelStyle: {
            fill: getRelationColor(groupInfo.relation.cardinality),
            fontWeight: 600,
            fontSize: 11,
          },
          labelBgStyle: {
            fill: '#ffffff',
            fillOpacity: 0.9,
          },
        });
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
    isInitializedRef.current = true;
  }, [tableDefinition, record, tableName, data, schema, relations, expandedNodes, editingNode, onNavigate]);

  const updateNodeData = useCallback(() => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        const [nodeTableName, nodeRecordId] = node.id.split(':');
        const isCenter = node.id === `${tableName}:${record.id}`;

        // Trouver l'enregistrement mis à jour
        let currentRecord: DataRecord | undefined;
        if (isCenter) {
          currentRecord = record;
        } else {
          const tableRecords = getTableData(data, nodeTableName);
          currentRecord = tableRecords.find((r) => r.id === nodeRecordId);
        }

        if (!currentRecord) return node;

        const nodeTable = findTable(schema, nodeTableName);
        if (!nodeTable) return node;

        return {
          ...node,
          data: {
            ...node.data,
            record: currentRecord,
            table: nodeTable,
            isExpanded: expandedNodes.has(node.id),
            isEditing: editingNode === node.id,
            onToggleExpand: () => toggleExpand(node.id),
            onStartEdit: () => setEditingNode(node.id),
            onSave: (updatedRecord: DataRecord) => handleSave(nodeTableName, updatedRecord),
            onCancel: () => setEditingNode(null),
          },
        };
      })
    );
  }, [tableName, record, data, schema, expandedNodes, editingNode]);

  const toggleExpand = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  const handleSave = useCallback(
    async (tblName: string, updatedRecord: DataRecord) => {
      await onSaveRecord(tblName, updatedRecord);
      setEditingNode(null);
    },
    [onSaveRecord]
  );

  // Sauvegarder les positions quand les nodes bougent
  const handleNodesChange = useCallback((changes: any) => {
    onNodesChange(changes);

    // Mettre à jour les positions dans le ref
    changes.forEach((change: any) => {
      if (change.type === 'position' && change.position) {
        nodePositionsRef.current.set(change.id, change.position);
      }
    });
  }, [onNodesChange]);

  // Compter les relations
  const relationStats = useMemo(() => {
    if (!record || !tableName) return { totalRecords: 0, uniqueTables: 0 };
    const relatedInfo = getAllRelatedRecords(data, record, tableName, relations);
    const totalRecords = relatedInfo.reduce((acc, info) => acc + info.records.length, 0);
    const uniqueTables = new Set(relatedInfo.map((info) => info.relatedTable)).size;
    return { totalRecords, uniqueTables };
  }, [data, record, tableName, relations]);

  if (!tableDefinition) {
    return (
      <div className="flex items-center justify-center h-full text-dark-500">
        Table non trouvée
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={1.5}
        defaultEdgeOptions={{
          type: 'smoothstep',
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e2e8f0" gap={25} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => (node.type === 'centerNode' ? '#3b82f6' : '#14b8a6')}
          maskColor="rgba(0, 0, 0, 0.08)"
          style={{ background: '#f8fafc' }}
        />

        {/* Header avec infos */}
        <Panel position="top-left" className="bg-white/95 backdrop-blur p-4 rounded-xl shadow-lg border border-dark-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
              <Star className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <div className="font-bold text-dark-800">{tableDefinition.label || tableName}</div>
              <div className="text-xs font-mono text-dark-500">{record.id}</div>
            </div>
          </div>
          <div className="flex gap-4 text-xs">
            <div>
              <div className="text-dark-400">Relations</div>
              <div className="font-bold text-dark-700">{relationStats.uniqueTables} tables</div>
            </div>
            <div>
              <div className="text-dark-400">Enregistrements liés</div>
              <div className="font-bold text-dark-700">{relationStats.totalRecords}</div>
            </div>
          </div>
        </Panel>

        {/* Légende */}
        <Panel position="bottom-left" className="bg-white/95 backdrop-blur p-3 rounded-xl shadow-lg border border-dark-100">
          <div className="text-[10px] space-y-1.5">
            <div className="font-semibold text-dark-600 mb-2">Légende</div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary-500" />
              <span className="text-dark-600">Enregistrement sélectionné</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-accent-500" />
              <span className="text-dark-600">Enregistrements liés</span>
            </div>
            <div className="border-t border-dark-100 pt-1.5 mt-1.5 space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-violet-500" />
                <span>1:1</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-blue-500" />
                <span>1:n</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-teal-500" />
                <span>n:1</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-orange-500" />
                <span>n:n</span>
              </div>
            </div>
          </div>
        </Panel>

        {/* Bouton fermer */}
        {onClose && (
          <Panel position="top-right">
            <button
              onClick={onClose}
              className="p-2 bg-white rounded-xl shadow-lg border border-dark-100 text-dark-500 hover:text-dark-700 hover:bg-dark-50 transition-colors"
              title="Fermer"
            >
              <X size={20} />
            </button>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
