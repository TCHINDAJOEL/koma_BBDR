import { useState } from 'react';
import Layout from '@/components/Layout';
import {
  Upload,
  CheckCircle,
  XCircle,
  FileSpreadsheet,
  ArrowRight,
  AlertCircle,
  Table,
  AlertTriangle,
  Info
} from 'lucide-react';
import { useRouter } from 'next/router';
import { updateCacheVersion } from '@/lib/cache-helper';

// Formats supportés
const SUPPORTED_FORMATS = [
  { ext: '.xlsx', name: 'XLSX', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  { ext: '.xls', name: 'XLS', mime: 'application/vnd.ms-excel' },
];

const ACCEPT_EXTENSIONS = SUPPORTED_FORMATS.map(f => f.ext).join(',');

interface ImportedSheet {
  name: string;
  matchedTable: string | null;
  rowCount: number;
  columnCount: number;
  columns: string[];
  warnings: string[];
}

interface ImportResult {
  success: boolean;
  message: string;
  details?: {
    format: string;
    sheetsProcessed: number;
    tablesUpdated: number;
    totalRecordsImported: number;
    sheets: ImportedSheet[];
  };
}

export default function ImportExcel() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const router = useRouter();

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setSelectedFile(file);
    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/import-excel', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        // Mettre à jour la version du cache pour forcer le rechargement sur toutes les pages
        if (data.details?.tablesUpdated > 0) {
          updateCacheVersion();
        }

        setResult({
          success: true,
          message: data.message,
          details: data.details
        });

        // Rediriger après un délai si des données ont été importées
        if (data.details?.tablesUpdated > 0) {
          setTimeout(() => {
            // Forcer un rechargement complet pour vider le cache côté client
            window.location.href = '/data';
          }, 5000);
        }
      } else {
        setResult({ success: false, message: data.error || 'Erreur lors de l\'import' });
      }
    } catch (error: any) {
      setResult({ success: false, message: error.message || 'Erreur réseau' });
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto animate-fade-in">
        {/* Hero Section - Glass Style */}
        <div className="hero-glass p-10 mb-10 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.9) 0%, rgba(5, 150, 105, 0.95) 50%, rgba(4, 120, 87, 0.9) 100%)' }}>
          <div className="relative z-10 flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <FileSpreadsheet className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
                Import Excel
              </h1>
              <p className="text-white/70 text-lg">
                Importez vos données depuis un fichier Excel multi-onglets
              </p>
            </div>
          </div>
        </div>

        {/* Supported Formats */}
        <div className="card p-4 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <FileSpreadsheet className="text-green-600" size={20} />
            <h4 className="font-semibold text-dark-800">Formats supportés</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {SUPPORTED_FORMATS.map((format) => (
              <span
                key={format.ext}
                className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium"
              >
                {format.name}
              </span>
            ))}
          </div>
        </div>

        {/* Upload Zone */}
        <div className="card overflow-hidden mb-8">
          <div
            className={`p-12 border-2 border-dashed rounded-xl m-4 transition-all duration-200 ${
              dragActive
                ? 'border-green-500 bg-green-50'
                : 'border-dark-200 hover:border-green-400 hover:bg-dark-50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="text-center">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center transition-colors ${
                dragActive ? 'bg-green-100' : 'bg-dark-100'
              }`}>
                <FileSpreadsheet className={`w-8 h-8 ${dragActive ? 'text-green-600' : 'text-dark-400'}`} />
              </div>

              <h3 className="text-lg font-semibold text-dark-800 mb-2">
                {dragActive ? 'Déposez le fichier ici' : 'Glissez-déposez votre fichier Excel'}
              </h3>

              <p className="text-sm text-dark-500 mb-6">
                ou cliquez pour sélectionner un fichier
              </p>

              <label className={`btn ${uploading ? 'bg-gray-400 cursor-wait' : 'bg-green-600 hover:bg-green-700'} text-white cursor-pointer`}>
                <input
                  type="file"
                  accept={ACCEPT_EXTENSIONS}
                  onChange={handleInputChange}
                  disabled={uploading}
                  className="hidden"
                />
                {uploading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                    Import en cours...
                  </>
                ) : (
                  <>
                    <Upload size={18} className="mr-2" />
                    Choisir un fichier Excel
                  </>
                )}
              </label>
            </div>
          </div>

          {/* Selected file info */}
          {selectedFile && !result && (
            <div className="mx-4 mb-4 p-4 bg-dark-50 rounded-xl flex items-center gap-3">
              <FileSpreadsheet className="text-green-600" size={20} />
              <div className="flex-1">
                <p className="font-medium text-dark-800">{selectedFile.name}</p>
                <p className="text-xs text-dark-500">{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>
          )}

          {/* Result message */}
          {result && (
            <div className={`mx-4 mb-4 rounded-xl animate-fade-in ${
              result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-start gap-3 p-4">
                {result.success ? (
                  <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={24} />
                ) : (
                  <XCircle className="text-red-600 flex-shrink-0 mt-0.5" size={24} />
                )}
                <div className="flex-1">
                  <p className={`font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                    {result.message}
                  </p>

                  {result.success && result.details && (
                    <div className="mt-4 space-y-4">
                      {/* Stats globales */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white rounded-lg p-3 text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {result.details.sheetsProcessed}
                          </div>
                          <div className="text-xs text-dark-500">Onglets traités</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {result.details.tablesUpdated}
                          </div>
                          <div className="text-xs text-dark-500">Tables mises à jour</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {result.details.totalRecordsImported}
                          </div>
                          <div className="text-xs text-dark-500">Enregistrements</div>
                        </div>
                      </div>

                      {/* Détails par onglet */}
                      {result.details.sheets.length > 0 && (
                        <div className="bg-white rounded-lg p-4">
                          <h4 className="font-semibold text-dark-800 mb-3 flex items-center gap-2">
                            <Table size={18} />
                            Détails par onglet
                          </h4>
                          <div className="space-y-2">
                            {result.details.sheets.map((sheet, index) => (
                              <div
                                key={index}
                                className={`p-3 rounded-lg ${
                                  sheet.matchedTable
                                    ? 'bg-green-50 border border-green-200'
                                    : 'bg-yellow-50 border border-yellow-200'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {sheet.matchedTable ? (
                                      <CheckCircle size={16} className="text-green-600" />
                                    ) : (
                                      <AlertTriangle size={16} className="text-yellow-600" />
                                    )}
                                    <span className="font-medium">{sheet.name}</span>
                                  </div>
                                  <span className="text-sm text-dark-500">
                                    {sheet.rowCount} lignes
                                  </span>
                                </div>
                                {sheet.matchedTable && (
                                  <p className="text-sm text-green-700 mt-1 ml-6">
                                    → Table: <code className="bg-green-100 px-1.5 py-0.5 rounded">{sheet.matchedTable}</code>
                                  </p>
                                )}
                                {sheet.warnings.length > 0 && (
                                  <div className="mt-2 ml-6 space-y-1">
                                    {sheet.warnings.map((warning, i) => (
                                      <p key={i} className="text-xs text-yellow-700 flex items-center gap-1">
                                        <AlertCircle size={12} />
                                        {warning}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {result.details.tablesUpdated > 0 && (
                        <p className="text-sm text-green-600 text-center">
                          Redirection vers les données dans 5 secondes...
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Info className="text-green-600" size={20} />
            </div>
            <h4 className="font-semibold text-dark-900">Comment ça marche ?</h4>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
              <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                1
              </div>
              <div className="text-sm text-green-800">
                <span className="font-medium">Mapping automatique:</span> Chaque onglet est automatiquement associé à une table du schéma en fonction de son nom
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
              <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                2
              </div>
              <div className="text-sm text-green-800">
                <span className="font-medium">Colonnes intelligentes:</span> Les colonnes sont mappées aux champs en utilisant les noms ou labels définis dans le schéma
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
              <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                3
              </div>
              <div className="text-sm text-green-800">
                <span className="font-medium">Conversion de types:</span> Les valeurs sont automatiquement converties selon le type de champ (nombres, dates, booléens...)
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
              <AlertTriangle className="text-yellow-600 flex-shrink-0 mt-0.5" size={18} />
              <div className="text-sm text-yellow-800">
                <span className="font-medium">Attention:</span> L'import remplace les données existantes des tables correspondantes
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-primary-50 border border-primary-200 rounded-xl">
              <ArrowRight className="text-primary-600 flex-shrink-0 mt-0.5" size={18} />
              <div className="text-sm text-primary-700">
                <span className="font-medium">Astuce:</span> Utilisez d'abord <strong>Export Excel</strong> pour obtenir un fichier template avec le bon format
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
