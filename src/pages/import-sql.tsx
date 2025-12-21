import { useState, useCallback } from 'react';
import Layout from '@/components/Layout';
import {
  Upload,
  CheckCircle,
  XCircle,
  FileCode,
  ArrowRight,
  AlertCircle,
  Table,
  AlertTriangle,
  Info,
  FileText,
  Copy,
  Trash2
} from 'lucide-react';
import { useRouter } from 'next/router';
import { updateCacheVersion } from '@/lib/cache-helper';
import dynamic from 'next/dynamic';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface ImportResult {
  success: boolean;
  tablesImported: string[];
  recordsImported: number;
  errors: string[];
  warnings: string[];
}

type ImportMode = 'merge' | 'replace';

export default function ImportSQL() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sqlContent, setSqlContent] = useState<string>('');
  const [inputMode, setInputMode] = useState<'file' | 'paste'>('file');
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const router = useRouter();

  const handleImport = async (sql: string) => {
    if (!sql.trim()) return;

    setUploading(true);
    setResult(null);

    try {
      const res = await fetch('/api/import-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql, mode: importMode }),
      });

      const data = await res.json();

      if (res.ok) {
        // Mettre à jour la version du cache pour forcer le rechargement
        if (data.recordsImported > 0) {
          updateCacheVersion();
        }

        setResult(data);

        // Rediriger après un délai si des données ont été importées
        if (data.recordsImported > 0) {
          setTimeout(() => {
            window.location.href = '/data';
          }, 5000);
        }
      } else {
        setResult({
          success: false,
          tablesImported: [],
          recordsImported: 0,
          errors: [data.error || 'Erreur lors de l\'import'],
          warnings: []
        });
      }
    } catch (error: any) {
      setResult({
        success: false,
        tablesImported: [],
        recordsImported: 0,
        errors: [error.message || 'Erreur réseau'],
        warnings: []
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setSelectedFile(file);

    try {
      const content = await file.text();
      setSqlContent(content);
      handleImport(content);
    } catch (error: any) {
      setResult({
        success: false,
        tablesImported: [],
        recordsImported: 0,
        errors: ['Impossible de lire le fichier'],
        warnings: []
      });
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

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setSqlContent(text);
    } catch (error) {
      // Fallback pour les navigateurs qui ne supportent pas clipboard API
    }
  }, []);

  const handleSubmitPaste = () => {
    if (sqlContent.trim()) {
      handleImport(sqlContent);
    }
  };

  const handleClear = () => {
    setSqlContent('');
    setSelectedFile(null);
    setResult(null);
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
        <div className="hero-glass p-10 mb-10 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.9) 0%, rgba(217, 119, 6, 0.95) 50%, rgba(180, 83, 9, 0.9) 100%)' }}>
          <div className="relative z-10 flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <FileCode className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
                Import SQL
              </h1>
              <p className="text-white/70 text-lg">
                Importez vos données depuis des INSERT statements SQL
              </p>
            </div>
          </div>
        </div>

        {/* Mode Selection */}
        <div className="card p-4 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <h4 className="font-semibold text-dark-800">Mode d'import</h4>
            <div className="flex gap-2">
              <button
                onClick={() => setImportMode('merge')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  importMode === 'merge'
                    ? 'bg-amber-100 text-amber-800 border-2 border-amber-400'
                    : 'bg-dark-100 text-dark-600 border-2 border-transparent hover:bg-dark-200'
                }`}
              >
                Fusionner
              </button>
              <button
                onClick={() => setImportMode('replace')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  importMode === 'replace'
                    ? 'bg-red-100 text-red-800 border-2 border-red-400'
                    : 'bg-dark-100 text-dark-600 border-2 border-transparent hover:bg-dark-200'
                }`}
              >
                Remplacer
              </button>
            </div>
          </div>
          <p className="text-sm text-dark-500">
            {importMode === 'merge'
              ? 'Les nouvelles données seront fusionnées avec les données existantes'
              : 'Les données existantes seront remplacées par les nouvelles données'
            }
          </p>
        </div>

        {/* Input Mode Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setInputMode('file')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              inputMode === 'file'
                ? 'bg-amber-500 text-white'
                : 'bg-dark-100 text-dark-600 hover:bg-dark-200'
            }`}
          >
            <Upload size={18} />
            Fichier
          </button>
          <button
            onClick={() => setInputMode('paste')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              inputMode === 'paste'
                ? 'bg-amber-500 text-white'
                : 'bg-dark-100 text-dark-600 hover:bg-dark-200'
            }`}
          >
            <FileText size={18} />
            Coller SQL
          </button>
        </div>

        {/* Upload Zone (File Mode) */}
        {inputMode === 'file' && (
          <div className="card overflow-hidden mb-8">
            <div
              className={`p-12 border-2 border-dashed rounded-xl m-4 transition-all duration-200 ${
                dragActive
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-dark-200 hover:border-amber-400 hover:bg-dark-50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className="text-center">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center transition-colors ${
                  dragActive ? 'bg-amber-100' : 'bg-dark-100'
                }`}>
                  <FileCode className={`w-8 h-8 ${dragActive ? 'text-amber-600' : 'text-dark-400'}`} />
                </div>

                <h3 className="text-lg font-semibold text-dark-800 mb-2">
                  {dragActive ? 'Déposez le fichier ici' : 'Glissez-déposez votre fichier SQL'}
                </h3>

                <p className="text-sm text-dark-500 mb-6">
                  ou cliquez pour sélectionner un fichier
                </p>

                <label className={`btn ${uploading ? 'bg-gray-400 cursor-wait' : 'bg-amber-600 hover:bg-amber-700'} text-white cursor-pointer`}>
                  <input
                    type="file"
                    accept=".sql,.txt"
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
                      Choisir un fichier SQL
                    </>
                  )}
                </label>
              </div>
            </div>

            {/* Selected file info */}
            {selectedFile && !result && (
              <div className="mx-4 mb-4 p-4 bg-dark-50 rounded-xl flex items-center gap-3">
                <FileCode className="text-amber-600" size={20} />
                <div className="flex-1">
                  <p className="font-medium text-dark-800">{selectedFile.name}</p>
                  <p className="text-xs text-dark-500">{formatFileSize(selectedFile.size)}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Paste Mode */}
        {inputMode === 'paste' && (
          <div className="card overflow-hidden mb-8">
            <div className="p-4 border-b border-dark-100 flex items-center justify-between">
              <h4 className="font-semibold text-dark-800">Code SQL</h4>
              <div className="flex gap-2">
                <button
                  onClick={handlePaste}
                  className="btn btn-secondary text-sm gap-1"
                >
                  <Copy size={16} />
                  Coller
                </button>
                <button
                  onClick={handleClear}
                  className="btn btn-secondary text-sm gap-1"
                >
                  <Trash2 size={16} />
                  Effacer
                </button>
              </div>
            </div>
            <div className="h-[400px]">
              <MonacoEditor
                height="100%"
                defaultLanguage="sql"
                value={sqlContent}
                onChange={(value) => setSqlContent(value || '')}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  padding: { top: 16 },
                  scrollBeyondLastLine: false,
                  fontFamily: "'SF Mono', 'Fira Code', monospace",
                  fontLigatures: true,
                  cursorBlinking: 'smooth',
                  smoothScrolling: true,
                  renderLineHighlight: 'all',
                }}
              />
            </div>
            <div className="p-4 border-t border-dark-100 flex justify-end">
              <button
                onClick={handleSubmitPaste}
                disabled={uploading || !sqlContent.trim()}
                className={`btn ${uploading || !sqlContent.trim() ? 'bg-gray-400 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-700'} text-white gap-2`}
              >
                {uploading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Import en cours...
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    Importer les données
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Result message */}
        {result && (
          <div className={`card mb-8 animate-fade-in ${
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
                  {result.success
                    ? `Import réussi: ${result.recordsImported} enregistrements importés`
                    : 'Erreur lors de l\'import'
                  }
                </p>

                {result.success && result.tablesImported.length > 0 && (
                  <div className="mt-4 space-y-4">
                    {/* Stats globales */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {result.tablesImported.length}
                        </div>
                        <div className="text-xs text-dark-500">Tables importées</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {result.recordsImported}
                        </div>
                        <div className="text-xs text-dark-500">Enregistrements</div>
                      </div>
                    </div>

                    {/* Tables importées */}
                    <div className="bg-white rounded-lg p-4">
                      <h4 className="font-semibold text-dark-800 mb-3 flex items-center gap-2">
                        <Table size={18} />
                        Tables importées
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {result.tablesImported.map((table, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium"
                          >
                            {table}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Warnings */}
                    {result.warnings.length > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h4 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                          <AlertTriangle size={18} />
                          Avertissements
                        </h4>
                        <ul className="space-y-1 text-sm text-yellow-700">
                          {result.warnings.map((warning, index) => (
                            <li key={index} className="flex items-center gap-2">
                              <AlertCircle size={14} />
                              {warning}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {result.recordsImported > 0 && (
                      <p className="text-sm text-green-600 text-center">
                        Redirection vers les données dans 5 secondes...
                      </p>
                    )}
                  </div>
                )}

                {/* Errors */}
                {result.errors.length > 0 && (
                  <div className="mt-4">
                    <ul className="space-y-1 text-sm text-red-700">
                      {result.errors.map((error, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <AlertCircle size={14} />
                          {error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Info Section */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Info className="text-amber-600" size={20} />
            </div>
            <h4 className="font-semibold text-dark-900">Format SQL supporté</h4>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                1
              </div>
              <div className="text-sm text-amber-800">
                <span className="font-medium">INSERT statements:</span> Seuls les INSERT INTO sont traités. Les CREATE TABLE sont ignorés
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                2
              </div>
              <div className="text-sm text-amber-800">
                <span className="font-medium">Format supporté:</span> <code className="bg-amber-100 px-1 rounded">INSERT INTO table (col1, col2) VALUES (val1, val2);</code>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                3
              </div>
              <div className="text-sm text-amber-800">
                <span className="font-medium">Types de données:</span> Les NULL, nombres, booléens et JSON sont automatiquement convertis
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-primary-50 border border-primary-200 rounded-xl">
              <ArrowRight className="text-primary-600 flex-shrink-0 mt-0.5" size={18} />
              <div className="text-sm text-primary-700">
                <span className="font-medium">Astuce:</span> Utilisez <strong>Export SQL</strong> pour obtenir un fichier SQL compatible avec l'import
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
