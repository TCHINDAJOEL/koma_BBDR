import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { AuditEvent } from '@/types/schema';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight, Filter } from 'lucide-react';

export default function AuditLog() {
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAudit();
  }, []);

  const loadAudit = async () => {
    try {
      const res = await fetch('/api/state');
      const state = await res.json();
      setAudit(state.audit.reverse()); // Plus récent en premier
      setLoading(false);
    } catch (error) {
      console.error('Erreur de chargement:', error);
      setLoading(false);
    }
  };

  const filteredAudit = filter
    ? audit.filter(
        (e) =>
          e.action.toLowerCase().includes(filter.toLowerCase()) ||
          e.target.ref.toLowerCase().includes(filter.toLowerCase())
      )
    : audit;

  const getActionColor = (action: string) => {
    if (action.includes('CREATE')) return 'bg-green-100 text-green-700';
    if (action.includes('UPDATE')) return 'bg-blue-100 text-blue-700';
    if (action.includes('DELETE')) return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-700';
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
          <h2 className="text-3xl font-bold text-gray-800">Audit Log</h2>
          <p className="text-gray-600 mt-2">
            Journal append-only de tous les événements du système
          </p>
        </div>

        <div className="mb-4">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Filtrer par action ou référence..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 bg-white rounded-lg shadow overflow-auto">
          <div className="divide-y divide-gray-200">
            {filteredAudit.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                Aucun événement trouvé
              </div>
            ) : (
              filteredAudit.map((event) => (
                <div key={event.eventId} className="p-4 hover:bg-gray-50">
                  <div
                    className="flex items-start justify-between cursor-pointer"
                    onClick={() =>
                      setExpandedId(expandedId === event.eventId ? null : event.eventId)
                    }
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        {expandedId === event.eventId ? (
                          <ChevronDown size={18} className="text-gray-400" />
                        ) : (
                          <ChevronRight size={18} className="text-gray-400" />
                        )}

                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getActionColor(event.action)}`}>
                          {event.action}
                        </span>

                        <span className="text-sm text-gray-600">
                          {event.target.type}: <span className="font-mono">{event.target.ref}</span>
                        </span>
                      </div>

                      <div className="ml-7 text-xs text-gray-500">
                        {format(new Date(event.ts), 'dd/MM/yyyy HH:mm:ss')} • {event.actor}
                        {event.reason && <span className="ml-2">• {event.reason}</span>}
                      </div>
                    </div>
                  </div>

                  {expandedId === event.eventId && (
                    <div className="ml-7 mt-4 space-y-3">
                      {event.before && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-700 mb-1">BEFORE</h4>
                          <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                            {JSON.stringify(event.before, null, 2)}
                          </pre>
                        </div>
                      )}

                      {event.after && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-700 mb-1">AFTER</h4>
                          <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                            {JSON.stringify(event.after, null, 2)}
                          </pre>
                        </div>
                      )}

                      {event.metadata && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-700 mb-1">METADATA</h4>
                          <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                            {JSON.stringify(event.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-500">
          Total: {filteredAudit.length} événement(s)
        </div>
      </div>
    </Layout>
  );
}
