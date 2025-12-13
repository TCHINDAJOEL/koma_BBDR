import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { ValidationReport, ValidationAlert } from '@/types/schema';
import { AlertCircle, AlertTriangle, Info, CheckCircle, RefreshCw } from 'lucide-react';

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
        return <Info className="text-blue-500" size={20} />;
      default:
        return null;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warn':
        return 'bg-yellow-50 border-yellow-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const renderAlerts = (alerts: ValidationAlert[], title: string, description: string) => {
    if (alerts.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-4">{description}</p>

        <div className="space-y-3">
          {alerts.map((alert, index) => (
            <div
              key={index}
              className={`border rounded-lg p-4 ${getSeverityColor(alert.severity)}`}
            >
              <div className="flex items-start space-x-3">
                {getSeverityIcon(alert.severity)}
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="font-mono text-xs bg-white px-2 py-1 rounded">
                      {alert.code}
                    </span>
                    <span className="text-xs text-gray-500">{alert.location}</span>
                  </div>

                  <p className="text-sm font-medium text-gray-800 mb-2">{alert.message}</p>

                  {alert.suggestion && (
                    <p className="text-sm text-gray-600 mb-2">
                      <span className="font-semibold">Suggestion:</span> {alert.suggestion}
                    </p>
                  )}

                  {alert.context && (
                    <div className="text-xs text-gray-500 mt-2">
                      {alert.context.affectedCount !== undefined && (
                        <span className="mr-3">
                          Enregistrements affectés: {alert.context.affectedCount}
                        </span>
                      )}
                      {alert.context.table && (
                        <span className="mr-3">Table: {alert.context.table}</span>
                      )}
                      {alert.context.field && (
                        <span className="mr-3">Champ: {alert.context.field}</span>
                      )}
                    </div>
                  )}

                  {alert.quickFix && (
                    <button className="mt-3 px-3 py-1 bg-white border border-gray-300 rounded text-xs hover:bg-gray-50">
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
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500">Validation en cours...</p>
        </div>
      </Layout>
    );
  }

  if (!report) {
    return (
      <Layout>
        <div className="text-center">
          <p className="text-red-500">Erreur lors de la validation</p>
        </div>
      </Layout>
    );
  }

  const isValid = report.summary.errors === 0;

  return (
    <Layout>
      <div className="h-full flex flex-col">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-800">Validation Center</h2>
              <p className="text-gray-600 mt-2">
                Validation complète du schéma et des données (3 niveaux)
              </p>
            </div>

            <button
              onClick={runValidation}
              disabled={validating}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw size={18} className={validating ? 'animate-spin' : ''} />
              <span>Relancer</span>
            </button>
          </div>
        </div>

        {/* Summary Card */}
        <div className={`mb-6 p-6 rounded-lg border-2 ${isValid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center space-x-3 mb-4">
            {isValid ? (
              <CheckCircle className="text-green-600" size={32} />
            ) : (
              <AlertCircle className="text-red-600" size={32} />
            )}
            <div>
              <h3 className="text-xl font-bold">
                {isValid ? 'Validation réussie' : 'Validation échouée'}
              </h3>
              <p className="text-sm text-gray-600">
                Dernière validation: {new Date(report.timestamp).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="text-red-500" size={20} />
                <span className="text-2xl font-bold text-red-600">{report.summary.errors}</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">Erreurs</p>
            </div>

            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="text-yellow-500" size={20} />
                <span className="text-2xl font-bold text-yellow-600">{report.summary.warnings}</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">Avertissements</p>
            </div>

            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Info className="text-blue-500" size={20} />
                <span className="text-2xl font-bold text-blue-600">{report.summary.infos}</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">Infos</p>
            </div>
          </div>
        </div>

        {/* Validation Levels */}
        <div className="flex-1 overflow-auto bg-white rounded-lg shadow p-6">
          {renderAlerts(
            report.levelA,
            'Niveau A — Validation de structure (AJV)',
            'Validation du schéma et des données contre leurs JSON Schemas respectifs'
          )}

          {renderAlerts(
            report.levelB,
            'Niveau B — Intégrité relationnelle',
            'Validation des clés primaires, contraintes d\'unicité, et références FK'
          )}

          {renderAlerts(
            report.levelC,
            'Niveau C — Impact sur les données',
            'Analyse de l\'impact des contraintes du schéma sur les données existantes'
          )}

          {report.alerts.length === 0 && (
            <div className="text-center py-12">
              <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
              <p className="text-lg font-semibold text-gray-800">Aucune alerte</p>
              <p className="text-gray-600">Votre schéma et vos données sont valides</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
