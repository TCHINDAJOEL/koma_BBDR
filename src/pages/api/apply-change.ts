import type { NextApiRequest, NextApiResponse } from 'next';
import Ajv from 'ajv';
import { storage } from '@/lib/storage';
import { validator } from '@/lib/validator';
import { schemaMetaSchema } from '@/lib/meta-schema';
import { ApplyChangeRequest, ApplyChangeResponse, AuditAction, Schema, TableData } from '@/types/schema';

// Actions autorisées
const VALID_ACTIONS: AuditAction[] = [
  'SCHEMA_UPDATE',
  'SCHEMA_TABLE_CREATE',
  'SCHEMA_TABLE_DELETE',
  'SCHEMA_TABLE_UPDATE',
  'SCHEMA_FIELD_CREATE',
  'SCHEMA_FIELD_DELETE',
  'SCHEMA_FIELD_UPDATE',
  'DATA_UPSERT',
  'DATA_DELETE',
  'RELATION_CREATE',
  'RELATION_DELETE',
  'RELATION_UPDATE',
];

const SCHEMA_ACTIONS: AuditAction[] = [
  'SCHEMA_UPDATE',
  'SCHEMA_TABLE_CREATE',
  'SCHEMA_TABLE_UPDATE',
  'SCHEMA_TABLE_DELETE',
  'SCHEMA_FIELD_CREATE',
  'SCHEMA_FIELD_UPDATE',
  'SCHEMA_FIELD_DELETE',
  'RELATION_CREATE',
  'RELATION_UPDATE',
  'RELATION_DELETE',
];

const DATA_ACTIONS: AuditAction[] = ['DATA_UPSERT', 'DATA_DELETE'];

// Validateur AJV pour le schéma
const ajv = new Ajv({ allErrors: true, strict: false });
const validateSchema = ajv.compile(schemaMetaSchema);

/**
 * Valide la structure de la requête ApplyChange
 */
function validateRequest(body: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Le corps de la requête doit être un objet'] };
  }

  const { action, target, after } = body;

  // Vérifier l'action
  if (!action || typeof action !== 'string') {
    errors.push('Le champ "action" est requis et doit être une chaîne');
  } else if (!VALID_ACTIONS.includes(action as AuditAction)) {
    errors.push(`Action non autorisée: ${action}. Actions valides: ${VALID_ACTIONS.join(', ')}`);
  }

  // Vérifier la cible
  if (!target || typeof target !== 'object') {
    errors.push('Le champ "target" est requis et doit être un objet');
  } else {
    if (!target.type || !['table', 'field', 'relation', 'record', 'file', 'schema'].includes(target.type)) {
      errors.push('target.type doit être: table, field, relation, record, file ou schema');
    }
    if (!target.ref || typeof target.ref !== 'string') {
      errors.push('target.ref doit être une chaîne non vide');
    }
  }

  // Vérifier que "after" est présent pour les actions de modification
  if (action && VALID_ACTIONS.includes(action as AuditAction)) {
    if (after === undefined || after === null) {
      errors.push('Le champ "after" est requis pour cette action');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valide le payload "after" selon le type d'action
 */
function validatePayload(action: AuditAction, after: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (SCHEMA_ACTIONS.includes(action)) {
    // Valider que "after" est un schéma valide
    if (!validateSchema(after)) {
      const ajvErrors = validateSchema.errors?.map(e =>
        `${e.instancePath || '/'}: ${e.message}`
      ) || [];
      errors.push('Le payload "after" ne correspond pas au format Schema attendu');
      errors.push(...ajvErrors.slice(0, 5)); // Limiter le nombre d'erreurs affichées
    }

    // Vérifications de sécurité supplémentaires
    if (after && typeof after === 'object') {
      // Limiter le nombre de tables
      if (after.tables && after.tables.length > 1000) {
        errors.push('Le schéma ne peut pas contenir plus de 1000 tables');
      }
      // Limiter le nombre de champs par table
      if (after.tables) {
        for (const table of after.tables) {
          if (table.fields && table.fields.length > 500) {
            errors.push(`La table "${table.name}" ne peut pas contenir plus de 500 champs`);
          }
        }
      }
    }
  }

  if (DATA_ACTIONS.includes(action)) {
    // Valider que "after" est un objet de données
    if (typeof after !== 'object' || after === null || Array.isArray(after)) {
      errors.push('Le payload "after" doit être un objet TableData');
    } else {
      // Vérifier la structure des données
      for (const [tableName, records] of Object.entries(after)) {
        if (!Array.isArray(records)) {
          errors.push(`Les données de la table "${tableName}" doivent être un tableau`);
          continue;
        }
        // Limiter le nombre d'enregistrements par opération
        if (records.length > 10000) {
          errors.push(`La table "${tableName}" ne peut pas contenir plus de 10000 enregistrements par opération`);
        }
        // Vérifier que chaque enregistrement a un id
        for (let i = 0; i < records.length; i++) {
          const record = records[i];
          if (typeof record !== 'object' || record === null) {
            errors.push(`L'enregistrement ${i} de la table "${tableName}" doit être un objet`);
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApplyChangeResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      event: null as any,
      alerts: [],
    });
  }

  try {
    // 1. Valider la structure de la requête
    const requestValidation = validateRequest(req.body);
    if (!requestValidation.valid) {
      return res.status(400).json({
        success: false,
        event: null as any,
        alerts: requestValidation.errors.map(msg => ({
          severity: 'error',
          code: 'INVALID_REQUEST',
          location: '/api/apply-change',
          message: msg,
        })),
      });
    }

    const { action, target, before, after, reason } = req.body as ApplyChangeRequest;

    // 2. Valider le payload "after" selon l'action
    const payloadValidation = validatePayload(action, after);
    if (!payloadValidation.valid) {
      return res.status(400).json({
        success: false,
        event: null as any,
        alerts: payloadValidation.errors.map(msg => ({
          severity: 'error',
          code: 'INVALID_PAYLOAD',
          location: '/api/apply-change',
          message: msg,
        })),
      });
    }

    // 3. Charger l'état actuel
    const state = await storage.loadState();

    // 4. Préparer le nouvel état pour validation PRÉ-écriture
    let newState = { ...state };

    if (SCHEMA_ACTIONS.includes(action)) {
      newState.schema = after as Schema;
    } else if (DATA_ACTIONS.includes(action)) {
      newState.data = after as TableData;
    }

    // 5. Valider le nouvel état AVANT d'écrire
    const preValidation = validator.validate(newState.schema, newState.data, newState.rules);
    const criticalErrors = preValidation.alerts.filter(a => a.severity === 'error');

    // Si des erreurs critiques sont détectées, ne pas appliquer le changement
    if (criticalErrors.length > 0) {
      return res.status(400).json({
        success: false,
        event: null as any,
        alerts: criticalErrors,
      });
    }

    // 6. Créer l'événement d'audit
    const event = storage.createAuditEvent(action, target, before, after, reason);

    // 7. Appliquer le changement (écriture sur disque) - mode immédiat pour les actions explicites
    if (SCHEMA_ACTIONS.includes(action)) {
      await storage.saveSchema(after as Schema, true);
    } else if (DATA_ACTIONS.includes(action)) {
      await storage.saveData(after as TableData, true);
    }

    // 8. Enregistrer l'événement d'audit
    await storage.appendAuditEvent(event);

    // 9. Retourner le succès avec les alertes (warnings/infos)
    res.status(200).json({
      success: true,
      event,
      alerts: preValidation.alerts,
      newState: {
        schema: newState.schema,
        data: newState.data,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      event: null as any,
      alerts: [
        {
          severity: 'error',
          code: 'APPLY_CHANGE_ERROR',
          location: '/api/apply-change',
          message: error.message || 'Erreur lors de l\'application du changement',
        },
      ],
    });
  }
}
