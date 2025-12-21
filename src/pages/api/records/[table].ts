import type { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '@/lib/storage';
import { validator } from '@/lib/validator';
import { findTable, getTableData, getRelations } from '@/lib/data-helpers';
import {
  normalizeRecord,
  getTableRelations,
  getRelatedRecords,
} from '@/lib/record-helpers';
import {
  DataRecord,
  TableData,
  ValidationAlert,
  RelationDefinition,
} from '@/types/schema';

// ============================================================================
// TYPES
// ============================================================================

interface RecordApiResponse {
  success: boolean;
  record?: DataRecord;
  records?: DataRecord[];
  total?: number;
  relations?: RelationsResponse;
  alerts?: ValidationAlert[];
  error?: string;
}

interface RelationsResponse {
  [relationId: string]: {
    direction: 'from' | 'to';
    relatedTable: string;
    relatedField: string;
    localField: string;
    cardinality: string;
    records: DataRecord[];
  };
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RecordApiResponse>
) {
  const { table: tableName, id } = req.query;

  if (typeof tableName !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Nom de table invalide',
    });
  }

  try {
    // Charger l'état
    const state = await storage.loadState();
    const { schema, data, rules } = state;

    // Valider que la table existe
    const tableDefinition = findTable(schema, tableName);
    if (!tableDefinition) {
      return res.status(404).json({
        success: false,
        error: `Table "${tableName}" non trouvée`,
      });
    }

    switch (req.method) {
      case 'GET':
        return handleGet(req, res, tableName, id as string | undefined, schema, data);

      case 'POST':
        return handlePost(req, res, tableName, tableDefinition, schema, data, rules);

      case 'PATCH':
        return handlePatch(req, res, tableName, tableDefinition, schema, data, rules);

      case 'DELETE':
        return handleDelete(req, res, tableName, schema, data, rules);

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
        return res.status(405).json({
          success: false,
          error: `Méthode ${req.method} non autorisée`,
        });
    }
  } catch (error: any) {
    console.error('Erreur API records:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erreur serveur',
    });
  }
}

// ============================================================================
// GET - Liste ou détail d'un enregistrement
// ============================================================================

async function handleGet(
  req: NextApiRequest,
  res: NextApiResponse<RecordApiResponse>,
  tableName: string,
  recordId: string | undefined,
  schema: any,
  data: TableData
) {
  const tableData = getTableData(data, tableName);
  const relations = getRelations(schema);

  // Si un ID est fourni, retourner un seul enregistrement
  if (recordId) {
    const record = tableData.find((r) => r.id === recordId);
    if (!record) {
      return res.status(404).json({
        success: false,
        error: `Enregistrement "${recordId}" non trouvé`,
      });
    }

    // Enrichir avec les relations
    const relationsInfo = buildRelationsResponse(
      data,
      record,
      tableName,
      relations
    );

    return res.status(200).json({
      success: true,
      record,
      relations: relationsInfo,
    });
  }

  // Sinon, retourner la liste complète
  // Filtrage optionnel via query params
  let filteredRecords = [...tableData];

  const { filter, search } = req.query;

  // Filtrage par champ: ?filter=field:value
  if (typeof filter === 'string') {
    const [field, value] = filter.split(':');
    if (field && value !== undefined) {
      filteredRecords = filteredRecords.filter(
        (r) => String(r[field]).toLowerCase().includes(value.toLowerCase())
      );
    }
  }

  // Recherche globale: ?search=term
  if (typeof search === 'string' && search.trim()) {
    const searchLower = search.toLowerCase();
    filteredRecords = filteredRecords.filter((record) =>
      Object.values(record).some((value) =>
        String(value).toLowerCase().includes(searchLower)
      )
    );
  }

  // Construire les relations pour le premier enregistrement (aperçu)
  // Pour la liste complète, ne pas inclure les relations (performance)
  const includeRelations = req.query.withRelations === 'true';
  let relationsInfo: RelationsResponse | undefined;

  if (includeRelations && filteredRecords.length > 0) {
    // Retourner les métadonnées des relations sans les records
    const tableRelations = getTableRelations(relations, tableName);
    relationsInfo = {};

    [...tableRelations.incoming, ...tableRelations.outgoing].forEach((rel) => {
      const direction = rel.fromTable === tableName ? 'from' : 'to';
      relationsInfo![rel.id] = {
        direction,
        relatedTable: direction === 'from' ? rel.toTable : rel.fromTable,
        relatedField: direction === 'from' ? rel.toField : rel.fromField,
        localField: direction === 'from' ? rel.fromField : rel.toField,
        cardinality: rel.cardinality,
        records: [], // Vide pour la liste
      };
    });
  }

  return res.status(200).json({
    success: true,
    records: filteredRecords,
    total: filteredRecords.length,
    relations: relationsInfo,
  });
}

// ============================================================================
// POST - Créer un enregistrement
// ============================================================================

async function handlePost(
  req: NextApiRequest,
  res: NextApiResponse<RecordApiResponse>,
  tableName: string,
  tableDefinition: any,
  schema: any,
  data: TableData,
  rules: any[]
) {
  const { record: inputRecord } = req.body;

  if (!inputRecord || typeof inputRecord !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'Corps de requête invalide: "record" est requis',
    });
  }

  // Générer un ID si non fourni
  const newRecord: DataRecord = {
    id: inputRecord.id || uuidv4(),
    ...inputRecord,
  };

  // Normaliser le record
  const normalizedRecord = normalizeRecord(newRecord, tableDefinition.fields);

  // Construire les nouvelles données
  const currentRecords = getTableData(data, tableName);
  const newData: TableData = {
    ...data,
    [tableName]: [...currentRecords, normalizedRecord],
  };

  // Valider avant d'écrire
  const validation = validator.validate(schema, newData, rules);
  const criticalErrors = validation.alerts.filter((a) => a.severity === 'error');

  if (criticalErrors.length > 0) {
    return res.status(400).json({
      success: false,
      alerts: criticalErrors,
      error: 'Validation échouée',
    });
  }

  // Sauvegarder
  await storage.saveData(newData, true);

  return res.status(201).json({
    success: true,
    record: normalizedRecord,
    alerts: validation.alerts.filter((a) => a.severity !== 'error'),
  });
}

// ============================================================================
// PATCH - Modifier un enregistrement
// ============================================================================

async function handlePatch(
  req: NextApiRequest,
  res: NextApiResponse<RecordApiResponse>,
  tableName: string,
  tableDefinition: any,
  schema: any,
  data: TableData,
  rules: any[]
) {
  const { id, updates } = req.body;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Corps de requête invalide: "id" est requis',
    });
  }

  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'Corps de requête invalide: "updates" est requis',
    });
  }

  const currentRecords = getTableData(data, tableName);
  const existingRecord = currentRecords.find((r) => r.id === id);

  if (!existingRecord) {
    return res.status(404).json({
      success: false,
      error: `Enregistrement "${id}" non trouvé`,
    });
  }

  // Fusionner les updates
  const updatedRecord: DataRecord = {
    ...existingRecord,
    ...updates,
    id, // S'assurer que l'ID ne change pas
  };

  // Normaliser
  const normalizedRecord = normalizeRecord(updatedRecord, tableDefinition.fields);

  // Construire les nouvelles données
  const newData: TableData = {
    ...data,
    [tableName]: currentRecords.map((r) =>
      r.id === id ? normalizedRecord : r
    ),
  };

  // Valider avant d'écrire
  const validation = validator.validate(schema, newData, rules);
  const criticalErrors = validation.alerts.filter((a) => a.severity === 'error');

  if (criticalErrors.length > 0) {
    return res.status(400).json({
      success: false,
      alerts: criticalErrors,
      error: 'Validation échouée',
    });
  }

  // Sauvegarder
  await storage.saveData(newData, true);

  return res.status(200).json({
    success: true,
    record: normalizedRecord,
    alerts: validation.alerts.filter((a) => a.severity !== 'error'),
  });
}

// ============================================================================
// DELETE - Supprimer un enregistrement
// ============================================================================

async function handleDelete(
  req: NextApiRequest,
  res: NextApiResponse<RecordApiResponse>,
  tableName: string,
  schema: any,
  data: TableData,
  rules: any[]
) {
  const { id } = req.body;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Corps de requête invalide: "id" est requis',
    });
  }

  const currentRecords = getTableData(data, tableName);
  const existingRecord = currentRecords.find((r) => r.id === id);

  if (!existingRecord) {
    return res.status(404).json({
      success: false,
      error: `Enregistrement "${id}" non trouvé`,
    });
  }

  // Construire les nouvelles données
  const newData: TableData = {
    ...data,
    [tableName]: currentRecords.filter((r) => r.id !== id),
  };

  // Valider avant d'écrire (vérifier les FK entrantes)
  const validation = validator.validate(schema, newData, rules);
  const criticalErrors = validation.alerts.filter((a) => a.severity === 'error');

  if (criticalErrors.length > 0) {
    return res.status(400).json({
      success: false,
      alerts: criticalErrors,
      error: 'Validation échouée - vérifier les références entrantes',
    });
  }

  // Sauvegarder
  await storage.saveData(newData, true);

  return res.status(200).json({
    success: true,
    alerts: validation.alerts.filter((a) => a.severity !== 'error'),
  });
}

// ============================================================================
// HELPERS
// ============================================================================

function buildRelationsResponse(
  data: TableData,
  record: DataRecord,
  tableName: string,
  relations: RelationDefinition[]
): RelationsResponse {
  const tableRelations = getTableRelations(relations, tableName);
  const response: RelationsResponse = {};

  // Relations sortantes (FK dans cette table)
  tableRelations.outgoing.forEach((rel) => {
    const relatedRecords = getRelatedRecords(data, record, rel, 'from');
    response[rel.id] = {
      direction: 'from',
      relatedTable: rel.toTable,
      relatedField: rel.toField,
      localField: rel.fromField,
      cardinality: rel.cardinality,
      records: relatedRecords,
    };
  });

  // Relations entrantes (FK dans d'autres tables)
  tableRelations.incoming.forEach((rel) => {
    const relatedRecords = getRelatedRecords(data, record, rel, 'to');
    response[rel.id] = {
      direction: 'to',
      relatedTable: rel.fromTable,
      relatedField: rel.fromField,
      localField: rel.toField,
      cardinality: rel.cardinality,
      records: relatedRecords,
    };
  });

  return response;
}
