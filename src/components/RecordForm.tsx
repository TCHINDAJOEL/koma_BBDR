import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import {
  TableDefinition,
  FieldDefinition,
  DataRecord,
} from '@/types/schema';
import {
  generateAjvSchema,
  validateRecordClient,
  generateRecordId,
  convertFieldValue,
} from '@/lib/record-helpers';
import JsonEditor from './JsonEditor';
import { FileText, Code, X, Save, AlertCircle } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface RecordFormProps {
  table: TableDefinition;
  record?: DataRecord; // undefined = création
  onSave: (record: DataRecord) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

type FormMode = 'form' | 'json';

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export default function RecordForm({
  table,
  record,
  onSave,
  onCancel,
  loading = false,
}: RecordFormProps) {
  const [mode, setMode] = useState<FormMode>('form');
  const [jsonValue, setJsonValue] = useState<object>({});
  const [jsonValid, setJsonValid] = useState(true);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const isEditing = !!record;

  // React Hook Form
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: record || { id: generateRecordId() },
  });

  // Générer le schéma AJV pour la validation JSON
  const ajvSchema = useMemo(() => generateAjvSchema(table), [table]);

  // Initialiser les valeurs
  useEffect(() => {
    if (record) {
      reset(record);
      setJsonValue(record);
    } else {
      const defaultValues: Record<string, any> = { id: generateRecordId() };
      table.fields.forEach((field) => {
        if (field.default !== undefined) {
          defaultValues[field.name] = field.default;
        }
      });
      reset(defaultValues);
      setJsonValue(defaultValues);
    }
  }, [record, reset, table]);

  // Synchroniser le formulaire vers JSON quand on change d'onglet
  const syncFormToJson = useCallback(() => {
    const formValues = watch();
    const converted: Record<string, any> = { id: formValues.id };

    table.fields.forEach((field) => {
      const value = formValues[field.name];
      converted[field.name] = convertFieldValue(value, field.type);
    });

    setJsonValue(converted);
  }, [watch, table]);

  // Synchroniser JSON vers le formulaire
  const syncJsonToForm = useCallback(
    (json: object) => {
      const data = json as Record<string, any>;
      Object.keys(data).forEach((key) => {
        setValue(key, data[key]);
      });
    },
    [setValue]
  );

  // Changement de mode
  const handleModeChange = (newMode: FormMode) => {
    if (newMode === 'json' && mode === 'form') {
      syncFormToJson();
    } else if (newMode === 'form' && mode === 'json') {
      syncJsonToForm(jsonValue);
    }
    setMode(newMode);
  };

  // Handler JSON
  const handleJsonChange = (value: object, valid: boolean) => {
    setJsonValue(value);
    setJsonValid(valid);
  };

  // Soumission du formulaire
  const onSubmitForm = async (formData: any) => {
    setSaving(true);
    setFormErrors([]);

    try {
      // Construire le record avec conversions de type
      const recordData: DataRecord = {
        id: formData.id || generateRecordId(),
      };

      table.fields.forEach((field) => {
        const value = formData[field.name];
        recordData[field.name] = convertFieldValue(value, field.type);
      });

      // Validation côté client
      const validation = validateRecordClient(recordData, table);
      if (!validation.valid) {
        setFormErrors(validation.errors.map((e) => e.message));
        setSaving(false);
        return;
      }

      await onSave(recordData);
    } catch (err: any) {
      setFormErrors([err.message || 'Erreur lors de la sauvegarde']);
    } finally {
      setSaving(false);
    }
  };

  // Soumission depuis JSON
  const onSubmitJson = async () => {
    if (!jsonValid) {
      setFormErrors(['Le JSON contient des erreurs de validation']);
      return;
    }

    setSaving(true);
    setFormErrors([]);

    try {
      const recordData = jsonValue as DataRecord;

      // S'assurer qu'il y a un ID
      if (!recordData.id) {
        recordData.id = generateRecordId();
      }

      // Validation côté client
      const validation = validateRecordClient(recordData, table);
      if (!validation.valid) {
        setFormErrors(validation.errors.map((e) => e.message));
        setSaving(false);
        return;
      }

      await onSave(recordData);
    } catch (err: any) {
      setFormErrors([err.message || 'Erreur lors de la sauvegarde']);
    } finally {
      setSaving(false);
    }
  };

  const isSaving = saving || loading;

  return (
    <div className="flex flex-col h-full">
      {/* Onglets */}
      <div className="flex border-b border-dark-200 mb-4">
        <button
          type="button"
          onClick={() => handleModeChange('form')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
            mode === 'form'
              ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
              : 'text-dark-500 hover:text-dark-700 hover:bg-dark-50'
          }`}
        >
          <FileText size={18} />
          Formulaire
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('json')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
            mode === 'json'
              ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
              : 'text-dark-500 hover:text-dark-700 hover:bg-dark-50'
          }`}
        >
          <Code size={18} />
          JSON
        </button>
      </div>

      {/* Affichage des erreurs */}
      {formErrors.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              {formErrors.map((error, index) => (
                <p key={index} className="text-sm text-red-700">
                  {error}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Contenu selon le mode */}
      <div className="flex-1 overflow-auto">
        {mode === 'form' ? (
          <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4">
            {/* Champ ID (lecture seule en édition) */}
            <div>
              <label className="block text-sm font-medium text-dark-700 mb-1.5">
                ID
              </label>
              <input
                type="text"
                {...register('id')}
                readOnly={isEditing}
                className={`input ${isEditing ? 'bg-dark-100 cursor-not-allowed' : ''}`}
              />
            </div>

            {/* Champs dynamiques */}
            {table.fields.map((field) => (
              <FieldInput
                key={field.name}
                field={field}
                register={register}
                errors={errors}
              />
            ))}

            {/* Boutons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-dark-100">
              <button
                type="button"
                onClick={onCancel}
                disabled={isSaving}
                className="btn btn-secondary"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="btn btn-primary gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sauvegarde...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    {isEditing ? 'Mettre à jour' : 'Créer'}
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col h-full">
            <JsonEditor
              value={jsonValue}
              schema={ajvSchema}
              onChange={handleJsonChange}
              height="300px"
              placeholder="Entrez les données JSON de l'enregistrement"
            />

            {/* Boutons */}
            <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-dark-100">
              <button
                type="button"
                onClick={onCancel}
                disabled={isSaving}
                className="btn btn-secondary"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={onSubmitJson}
                disabled={isSaving || !jsonValid}
                className={`btn gap-2 ${
                  jsonValid ? 'btn-primary' : 'btn-ghost opacity-50 cursor-not-allowed'
                }`}
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sauvegarde...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    {isEditing ? 'Mettre à jour' : 'Créer'}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// COMPOSANT FIELD INPUT
// ============================================================================

interface FieldInputProps {
  field: FieldDefinition;
  register: any;
  errors: any;
}

function FieldInput({ field, register, errors }: FieldInputProps) {
  const hasError = errors[field.name];

  const baseClassName = `input ${hasError ? 'border-red-500 focus:ring-red-500' : ''}`;

  const renderInput = () => {
    switch (field.type) {
      case 'boolean':
        return (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              {...register(field.name)}
              className="h-5 w-5 rounded border-dark-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-dark-600">
              {field.description || `Activer ${field.label || field.name}`}
            </span>
          </div>
        );

      case 'enum':
        return (
          <select
            {...register(field.name)}
            className="select"
          >
            <option value="">Sélectionner...</option>
            {field.enumValues?.map((val) => (
              <option key={val} value={val}>
                {val}
              </option>
            ))}
          </select>
        );

      case 'number':
      case 'integer':
        return (
          <input
            type="number"
            step={field.type === 'integer' ? '1' : 'any'}
            {...register(field.name, {
              min: field.min,
              max: field.max,
              valueAsNumber: true,
            })}
            min={field.min}
            max={field.max}
            className={baseClassName}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            {...register(field.name)}
            className={baseClassName}
          />
        );

      case 'datetime':
        return (
          <input
            type="datetime-local"
            {...register(field.name)}
            className={baseClassName}
          />
        );

      case 'json':
        return (
          <textarea
            {...register(field.name)}
            rows={4}
            placeholder='{"key": "value"}'
            className={`${baseClassName} font-mono text-sm`}
          />
        );

      case 'string':
      default:
        // Utiliser textarea si description longue ou max > 200
        if (field.max && field.max > 200) {
          return (
            <textarea
              {...register(field.name, {
                minLength: field.min,
                maxLength: field.max,
                pattern: field.regex ? new RegExp(field.regex) : undefined,
              })}
              rows={3}
              className={baseClassName}
            />
          );
        }

        return (
          <input
            type="text"
            {...register(field.name, {
              minLength: field.min,
              maxLength: field.max,
              pattern: field.regex ? new RegExp(field.regex) : undefined,
            })}
            className={baseClassName}
          />
        );
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-dark-700 mb-1.5">
        {field.label || field.name}
      </label>

      {renderInput()}

      {/* Description du champ */}
      {field.description && (
        <p className="mt-1 text-xs text-dark-500">{field.description}</p>
      )}

      {/* Contraintes */}
      {(field.min !== undefined || field.max !== undefined) && field.type !== 'boolean' && (
        <p className="mt-1 text-xs text-dark-400">
          {field.type === 'string'
            ? `${field.min ? `Min: ${field.min} car.` : ''} ${field.max ? `Max: ${field.max} car.` : ''}`
            : `${field.min !== undefined ? `Min: ${field.min}` : ''} ${field.max !== undefined ? `Max: ${field.max}` : ''}`}
        </p>
      )}

      {/* Erreur de validation */}
      {hasError && (
        <p className="mt-1 text-xs text-red-600">
          {hasError.type === 'required' && 'Ce champ est requis'}
          {hasError.type === 'minLength' && `Minimum ${field.min} caractères`}
          {hasError.type === 'maxLength' && `Maximum ${field.max} caractères`}
          {hasError.type === 'min' && `Valeur minimale: ${field.min}`}
          {hasError.type === 'max' && `Valeur maximale: ${field.max}`}
          {hasError.type === 'pattern' && 'Format invalide'}
        </p>
      )}
    </div>
  );
}
