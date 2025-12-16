import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import ExcelJS from 'exceljs';
import fs from 'fs/promises';
import { storage } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';
import { Schema, TableDefinition, FieldDefinition, TableData } from '@/types/schema';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Extensions supportées
const SUPPORTED_EXTENSIONS = ['.xlsx', '.xls'];

function getSupportedExtension(filename: string): string | null {
  const lowerName = filename.toLowerCase();
  for (const ext of SUPPORTED_EXTENSIONS) {
    if (lowerName.endsWith(ext)) {
      return ext;
    }
  }
  return null;
}

interface ImportedSheet {
  name: string;
  matchedTable: string | null;
  rowCount: number;
  columnCount: number;
  columns: string[];
  records: any[];
  warnings: string[];
}

interface ImportResult {
  success: boolean;
  message: string;
  details: {
    format: string;
    sheetsProcessed: number;
    tablesUpdated: number;
    totalRecordsImported: number;
    sheets: ImportedSheet[];
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse le fichier uploadé
    const form = formidable({});
    const [fields, files] = await form.parse(req);

    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) {
      return res.status(400).json({ error: 'Aucun fichier uploadé' });
    }

    const originalFilename = file.originalFilename || 'import.xlsx';
    const extension = getSupportedExtension(originalFilename);

    if (!extension) {
      return res.status(400).json({
        error: `Format non supporté. Formats acceptés: ${SUPPORTED_EXTENSIONS.join(', ')}`
      });
    }

    // Charger le schéma existant pour le mapping
    const state = await storage.loadState();
    const existingSchema = state.schema;
    const existingData = state.data;

    // Lire le fichier Excel
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file.filepath);

    const importedSheets: ImportedSheet[] = [];
    const updatedData: TableData = { ...existingData };
    let totalRecordsImported = 0;
    let tablesUpdated = 0;

    // Traiter chaque onglet
    for (const worksheet of workbook.worksheets) {
      // Ignorer l'onglet "Résumé" s'il existe (c'est notre onglet d'export)
      if (worksheet.name === 'Résumé') {
        continue;
      }

      const sheetResult = processWorksheet(worksheet, existingSchema);
      importedSheets.push(sheetResult);

      // Si on a trouvé une table correspondante et des données
      if (sheetResult.matchedTable && sheetResult.records.length > 0) {
        // Fusionner ou remplacer les données
        updatedData[sheetResult.matchedTable] = sheetResult.records;
        totalRecordsImported += sheetResult.records.length;
        tablesUpdated++;
      }
    }

    // Sauvegarder les données mises à jour
    if (tablesUpdated > 0) {
      await storage.saveData(updatedData, true); // Mode immédiat, invalide le cache

      // Invalider explicitement tout le cache
      storage.invalidateCache('all');

      // Créer un événement d'audit
      const importEvent = storage.createAuditEvent(
        'IMPORT',
        { type: 'file', ref: originalFilename },
        undefined,
        {
          filename: originalFilename,
          format: 'EXCEL',
          sheetsProcessed: importedSheets.length,
          tablesUpdated,
          totalRecordsImported,
          sheets: importedSheets.map(s => ({
            name: s.name,
            matchedTable: s.matchedTable,
            rowCount: s.rowCount,
          })),
        },
        `Import Excel depuis ${originalFilename}`
      );
      await storage.appendAuditEvent(importEvent);
    }

    const result: ImportResult = {
      success: true,
      message: tablesUpdated > 0
        ? `Import réussi: ${tablesUpdated} table(s) mise(s) à jour avec ${totalRecordsImported} enregistrement(s)`
        : 'Aucune table correspondante trouvée dans le fichier',
      details: {
        format: 'EXCEL',
        sheetsProcessed: importedSheets.length,
        tablesUpdated,
        totalRecordsImported,
        sheets: importedSheets,
      },
    };

    res.status(200).json(result);
  } catch (error: any) {
    console.error('Erreur d\'import Excel:', error);
    res.status(500).json({ error: error.message || 'Erreur lors de l\'import Excel' });
  }
}

function processWorksheet(
  worksheet: ExcelJS.Worksheet,
  schema: Schema
): ImportedSheet {
  const sheetName = worksheet.name;
  const warnings: string[] = [];
  const records: any[] = [];

  // Trouver la table correspondante dans le schéma
  const matchedTable = findMatchingTable(sheetName, schema);

  if (!matchedTable) {
    return {
      name: sheetName,
      matchedTable: null,
      rowCount: 0,
      columnCount: 0,
      columns: [],
      records: [],
      warnings: [`Aucune table correspondante trouvée pour l'onglet "${sheetName}"`],
    };
  }

  const tableDefinition = schema.tables.find(t => t.name === matchedTable);
  if (!tableDefinition) {
    return {
      name: sheetName,
      matchedTable: null,
      rowCount: 0,
      columnCount: 0,
      columns: [],
      records: [],
      warnings: [`Définition de table introuvable pour "${matchedTable}"`],
    };
  }

  // Trouver la ligne d'en-tête (généralement ligne 4 dans notre export, ou ligne 1)
  let headerRowIndex = findHeaderRow(worksheet, tableDefinition);
  if (headerRowIndex === -1) {
    headerRowIndex = 1; // Fallback à la première ligne
  }

  const headerRow = worksheet.getRow(headerRowIndex);
  const columnMapping: Map<number, FieldDefinition> = new Map();
  const columns: string[] = [];

  // Mapper les colonnes aux champs
  headerRow.eachCell((cell, colNumber) => {
    const headerValue = String(cell.value || '').trim();
    columns.push(headerValue);

    const matchedField = findMatchingField(headerValue, tableDefinition);
    if (matchedField) {
      columnMapping.set(colNumber, matchedField);
    } else if (headerValue) {
      warnings.push(`Colonne "${headerValue}" non mappée`);
    }
  });

  // Déterminer où commencent les données
  // Si on utilise notre format d'export, les données commencent après la ligne de types (ligne 6)
  // Sinon, juste après l'en-tête
  let dataStartRow = headerRowIndex + 1;

  // Vérifier si la ligne suivante est une ligne de types (notre format)
  const potentialTypeRow = worksheet.getRow(headerRowIndex + 1);
  const firstTypeCell = potentialTypeRow.getCell(1).value;
  if (isTypeLabel(String(firstTypeCell || ''))) {
    dataStartRow = headerRowIndex + 2;
  }

  // Lire les données
  const rowCount = worksheet.rowCount;
  for (let rowIndex = dataStartRow; rowIndex <= rowCount; rowIndex++) {
    const row = worksheet.getRow(rowIndex);

    // Vérifier si la ligne n'est pas vide
    let hasData = false;
    row.eachCell(() => { hasData = true; });
    if (!hasData) continue;

    const record: any = {};
    let hasValidData = false;

    columnMapping.forEach((field, colNumber) => {
      const cell = row.getCell(colNumber);
      const value = convertCellValue(cell, field);

      if (value !== null && value !== undefined && value !== '') {
        hasValidData = true;
      }

      record[field.name] = value;
    });

    // Ajouter un ID si nécessaire
    if (!record.id && hasValidData) {
      // Chercher une colonne qui pourrait être l'ID
      const idField = tableDefinition.fields.find(f =>
        f.name.toLowerCase().includes('id') ||
        f.name === tableDefinition.primaryKey ||
        (Array.isArray(tableDefinition.primaryKey) && tableDefinition.primaryKey.includes(f.name))
      );

      if (idField && record[idField.name]) {
        record.id = String(record[idField.name]);
      } else {
        record.id = uuidv4();
      }
    }

    if (hasValidData) {
      records.push(record);
    }
  }

  return {
    name: sheetName,
    matchedTable,
    rowCount: records.length,
    columnCount: columnMapping.size,
    columns,
    records,
    warnings,
  };
}

function findMatchingTable(sheetName: string, schema: Schema): string | null {
  const normalizedSheetName = normalizeString(sheetName);

  // Chercher une correspondance exacte sur le nom ou le label
  for (const table of schema.tables) {
    if (normalizeString(table.name) === normalizedSheetName) {
      return table.name;
    }
    if (table.label && normalizeString(table.label) === normalizedSheetName) {
      return table.name;
    }
  }

  // Chercher une correspondance partielle
  for (const table of schema.tables) {
    if (normalizedSheetName.includes(normalizeString(table.name)) ||
        normalizeString(table.name).includes(normalizedSheetName)) {
      return table.name;
    }
    if (table.label) {
      if (normalizedSheetName.includes(normalizeString(table.label)) ||
          normalizeString(table.label).includes(normalizedSheetName)) {
        return table.name;
      }
    }
  }

  return null;
}

function findMatchingField(headerValue: string, table: TableDefinition): FieldDefinition | null {
  const normalizedHeader = normalizeString(headerValue);

  // Correspondance exacte sur le nom ou le label
  for (const field of table.fields) {
    if (normalizeString(field.name) === normalizedHeader) {
      return field;
    }
    if (field.label && normalizeString(field.label) === normalizedHeader) {
      return field;
    }
  }

  // Correspondance partielle
  for (const field of table.fields) {
    if (normalizedHeader.includes(normalizeString(field.name)) ||
        normalizeString(field.name).includes(normalizedHeader)) {
      return field;
    }
  }

  return null;
}

function findHeaderRow(worksheet: ExcelJS.Worksheet, table: TableDefinition): number {
  // Chercher la ligne qui contient le plus de correspondances avec les champs
  let bestRow = -1;
  let bestMatchCount = 0;

  for (let rowIndex = 1; rowIndex <= Math.min(10, worksheet.rowCount); rowIndex++) {
    const row = worksheet.getRow(rowIndex);
    let matchCount = 0;

    row.eachCell((cell) => {
      const value = String(cell.value || '').trim();
      if (findMatchingField(value, table)) {
        matchCount++;
      }
    });

    if (matchCount > bestMatchCount) {
      bestMatchCount = matchCount;
      bestRow = rowIndex;
    }
  }

  return bestRow;
}

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
    .replace(/[^a-z0-9]/g, '') // Garder seulement les alphanumériques
    .trim();
}

function isTypeLabel(value: string): boolean {
  const typeLabels = ['texte', 'nombre', 'entier', 'oui/non', 'date', 'date/heure', 'liste', 'json'];
  const normalizedValue = value.toLowerCase().replace(/\s*\*\s*$/, '').trim();
  return typeLabels.some(label => normalizedValue.startsWith(label));
}

function convertCellValue(cell: ExcelJS.Cell, field: FieldDefinition): any {
  const value = cell.value;

  if (value === null || value === undefined) {
    return field.default ?? null;
  }

  // Gérer les différents types de valeurs ExcelJS
  let rawValue = value;

  // Si c'est un objet complexe (richText, formula, etc.)
  if (typeof value === 'object') {
    if ('result' in value) {
      // Formule - prendre le résultat
      rawValue = (value as any).result;
    } else if ('richText' in value) {
      // Rich text - concaténer le texte
      rawValue = (value as any).richText.map((rt: any) => rt.text).join('');
    } else if (value instanceof Date) {
      rawValue = value;
    } else if ('text' in value) {
      // Hyperlink
      rawValue = (value as any).text;
    }
  }

  // Convertir selon le type de champ
  switch (field.type) {
    case 'string':
      return String(rawValue ?? '');

    case 'number':
      if (typeof rawValue === 'number') return rawValue;
      const num = parseFloat(String(rawValue).replace(/[^\d.-]/g, ''));
      return isNaN(num) ? null : num;

    case 'integer':
      if (typeof rawValue === 'number') return Math.round(rawValue);
      const int = parseInt(String(rawValue).replace(/[^\d-]/g, ''), 10);
      return isNaN(int) ? null : int;

    case 'boolean':
      if (typeof rawValue === 'boolean') return rawValue;
      const strVal = String(rawValue).toLowerCase().trim();
      if (['oui', 'yes', 'true', '1', 'vrai'].includes(strVal)) return true;
      if (['non', 'no', 'false', '0', 'faux'].includes(strVal)) return false;
      return null;

    case 'date':
    case 'datetime':
      if (rawValue instanceof Date) {
        return rawValue.toISOString();
      }
      const date = new Date(rawValue as any);
      return isNaN(date.getTime()) ? null : date.toISOString();

    case 'enum':
      const strEnum = String(rawValue ?? '');
      if (field.enumValues?.includes(strEnum)) {
        return strEnum;
      }
      return null;

    case 'json':
      if (typeof rawValue === 'string') {
        try {
          return JSON.parse(rawValue);
        } catch {
          return rawValue;
        }
      }
      return rawValue;

    default:
      return rawValue;
  }
}
