import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { AuditEvent } from '@/types/schema';
import { format } from 'date-fns';
import {
  ChevronDown,
  ChevronRight,
  Search,
  History,
  Plus,
  Edit3,
  Trash2,
  Clock,
  User
} from 'lucide-react';

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
      setAudit(state.audit.reverse());
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

  const getActionIcon = (action: string) => {
    if (action.includes('CREATE')) return <Plus size={16} />;
    if (action.includes('UPDATE')) return <Edit3 size={16} />;
    if (action.includes('DELETE')) return <Trash2 size={16} />;
    return <Clock size={16} />;
  };

  const getActionStyle = (action: string) => {
    if (action.includes('CREATE')) return 'bg-green-100 text-green-700 border-green-200';
    if (action.includes('UPDATE')) return 'bg-primary-100 text-primary-700 border-primary-200';
    if (action.includes('DELETE')) return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-dark-100 text-dark-700 border-dark-200';
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-dark-500">Chargement de l'audit...</p>
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
              <h1 className="text-3xl font-bold mb-2">Audit Log</h1>
              <p className="text-primary-200">
                Journal append-only de tous les événements du système
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-3xl font-bold">{audit.length}</div>
                <div className="text-primary-200 text-sm">Événements</div>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={20} />
            <input
              type="text"
              placeholder="Filtrer par action ou référence..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="input input-with-icon"
            />
          </div>
        </div>

        {/* Events list */}
        <div className="card">
          {filteredAudit.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-dark-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <History className="w-8 h-8 text-dark-400" />
              </div>
              <h3 className="text-lg font-semibold text-dark-700 mb-2">
                Aucun événement
              </h3>
              <p className="text-dark-500">
                {filter ? 'Aucun événement ne correspond à votre recherche' : 'Le journal d\'audit est vide'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-dark-100">
              {filteredAudit.map((event, index) => (
                <div
                  key={event.eventId}
                  className={`transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-dark-50/30'}`}
                >
                  <div
                    className="p-4 cursor-pointer hover:bg-dark-50 transition-colors"
                    onClick={() =>
                      setExpandedId(expandedId === event.eventId ? null : event.eventId)
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <button className="p-1 hover:bg-dark-100 rounded transition-colors">
                          {expandedId === event.eventId ? (
                            <ChevronDown size={20} className="text-dark-500" />
                          ) : (
                            <ChevronRight size={20} className="text-dark-400" />
                          )}
                        </button>

                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${getActionStyle(event.action)}`}>
                          {getActionIcon(event.action)}
                          <span className="text-sm font-semibold">
                            {event.action}
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-dark-600">
                              {event.target.type}:
                            </span>
                            <code className="text-sm font-mono text-dark-800 bg-dark-100 px-2 py-0.5 rounded">
                              {event.target.ref}
                            </code>
                          </div>
                          {event.reason && (
                            <p className="text-xs text-dark-500 mt-1">{event.reason}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-dark-500">
                        <div className="flex items-center gap-1">
                          <User size={14} />
                          <span>{event.actor}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock size={14} />
                          <span>{format(new Date(event.ts), 'dd/MM/yyyy HH:mm:ss')}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {expandedId === event.eventId && (
                    <div className="px-4 pb-4 animate-fade-in">
                      <div className="ml-12 space-y-4">
                        {event.before && (
                          <div className="card p-4">
                            <h4 className="text-xs font-semibold text-dark-600 uppercase tracking-wider mb-2">
                              Before
                            </h4>
                            <pre className="bg-dark-50 p-4 rounded-xl text-xs overflow-x-auto font-mono text-dark-700">
                              {JSON.stringify(event.before, null, 2)}
                            </pre>
                          </div>
                        )}

                        {event.after && (
                          <div className="card p-4">
                            <h4 className="text-xs font-semibold text-dark-600 uppercase tracking-wider mb-2">
                              After
                            </h4>
                            <pre className="bg-dark-50 p-4 rounded-xl text-xs overflow-x-auto font-mono text-dark-700">
                              {JSON.stringify(event.after, null, 2)}
                            </pre>
                          </div>
                        )}

                        {event.metadata && (
                          <div className="card p-4">
                            <h4 className="text-xs font-semibold text-dark-600 uppercase tracking-wider mb-2">
                              Metadata
                            </h4>
                            <pre className="bg-dark-50 p-4 rounded-xl text-xs overflow-x-auto font-mono text-dark-700">
                              {JSON.stringify(event.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer stats */}
        <div className="mt-4 text-sm text-dark-500 flex items-center justify-between">
          <span>
            {filteredAudit.length} événement{filteredAudit.length > 1 ? 's' : ''}
            {filter && ` (filtré${filteredAudit.length > 1 ? 's' : ''})`}
          </span>
          {filter && (
            <button
              onClick={() => setFilter('')}
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Effacer le filtre
            </button>
          )}
        </div>
      </div>
    </Layout>
  );
}
