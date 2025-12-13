import type { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '@/lib/storage';
import { validator } from '@/lib/validator';
import { ApplyChangeRequest, ApplyChangeResponse, AuditAction } from '@/types/schema';

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
    const { action, target, before, after, reason } = req.body as ApplyChangeRequest;

    // Créer l'événement d'audit
    const event = storage.createAuditEvent(action, target, before, after, reason);

    // Charger l'état actuel
    const state = await storage.loadState();

    // Appliquer le changement selon l'action
    let newState = { ...state };

    switch (action) {
      case 'SCHEMA_UPDATE':
      case 'SCHEMA_TABLE_CREATE':
      case 'SCHEMA_TABLE_UPDATE':
      case 'SCHEMA_TABLE_DELETE':
      case 'SCHEMA_FIELD_CREATE':
      case 'SCHEMA_FIELD_UPDATE':
      case 'SCHEMA_FIELD_DELETE':
        newState.schema = after;
        await storage.saveSchema(after);
        break;

      case 'DATA_UPSERT':
      case 'DATA_DELETE':
        newState.data = after;
        await storage.saveData(after);
        break;

      case 'RELATION_CREATE':
      case 'RELATION_UPDATE':
      case 'RELATION_DELETE':
        newState.schema = after;
        await storage.saveSchema(after);
        break;

      default:
        break;
    }

    // Enregistrer l'événement d'audit
    await storage.appendAuditEvent(event);

    // Valider le nouvel état
    const report = validator.validate(newState.schema, newState.data, newState.rules);

    res.status(200).json({
      success: true,
      event,
      alerts: report.alerts,
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
