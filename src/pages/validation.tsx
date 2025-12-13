import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { ValidationReport, ValidationAlert } from '@/types/schema';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  RefreshCw,
  Shield,
  Zap,
  Clock
} from 'lucide-react';

export default function ValidationCenter() {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    runValidation();
  }, []);

  const runValidation = async () => {
    setValidating(true);
    try {
      const stateRes = await fetch('/api/state');
      const state = await stateRes.json();

      const validateRes = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema: state.schema,
          data: state.data,
          rules: state.rules,
        }),
      });

      const result = await validateRes.json();
      setReport(result.report);
      setLoading(false);
    } catch (error) {
      console.error('Erreur de validation:', error);
      setLoading(false);
    } finally {
      setValidating(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="text-red-500" size={20} />;
      case 'warn':
        return <AlertTriangle className="text-yellow-500" size={20} />;
      case 'info':
        return <Info className="text-primary-500" size={20} />;
      default:
        return null;
    }
  };

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warn':
        return 'bg-yellow-50 border-yellow-200';
      case 'info':
        return 'bg-primary-50 border-primary-200';
      default:
        return 'bg-dark-50 border-dark-200';
    }
  };

  const renderAlerts = (alerts: ValidationAlert[], title: string, description: string, icon: React.ReactNode) => {
    if (alerts.length === 0) return null;

    return (
      <div className="card mb-6 animate-fade-in">
        <div className="p-4 border-b border-dark-100">
          <div className="flex items-center gap-3">
            {icon}
            <div>
              <h3 className="font-semibold text-dark-800">{title}</h3>
              <p className="text-sm text-dark-500">{description}</p>
            </div>
          </div>
        </div>
        <div className="p-4 space-y-3">
          {alerts.map((alert, index) => (
            <div
              key={index}
              className={`border rounded-xl p-4 ${getSeverityStyle(alert.severity)}`}
            >
              <div className="flex items-start gap-3">
                {getSeverityIcon(alert.severity)}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <code className="text-xs font-mono bg-white px-2 py-1 rounded border border-dark-200">
                      {alert.code}
                    </code>
                    <span className="text-xs text-dark-500">{alert.location}</span>
                  </div>

                  <p className="text-sm font-medium text-dark-800 mb-2">
                    {alert.message}
                  </p>

                  {alert.suggestion && (
                    <div className="flex items-start gap-2 text-sm text-dark-600 mb-2">
                      <Zap size={16} className="text-accent-500 mt-0.5 flex-shrink-0" />
                      <span>{alert.suggestion}</span>
                    </div>
                  )}

                  {alert.context && (
                    <div className="flex flex-wrap gap-3 text-xs text-dark-500 mt-3 pt-3 border-t border-dark-200/50">
                      {alert.context.affectedCount !== undefined && (
                        <span className="flex items-center gap-1">
                          <span className="font-medium">Affectés:</span> {alert.context.affectedCount}
                        </span>
                      )}
                      {alert.context.table && (
                        <span className="flex items-center gap-1">
                          <span className="font-medium">Table:</span> {alert.context.table}
                        </span>
                      )}
                      {alert.context.field && (
                        <span className="flex items-center gap-1">
                          <span className="font-medium">Champ:</span> {alert.context.field}
                        </span>
                      )}
                    </div>
                  )}

                  {alert.quickFix && (
                    <button className="mt-3 btn btn-secondary text-xs py-1.5 px-3">
                      Appliquer la correction automatique
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-dark-500">Validation en cours...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!report) {
    return (
      <Layout>
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-xl font-semibold text-dark-800 mb-2">Erreur de validation</h3>
          <p className="text-dark-500 mb-4">Impossible de valider le schéma</p>
          <button onClick={runValidation} className="btn btn-primary">
            Réessayer
          </button>
        </div>
      </Layout>
    );
  }

  const isValid = report.summary.errors === 0;

  return (
    <Layout>
      <div className="animate-fade-in">
        {/* Hero Section */}
        <div className="card p-8 mb-8 gradient-hero text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Validation Center</h1>
              <p className="text-primary-200">
                Validation complète du schéma et des données (3 niveaux)
              </p>
            </div>
            <button
              onClick={runValidation}
              disabled={validating}
              className="btn bg-white/10 hover:bg-white/20 text-white border border-white/20 gap-2"
            >
              <RefreshCw size={18} className={validating ? 'animate-spin' : ''} />
              <span>Relancer</span>
            </button>
          </div>
        </div>

        {/* Summary Card */}
        <div className={`card mb-8 overflow-hidden ${isValid ? 'border-green-200' : 'border-red-200'}`}>
          <div className={`p-6 ${isValid ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="flex items-center gap-4 mb-6">
              {isValid ? (
                <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center">
                  <CheckCircle className="text-green-600" size={28} />
                </div>
              ) : (
                <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center">
                  <AlertCircle className="text-red-600" size={28} />
                </div>
              )}
              <div>
                <h2 className={`text-2xl font-bold ${isValid ? 'text-green-800' : 'text-red-800'}`}>
                  {isValid ? 'Validation réussie' : 'Validation échouée'}
                </h2>
                <div className="flex items-center gap-2 text-sm text-dark-500 mt-1">
                  <Clock size={14} />
                  <span>Dernière validation: {new Date(report.timestamp).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <AlertCircle className="text-red-500" size={20} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">{report.summary.errors}</div>
                    <div className="text-sm text-dark-500">Erreurs</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="text-yellow-500" size={20} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-yellow-600">{report.summary.warnings}</div>
                    <div className="text-sm text-dark-500">Avertissements</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <Info className="text-primary-500" size={20} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-primary-600">{report.summary.infos}</div>
                    <div className="text-sm text-dark-500">Informations</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Validation Levels */}
        {renderAlerts(
          report.levelA,
          'Niveau A — Validation de structure (AJV)',
          'Validation du schéma et des données contre leurs JSON Schemas respectifs',
          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
            <Shield className="text-primary-600" size={20} />
          </div>
        )}

        {renderAlerts(
          report.levelB,
          'Niveau B — Intégrité relationnelle',
          'Validation des clés primaires, contraintes d\'unicité, et références FK',
          <div className="w-10 h-10 bg-accent-100 rounded-lg flex items-center justify-center">
            <Shield className="text-accent-600" size={20} />
          </div>
        )}

        {renderAlerts(
          report.levelC,
          'Niveau C — Impact sur les données',
          'Analyse de l\'impact des contraintes du schéma sur les données existantes',
          <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
            <Shield className="text-yellow-600" size={20} />
          </div>
        )}

        {report.alerts.length === 0 && (
          <div className="card p-12 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-xl font-semibold text-dark-800 mb-2">Aucune alerte</h3>
            <p className="text-dark-500">Votre schéma et vos données sont valides</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
