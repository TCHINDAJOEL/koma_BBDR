import { useState } from 'react';
import Layout from '@/components/Layout';
import { Upload, CheckCircle, XCircle } from 'lucide-react';
import { useRouter } from 'next/router';

export default function Import() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const router = useRouter();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
        setResult({ success: true, message: 'Import réussi ! Redirection...' });
        setTimeout(() => {
          router.push('/');
        }, 2000);
      } else {
        setResult({ success: false, message: data.error || 'Erreur lors de l\'import' });
      }
    } catch (error: any) {
      setResult({ success: false, message: error.message || 'Erreur réseau' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-800">Import ZIP</h2>
          <p className="text-gray-600 mt-2">
            Importez un projet complet depuis un fichier ZIP exporté
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-8">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
            <Upload className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Sélectionnez un fichier ZIP
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Le ZIP doit contenir : schema.json, data/ (dossier), rules.json, audit.ndjson
            </p>

            <label className="cursor-pointer inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <input
                type="file"
                accept=".zip"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
              {uploading ? 'Import en cours...' : 'Choisir un fichier'}
            </label>
          </div>

          {result && (
            <div
              className={`mt-6 p-4 rounded-lg flex items-center space-x-3 ${
                result.success
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              {result.success ? (
                <CheckCircle className="text-green-600" size={24} />
              ) : (
                <XCircle className="text-red-600" size={24} />
              )}
              <p
                className={`${
                  result.success ? 'text-green-800' : 'text-red-800'
                } font-medium`}
              >
                {result.message}
              </p>
            </div>
          )}
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h4 className="font-semibold text-blue-900 mb-3">Structure du ZIP attendue</h4>
          <pre className="text-xs text-blue-800 bg-white p-3 rounded mb-3 overflow-x-auto">
{`project.zip
├── schema.json
├── data/
│   ├── table1.json
│   ├── table2.json
│   └── ...
├── rules.json
└── audit.ndjson`}
          </pre>
          <h4 className="font-semibold text-blue-900 mb-2 mt-4">Notes importantes</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• L'import écrasera les fichiers existants</li>
            <li>• Le dossier <code className="bg-white px-1 rounded">data/</code> doit contenir un fichier JSON par table</li>
            <li>• Un événement d'audit sera créé pour tracer l'import</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}
