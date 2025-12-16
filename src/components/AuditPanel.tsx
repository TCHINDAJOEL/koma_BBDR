import { useState, useMemo } from 'react';
import {
  History,
  X,
  ChevronDown,
  ChevronRight,
  Plus,
  Edit2,
  Trash2,
  Database,
  Table,
  GitBranch,
  User,
  Clock,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { AuditEvent, AuditAction } from '@/types/schema';

// ============================================================================
// TYPES
// ============================================================================

interface AuditPanelProps {
  audit: AuditEvent[];
  onClose: () => void;
  onRefresh?: () => void;
}

// ============================================================================
// ACTION CONFIG
// ============================================================================

const ACTION_CONFIG: Record<
  AuditAction,
  { label: string; icon: typeof Plus; color: string; bgColor: string }
> = {
  SCHEMA_UPDATE: {
    label: 'Mise à jour du schéma',
    icon: Database,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  SCHEMA_TABLE_CREATE: {
    label: 'Table créée',
    icon: Plus,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  SCHEMA_TABLE_UPDATE: {
    label: 'Table modifiée',
    icon: Edit2,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  SCHEMA_TABLE_DELETE: {
    label: 'Table supprimée',
    icon: Trash2,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  SCHEMA_FIELD_CREATE: {
    label: 'Champ créé',
    icon: Plus,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  SCHEMA_FIELD_UPDATE: {
    label: 'Champ modifié',
    icon: Edit2,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  SCHEMA_FIELD_DELETE: {
    label: 'Champ supprimé',
    icon: Trash2,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  DATA_UPSERT: {
    label: 'Données modifiées',
    icon: Edit2,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  DATA_DELETE: {
    label: 'Données supprimées',
    icon: Trash2,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  RELATION_CREATE: {
    label: 'Relation créée',
    icon: GitBranch,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  RELATION_UPDATE: {
    label: 'Relation modifiée',
    icon: GitBranch,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  RELATION_DELETE: {
    label: 'Relation supprimée',
    icon: GitBranch,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  IMPORT: {
    label: 'Import de données',
    icon: Database,
    color: 'text-teal-600',
    bgColor: 'bg-teal-100',
  },
  EXPORT: {
    label: 'Export de données',
    icon: Database,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
  },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AuditPanel({ audit, onClose, onRefresh }: AuditPanelProps) {
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterTable, setFilterTable] = useState<string>('all');

  // Extraire les tables uniques des événements
  const uniqueTables = useMemo(() => {
    const tables = new Set<string>();
    audit.forEach((event) => {
      if (event.target?.ref) {
        const tableName = event.target.ref.split('/')[0];
        if (tableName) tables.add(tableName);
      }
    });
    return Array.from(tables).sort();
  }, [audit]);

  // Filtrer les événements
  const filteredEvents = useMemo(() => {
    return audit
      .filter((event) => {
        if (filterAction !== 'all' && event.action !== filterAction) return false;
        if (filterTable !== 'all') {
          const tableName = event.target?.ref?.split('/')[0];
          if (tableName !== filterTable) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  }, [audit, filterAction, filterTable]);

  const toggleExpand = (eventId: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const formatDate = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatRelativeTime = (ts: string) => {
    const date = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "À l'instant";
    if (minutes < 60) return `Il y a ${minutes} min`;
    if (hours < 24) return `Il y a ${hours}h`;
    if (days < 7) return `Il y a ${days}j`;
    return formatDate(ts);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content w-full max-w-4xl p-6 animate-fade-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
              <History className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-dark-900">Historique d'audit</h3>
              <p className="text-sm text-dark-500">
                {filteredEvents.length} événement{filteredEvents.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-2 text-dark-500 hover:bg-dark-100 rounded-lg transition-colors"
                title="Rafraîchir"
              >
                <RefreshCw size={20} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-dark-500 hover:bg-dark-100 rounded-lg transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4 p-3 bg-dark-50 rounded-xl">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-dark-400" />
            <span className="text-sm text-dark-600">Filtres:</span>
          </div>

          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="select py-1.5 text-sm min-w-[180px]"
          >
            <option value="all">Toutes les actions</option>
            <optgroup label="Schéma">
              <option value="SCHEMA_UPDATE">Mise à jour schéma</option>
              <option value="SCHEMA_TABLE_CREATE">Table créée</option>
              <option value="SCHEMA_TABLE_UPDATE">Table modifiée</option>
              <option value="SCHEMA_TABLE_DELETE">Table supprimée</option>
            </optgroup>
            <optgroup label="Données">
              <option value="DATA_UPSERT">Données modifiées</option>
              <option value="DATA_DELETE">Données supprimées</option>
            </optgroup>
            <optgroup label="Relations">
              <option value="RELATION_CREATE">Relation créée</option>
              <option value="RELATION_UPDATE">Relation modifiée</option>
              <option value="RELATION_DELETE">Relation supprimée</option>
            </optgroup>
          </select>

          <select
            value={filterTable}
            onChange={(e) => setFilterTable(e.target.value)}
            className="select py-1.5 text-sm min-w-[150px]"
          >
            <option value="all">Toutes les tables</option>
            {uniqueTables.map((table) => (
              <option key={table} value={table}>
                {table}
              </option>
            ))}
          </select>
        </div>

        {/* Events List */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12 text-dark-400">
              <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Aucun événement d'audit</p>
            </div>
          ) : (
            filteredEvents.map((event) => (
              <AuditEventItem
                key={event.eventId}
                event={event}
                isExpanded={expandedEvents.has(event.eventId)}
                onToggle={() => toggleExpand(event.eventId)}
                formatRelativeTime={formatRelativeTime}
                formatDate={formatDate}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end mt-4 pt-4 border-t border-dark-100">
          <button onClick={onClose} className="btn btn-secondary">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// AUDIT EVENT ITEM
// ============================================================================

interface AuditEventItemProps {
  event: AuditEvent;
  isExpanded: boolean;
  onToggle: () => void;
  formatRelativeTime: (ts: string) => string;
  formatDate: (ts: string) => string;
}

function AuditEventItem({
  event,
  isExpanded,
  onToggle,
  formatRelativeTime,
  formatDate,
}: AuditEventItemProps) {
  const config = ACTION_CONFIG[event.action] || {
    label: event.action,
    icon: Database,
    color: 'text-dark-600',
    bgColor: 'bg-dark-100',
  };

  const Icon = config.icon;

  // Extraire le nom de table et l'ID du record
  const [tableName, recordId] = (event.target?.ref || '').split('/');

  // Calculer les changements
  const changes = useMemo(() => {
    if (!event.before && !event.after) return null;
    if (!event.before) return { type: 'create', data: event.after };
    if (!event.after) return { type: 'delete', data: event.before };

    // Comparer before et after pour les modifications
    const changedFields: { field: string; before: any; after: any }[] = [];

    const allKeys = new Set([
      ...Object.keys(event.before || {}),
      ...Object.keys(event.after || {}),
    ]);

    allKeys.forEach((key) => {
      const beforeVal = event.before?.[key];
      const afterVal = event.after?.[key];

      if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
        changedFields.push({ field: key, before: beforeVal, after: afterVal });
      }
    });

    return { type: 'update', changes: changedFields };
  }, [event.before, event.after]);

  return (
    <div className="border border-dark-200 rounded-xl overflow-hidden hover:border-dark-300 transition-colors">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-dark-50 transition-colors"
      >
        <div className={`w-8 h-8 ${config.bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-4 h-4 ${config.color}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-dark-800">{config.label}</span>
            {tableName && (
              <span className="badge badge-primary text-xs">{tableName}</span>
            )}
            {recordId && (
              <span className="font-mono text-xs text-dark-500">#{recordId.slice(0, 8)}</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-dark-500 mt-0.5">
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {formatRelativeTime(event.ts)}
            </span>
            <span className="flex items-center gap-1">
              <User size={12} />
              {event.actor || 'Système'}
            </span>
          </div>
        </div>

        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-dark-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-dark-400" />
        )}
      </button>

      {/* Details */}
      {isExpanded && (
        <div className="border-t border-dark-100 p-4 bg-dark-50 space-y-3">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-dark-500">Date exacte:</span>
              <span className="ml-2 text-dark-700">{formatDate(event.ts)}</span>
            </div>
            <div>
              <span className="text-dark-500">ID événement:</span>
              <span className="ml-2 font-mono text-xs text-dark-600">
                {event.eventId}
              </span>
            </div>
          </div>

          {/* Reason */}
          {event.reason && (
            <div className="text-sm">
              <span className="text-dark-500">Raison:</span>
              <span className="ml-2 text-dark-700">{event.reason}</span>
            </div>
          )}

          {/* Changes */}
          {changes && (
            <div className="mt-3">
              <h4 className="text-sm font-medium text-dark-700 mb-2">Modifications:</h4>
              <div className="bg-white rounded-lg border border-dark-200 overflow-hidden">
                {changes.type === 'create' && (
                  <div className="p-3">
                    <span className="badge badge-success mb-2">Création</span>
                    <pre className="text-xs font-mono text-dark-600 overflow-x-auto max-h-40">
                      {JSON.stringify(changes.data, null, 2)}
                    </pre>
                  </div>
                )}

                {changes.type === 'delete' && (
                  <div className="p-3">
                    <span className="badge badge-danger mb-2">Suppression</span>
                    <pre className="text-xs font-mono text-dark-600 overflow-x-auto max-h-40">
                      {JSON.stringify(changes.data, null, 2)}
                    </pre>
                  </div>
                )}

                {changes.type === 'update' && changes.changes && (
                  <table className="w-full text-sm">
                    <thead className="bg-dark-50">
                      <tr>
                        <th className="text-left p-2 font-medium text-dark-600">Champ</th>
                        <th className="text-left p-2 font-medium text-dark-600">Avant</th>
                        <th className="text-left p-2 font-medium text-dark-600">Après</th>
                      </tr>
                    </thead>
                    <tbody>
                      {changes.changes.map((change, idx) => (
                        <tr key={idx} className="border-t border-dark-100">
                          <td className="p-2 font-mono text-xs text-dark-700">
                            {change.field}
                          </td>
                          <td className="p-2">
                            <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded text-xs font-mono">
                              {JSON.stringify(change.before) ?? 'null'}
                            </span>
                          </td>
                          <td className="p-2">
                            <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-xs font-mono">
                              {JSON.stringify(change.after) ?? 'null'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
