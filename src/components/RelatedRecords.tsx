import { useState, useMemo } from 'react';
import {
  Schema,
  TableData,
  DataRecord,
  TableDefinition,
  RelationDefinition,
} from '@/types/schema';
import {
  getTableRelations,
  getAllRelatedRecords,
  RelatedRecordsInfo,
} from '@/lib/record-helpers';
import { findTable, getRelations } from '@/lib/data-helpers';
import {
  Link2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  Database,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface RelatedRecordsProps {
  record: DataRecord;
  tableName: string;
  schema: Schema;
  data: TableData;
  onNavigate?: (tableName: string, recordId: string) => void;
  maxPreviewRecords?: number;
}

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export default function RelatedRecords({
  record,
  tableName,
  schema,
  data,
  onNavigate,
  maxPreviewRecords = 5,
}: RelatedRecordsProps) {
  const [expandedRelations, setExpandedRelations] = useState<Set<string>>(new Set());

  // Calculer les relations et enregistrements liés
  const relations = useMemo(() => getRelations(schema), [schema]);

  const relatedRecordsInfo = useMemo(
    () => getAllRelatedRecords(data, record, tableName, relations),
    [data, record, tableName, relations]
  );

  // Séparer les relations sortantes et entrantes
  const outgoingRelations = relatedRecordsInfo.filter((r) => r.direction === 'from');
  const incomingRelations = relatedRecordsInfo.filter((r) => r.direction === 'to');

  const toggleRelation = (relationId: string) => {
    setExpandedRelations((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(relationId)) {
        newSet.delete(relationId);
      } else {
        newSet.add(relationId);
      }
      return newSet;
    });
  };

  const handleNavigate = (targetTable: string, targetRecordId: string) => {
    if (onNavigate) {
      onNavigate(targetTable, targetRecordId);
    }
  };

  // Si aucune relation, afficher un message
  if (relatedRecordsInfo.length === 0) {
    return (
      <div className="p-4 bg-dark-50 rounded-xl text-center">
        <Link2 className="w-8 h-8 text-dark-400 mx-auto mb-2" />
        <p className="text-sm text-dark-500">Aucune relation définie pour cette table</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Link2 className="w-5 h-5 text-primary-600" />
        <h3 className="font-semibold text-dark-800">Relations</h3>
        <span className="text-xs text-dark-400">
          ({relatedRecordsInfo.length} relation{relatedRecordsInfo.length > 1 ? 's' : ''})
        </span>
      </div>

      {/* Relations sortantes (FK dans cette table) */}
      {outgoingRelations.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-sm text-dark-600 mb-2">
            <ArrowRight className="w-4 h-4" />
            <span className="font-medium">Références sortantes</span>
          </div>
          <div className="space-y-2">
            {outgoingRelations.map((info) => (
              <RelationCard
                key={info.relation.id}
                info={info}
                schema={schema}
                isExpanded={expandedRelations.has(info.relation.id)}
                onToggle={() => toggleRelation(info.relation.id)}
                onNavigate={handleNavigate}
                maxPreviewRecords={maxPreviewRecords}
              />
            ))}
          </div>
        </div>
      )}

      {/* Relations entrantes (FK dans d'autres tables) */}
      {incomingRelations.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-sm text-dark-600 mb-2">
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium">Références entrantes</span>
          </div>
          <div className="space-y-2">
            {incomingRelations.map((info) => (
              <RelationCard
                key={info.relation.id}
                info={info}
                schema={schema}
                isExpanded={expandedRelations.has(info.relation.id)}
                onToggle={() => toggleRelation(info.relation.id)}
                onNavigate={handleNavigate}
                maxPreviewRecords={maxPreviewRecords}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COMPOSANT RELATION CARD
// ============================================================================

interface RelationCardProps {
  info: RelatedRecordsInfo;
  schema: Schema;
  isExpanded: boolean;
  onToggle: () => void;
  onNavigate: (tableName: string, recordId: string) => void;
  maxPreviewRecords: number;
}

function RelationCard({
  info,
  schema,
  isExpanded,
  onToggle,
  onNavigate,
  maxPreviewRecords,
}: RelationCardProps) {
  const { relation, direction, relatedTable, relatedField, localField, records } = info;

  // Obtenir la définition de la table liée pour les labels
  const relatedTableDef = findTable(schema, relatedTable);

  const cardinalityBadge = getCardinalityBadge(relation.cardinality, direction);
  const hasRecords = records.length > 0;
  const displayRecords = isExpanded ? records : records.slice(0, maxPreviewRecords);
  const hasMore = records.length > maxPreviewRecords && !isExpanded;

  return (
    <div className="border border-dark-200 rounded-xl overflow-hidden bg-white">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-dark-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Database className="w-4 h-4 text-dark-400" />
          <div className="text-left">
            <div className="font-medium text-dark-800">
              {relatedTableDef?.label || relatedTable}
            </div>
            <div className="text-xs text-dark-500">
              {localField} → {relatedTable}.{relatedField}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${cardinalityBadge.className}`}>
            {cardinalityBadge.label}
          </span>
          <span className={`text-sm font-medium ${hasRecords ? 'text-primary-600' : 'text-dark-400'}`}>
            {records.length}
          </span>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-dark-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-dark-400" />
          )}
        </div>
      </button>

      {/* Liste des enregistrements liés */}
      {(isExpanded || records.length > 0) && records.length > 0 && (
        <div className="border-t border-dark-100">
          <div className="divide-y divide-dark-100">
            {displayRecords.map((relatedRecord) => (
              <RelatedRecordRow
                key={relatedRecord.id}
                record={relatedRecord}
                tableName={relatedTable}
                tableDefinition={relatedTableDef}
                onNavigate={onNavigate}
              />
            ))}
          </div>
          {hasMore && (
            <button
              onClick={onToggle}
              className="w-full py-2 text-sm text-primary-600 hover:bg-primary-50 transition-colors"
            >
              Voir {records.length - maxPreviewRecords} de plus...
            </button>
          )}
        </div>
      )}

      {/* Message si aucun enregistrement */}
      {records.length === 0 && (
        <div className="border-t border-dark-100 p-3 text-center text-sm text-dark-400">
          Aucun enregistrement lié
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COMPOSANT RELATED RECORD ROW
// ============================================================================

interface RelatedRecordRowProps {
  record: DataRecord;
  tableName: string;
  tableDefinition?: TableDefinition;
  onNavigate: (tableName: string, recordId: string) => void;
}

function RelatedRecordRow({
  record,
  tableName,
  tableDefinition,
  onNavigate,
}: RelatedRecordRowProps) {
  // Trouver les champs à afficher en prévisualisation
  const previewFields = useMemo(() => {
    if (!tableDefinition) return [{ name: 'id', type: 'string' }];

    // Prendre les 3 premiers champs non-techniques
    const fields = tableDefinition.fields
      .filter((f) => !['json', 'boolean'].includes(f.type))
      .slice(0, 3);

    return [{ name: 'id', type: 'string' }, ...fields].slice(0, 4);
  }, [tableDefinition]);

  const getFieldLabel = (fieldName: string): string => {
    if (fieldName === 'id') return 'ID';
    const field = tableDefinition?.fields.find((f) => f.name === fieldName);
    return field?.label || fieldName;
  };

  const formatDisplayValue = (value: any, type: string): string => {
    if (value === null || value === undefined) return '-';

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
        // fallback
      }
    }

    // Numbers
    if ((type === 'number' || type === 'integer') && typeof value === 'number') {
      return value.toLocaleString('fr-FR');
    }

    // Objects
    if (typeof value === 'object') {
      const jsonStr = JSON.stringify(value);
      return jsonStr.length > 25 ? jsonStr.substring(0, 25) + '...' : jsonStr;
    }

    const strValue = String(value);
    return strValue.length > 30 ? strValue.substring(0, 30) + '...' : strValue;
  };

  return (
    <div
      className="flex items-center justify-between p-2 px-3 hover:bg-dark-50 cursor-pointer transition-colors group"
      onClick={() => onNavigate(tableName, record.id)}
    >
      <div className="flex items-center gap-4 overflow-hidden">
        {previewFields.map((field, index) => {
          const value = record[field.name];
          const displayValue = formatDisplayValue(value, field.type);

          return (
            <div key={field.name} className="min-w-0">
              <div className="text-[10px] text-dark-400 uppercase tracking-wide">
                {getFieldLabel(field.name)}
              </div>
              <div
                className={`text-sm truncate ${
                  index === 0 ? 'font-mono font-medium text-dark-700 bg-dark-50 px-1.5 rounded' : 'text-dark-600'
                }`}
                title={String(value)}
              >
                {displayValue}
              </div>
            </div>
          );
        })}
      </div>
      <ExternalLink className="w-4 h-4 text-dark-300 group-hover:text-primary-600 transition-colors flex-shrink-0" />
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function getCardinalityBadge(
  cardinality: string,
  direction: 'from' | 'to'
): { label: string; className: string } {
  switch (cardinality) {
    case '1-1':
      return { label: '1:1', className: 'badge-primary' };
    case '1-n':
      return direction === 'from'
        ? { label: 'n:1', className: 'badge-accent' }
        : { label: '1:n', className: 'badge-warning' };
    case 'n-1':
      return direction === 'from'
        ? { label: '1:n', className: 'badge-warning' }
        : { label: 'n:1', className: 'badge-accent' };
    case 'n-n':
      return { label: 'n:n', className: 'badge-info' };
    default:
      return { label: cardinality, className: 'badge-secondary' };
  }
}
