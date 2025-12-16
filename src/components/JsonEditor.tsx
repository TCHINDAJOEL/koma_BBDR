import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { AlertCircle, CheckCircle } from 'lucide-react';

// Import dynamique pour éviter les erreurs SSR
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

// ============================================================================
// TYPES
// ============================================================================

export interface JsonEditorProps {
  value: object;
  schema?: object; // Schéma AJV pour validation
  onChange: (value: object, valid: boolean) => void;
  readOnly?: boolean;
  height?: string;
  placeholder?: string;
}

export interface ValidationError {
  path: string;
  message: string;
}

// ============================================================================
// AJV INSTANCE
// ============================================================================

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// ============================================================================
// COMPOSANT
// ============================================================================

export default function JsonEditor({
  value,
  schema,
  onChange,
  readOnly = false,
  height = '400px',
  placeholder,
}: JsonEditorProps) {
  const [jsonString, setJsonString] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isValid, setIsValid] = useState(true);

  // Compiler le schéma AJV
  const validateFn = useMemo(() => {
    if (!schema) return null;
    try {
      return ajv.compile(schema);
    } catch (err) {
      console.error('Erreur de compilation du schéma AJV:', err);
      return null;
    }
  }, [schema]);

  // Initialiser le JSON string depuis la valeur
  useEffect(() => {
    try {
      const formatted = JSON.stringify(value, null, 2);
      setJsonString(formatted);
      setParseError(null);
    } catch (err) {
      setParseError('Valeur initiale non sérialisable');
    }
  }, [value]);

  // Validation du JSON
  const validate = useCallback(
    (json: string): { valid: boolean; parsed?: object } => {
      // 1. Vérifier la syntaxe JSON
      let parsed: object;
      try {
        parsed = JSON.parse(json);
        setParseError(null);
      } catch (err: any) {
        setParseError(err.message || 'JSON invalide');
        setValidationErrors([]);
        setIsValid(false);
        return { valid: false };
      }

      // 2. Valider contre le schéma AJV si fourni
      if (validateFn) {
        const schemaValid = validateFn(parsed);
        if (!schemaValid && validateFn.errors) {
          const errors: ValidationError[] = validateFn.errors.map((err) => ({
            path: err.instancePath || '/',
            message: err.message || 'Erreur de validation',
          }));
          setValidationErrors(errors);
          setIsValid(false);
          return { valid: false, parsed };
        }
      }

      setValidationErrors([]);
      setIsValid(true);
      return { valid: true, parsed };
    },
    [validateFn]
  );

  // Handler de changement
  const handleChange = useCallback(
    (newValue: string | undefined) => {
      if (newValue === undefined) return;

      setJsonString(newValue);

      const result = validate(newValue);
      if (result.valid && result.parsed) {
        onChange(result.parsed, true);
      } else {
        onChange(value, false); // Garder l'ancienne valeur mais indiquer invalide
      }
    },
    [validate, onChange, value]
  );

  // Formater le JSON
  const formatJson = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonString);
      const formatted = JSON.stringify(parsed, null, 2);
      setJsonString(formatted);
      setParseError(null);
    } catch (err) {
      // Ignorer si le JSON est invalide
    }
  }, [jsonString]);

  // Couleur de la bordure selon la validité
  const borderColor = useMemo(() => {
    if (parseError) return 'border-red-500';
    if (validationErrors.length > 0) return 'border-orange-500';
    if (isValid) return 'border-green-500';
    return 'border-dark-200';
  }, [parseError, validationErrors, isValid]);

  return (
    <div className="flex flex-col h-full">
      {/* Barre d'outils */}
      <div className="flex items-center justify-between px-3 py-2 bg-dark-50 border-b border-dark-200 rounded-t-xl">
        <div className="flex items-center gap-2">
          {isValid ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-500" />
          )}
          <span className={`text-sm ${isValid ? 'text-green-600' : 'text-red-600'}`}>
            {isValid ? 'JSON valide' : 'JSON invalide'}
          </span>
        </div>
        {!readOnly && (
          <button
            onClick={formatJson}
            className="px-2 py-1 text-xs bg-primary-100 text-primary-700 rounded hover:bg-primary-200 transition-colors"
          >
            Formater
          </button>
        )}
      </div>

      {/* Éditeur Monaco */}
      <div className={`flex-1 border-2 ${borderColor} rounded-b-xl overflow-hidden transition-colors`}>
        <MonacoEditor
          height={height}
          defaultLanguage="json"
          value={jsonString}
          onChange={handleChange}
          theme="vs-dark"
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 14,
            padding: { top: 16, bottom: 16 },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            formatOnPaste: true,
            formatOnType: true,
            automaticLayout: true,
            tabSize: 2,
            lineNumbers: 'on',
            folding: true,
            bracketPairColorization: { enabled: true },
          }}
        />
      </div>

      {/* Affichage des erreurs */}
      {(parseError || validationErrors.length > 0) && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-xl max-h-32 overflow-y-auto">
          {parseError && (
            <div className="text-sm text-red-700 mb-1">
              <span className="font-medium">Erreur de syntaxe:</span> {parseError}
            </div>
          )}
          {validationErrors.map((err, index) => (
            <div key={index} className="text-sm text-orange-700">
              <span className="font-mono text-xs bg-orange-100 px-1 rounded">
                {err.path}
              </span>{' '}
              {err.message}
            </div>
          ))}
        </div>
      )}

      {/* Placeholder si vide */}
      {jsonString === '{}' && placeholder && (
        <div className="mt-2 text-sm text-dark-400 italic">
          {placeholder}
        </div>
      )}
    </div>
  );
}
