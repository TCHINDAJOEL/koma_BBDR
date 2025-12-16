import { useState } from 'react';
import Layout from '@/components/Layout';
import {
  Upload,
  CheckCircle,
  XCircle,
  FileArchive,
  ArrowRight,
  FolderTree,
  AlertCircle,
  Package,
  File
} from 'lucide-react';
import { useRouter } from 'next/router';
import { updateCacheVersion } from '@/lib/cache-helper';

// Formats supportés
const SUPPORTED_FORMATS = [
  { ext: '.zip', name: 'ZIP', mime: 'application/zip' },
  { ext: '.tar', name: 'TAR', mime: 'application/x-tar' },
  { ext: '.tar.gz', name: 'TAR.GZ', mime: 'application/gzip' },
  { ext: '.tgz', name: 'TGZ', mime: 'application/gzip' },
  { ext: '.tar.bz2', name: 'TAR.BZ2', mime: 'application/x-bzip2' },
  { ext: '.tbz2', name: 'TBZ2', mime: 'application/x-bzip2' },
  { ext: '.tbz', name: 'TBZ', mime: 'application/x-bzip2' },
];

const ACCEPT_EXTENSIONS = SUPPORTED_FORMATS.map(f => f.ext).join(',');

interface ImportResult {
  success: boolean;
  message: string;
  details?: {
    format: string;
    filesExtracted: number;
    tablesImported: number;
    tableNames?: string[];
    hasSchema: boolean;
    hasRules: boolean;
    hasAudit: boolean;
  };
}

export default function Import() {
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

      const res = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        // Mettre à jour la version du cache pour forcer le rechargement sur toutes les pages
        updateCacheVersion();

        setResult({
          success: true,
          message: 'Import réussi ! Redirection...',
          details: data.details
        });
        setTimeout(() => {
          // Forcer un rechargement complet avec invalidation du cache
          window.location.href = '/?reload=true';
        }, 3000);
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
      <div className="max-w-3xl mx-auto animate-fade-in">
        {/* Hero Section */}
        <div className="card p-8 mb-8 gradient-hero text-white">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center">
              <Upload className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-1">Import Archive</h1>
              <p className="text-primary-200">
                Importez un projet complet depuis une archive compressée
              </p>
            </div>
          </div>
        </div>

        {/* Supported Formats */}
        <div className="card p-4 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Package className="text-primary-600" size={20} />
            <h4 className="font-semibold text-dark-800">Formats supportés</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {SUPPORTED_FORMATS.map((format) => (
              <span
                key={format.ext}
                className="badge badge-primary"
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
                ? 'border-primary-500 bg-primary-50'
                : 'border-dark-200 hover:border-primary-400 hover:bg-dark-50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="text-center">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center transition-colors ${
                dragActive ? 'bg-primary-100' : 'bg-dark-100'
              }`}>
                <FileArchive className={`w-8 h-8 ${dragActive ? 'text-primary-600' : 'text-dark-400'}`} />
              </div>

              <h3 className="text-lg font-semibold text-dark-800 mb-2">
                {dragActive ? 'Déposez le fichier ici' : 'Glissez-déposez votre archive'}
              </h3>

              <p className="text-sm text-dark-500 mb-6">
                ou cliquez pour sélectionner un fichier
              </p>

              <label className={`btn ${uploading ? 'btn-secondary cursor-wait' : 'btn-primary'} cursor-pointer`}>
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
                    Choisir un fichier
                  </>
                )}
              </label>
            </div>
          </div>

          {/* Selected file info */}
          {selectedFile && !result && (
            <div className="mx-4 mb-4 p-4 bg-dark-50 rounded-xl flex items-center gap-3">
              <File className="text-dark-500" size={20} />
              <div className="flex-1">
                <p className="font-medium text-dark-800">{selectedFile.name}</p>
                <p className="text-xs text-dark-500">{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>
          )}

          {/* Result message */}
          {result && (
            <div className={`mx-4 mb-4 rounded-xl animate-fade-in ${
              result.success ? 'alert-success' : 'alert-danger'
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
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-green-600">Format:</span>
                          <span className="font-mono">{result.details.format.toUpperCase()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-green-600">Fichiers extraits:</span>
                          <span className="font-semibold">{result.details.filesExtracted}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-green-600">Tables importées:</span>
                          <span className="font-semibold">{result.details.tablesImported}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-green-600">Schéma:</span>
                          <span>{result.details.hasSchema ? '✓' : '✗'}</span>
                        </div>
                      </div>
                      {result.details.tableNames && result.details.tableNames.length > 0 && (
                        <div className="pt-2 border-t border-green-200">
                          <span className="text-green-600 font-medium">Tables:</span>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {result.details.tableNames.map((name) => (
                              <span key={name} className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-mono">
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Structure Info */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <FolderTree className="text-primary-600" size={20} />
            </div>
            <h4 className="font-semibold text-dark-900">Structure de l'archive attendue</h4>
          </div>

          <div className="bg-dark-50 rounded-xl p-4 mb-6 overflow-x-auto">
            <pre className="text-sm font-mono text-dark-700">
{`archive.[zip|tar|tar.gz|...]
├── schema.json
├── data/
│   ├── table1.json
│   ├── table2.json
│   └── ...
├── rules.json
└── audit.ndjson`}
            </pre>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
              <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={18} />
              <div className="text-sm">
                <span className="font-medium text-yellow-800">Attention:</span>
                <span className="text-yellow-700 ml-1">L'import écrasera les fichiers existants</span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-primary-50 border border-primary-200 rounded-xl">
              <ArrowRight className="text-primary-600 flex-shrink-0 mt-0.5" size={18} />
              <div className="text-sm text-primary-700">
                Le dossier <code className="bg-white px-1.5 py-0.5 rounded font-mono text-xs">data/</code> doit contenir un fichier JSON par table
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-accent-50 border border-accent-200 rounded-xl">
              <CheckCircle className="text-accent-600 flex-shrink-0 mt-0.5" size={18} />
              <div className="text-sm text-accent-700">
                Un événement d'audit sera créé automatiquement pour tracer l'import
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-dark-50 border border-dark-200 rounded-xl">
              <Package className="text-dark-600 flex-shrink-0 mt-0.5" size={18} />
              <div className="text-sm text-dark-700">
                <span className="font-medium">Formats supportés:</span>{' '}
                {SUPPORTED_FORMATS.map(f => f.name).join(', ')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
