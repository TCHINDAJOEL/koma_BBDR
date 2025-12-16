import type { NextApiRequest, NextApiResponse } from 'next';
import ExcelJS from 'exceljs';
import { storage } from '@/lib/storage';
import { Schema, TableDefinition, FieldDefinition } from '@/types/schema';

// Couleurs du thème
const COLORS = {
  primary: '2563EB',      // Bleu principal
  primaryLight: 'DBEAFE', // Bleu clair
  header: '1E40AF',       // Bleu foncé pour les en-têtes
  headerText: 'FFFFFF',   // Blanc
  alternateRow: 'F8FAFC', // Gris très clair
  border: 'E2E8F0',       // Gris bordure
  success: '10B981',      // Vert
  warning: 'F59E0B',      // Orange
  error: 'EF4444',        // Rouge
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const state = await storage.loadState();
    const { schema, data } = state;

    // Créer le workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'KOMA BBDR';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Ajouter une feuille de résumé
    addSummarySheet(workbook, schema, data);

    // Ajouter une feuille par table
    for (const table of schema.tables) {
      const tableName = table.name;
      const rawTableData = data[tableName];

      // Normaliser les données en tableau
      let tableData: any[] = [];
      if (Array.isArray(rawTableData)) {
        tableData = rawTableData;
      } else if (rawTableData && typeof rawTableData === 'object') {
        // Si c'est un objet, le traiter comme un seul enregistrement
        tableData = [rawTableData];
      }

      addTableSheet(workbook, table, tableData);
    }

    // Générer le buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Envoyer la réponse
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=koma-bbdr-export-${Date.now()}.xlsx`
    );
    res.status(200).send(Buffer.from(buffer));
  } catch (error: any) {
    console.error('Export Excel error:', error);
    res.status(500).json({ error: error.message || 'Erreur lors de l\'export Excel' });
  }
}

function addSummarySheet(
  workbook: ExcelJS.Workbook,
  schema: Schema,
  data: Record<string, any[]>
) {
  const sheet = workbook.addWorksheet('Résumé', {
    properties: { tabColor: { argb: COLORS.primary } },
  });

  // Titre principal
  sheet.mergeCells('A1:D1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'KOMA BBDR - Export des données';
  titleCell.font = { size: 20, bold: true, color: { argb: COLORS.header } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 40;

  // Informations d'export
  sheet.mergeCells('A2:D2');
  const dateCell = sheet.getCell('A2');
  dateCell.value = `Exporté le ${new Date().toLocaleString('fr-FR')}`;
  dateCell.font = { size: 11, italic: true, color: { argb: '64748B' } };
  dateCell.alignment = { horizontal: 'center' };

  // Espace
  sheet.getRow(3).height = 20;

  // En-têtes du tableau récapitulatif
  const headerRow = sheet.getRow(4);
  const headers = ['Table', 'Description', 'Nombre de champs', 'Nombre d\'enregistrements'];
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: COLORS.headerText } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.header },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: COLORS.border } },
      bottom: { style: 'thin', color: { argb: COLORS.border } },
      left: { style: 'thin', color: { argb: COLORS.border } },
      right: { style: 'thin', color: { argb: COLORS.border } },
    };
  });
  headerRow.height = 25;

  // Données du tableau
  let rowIndex = 5;
  for (const table of schema.tables) {
    const row = sheet.getRow(rowIndex);
    const rawData = data[table.name];
    const recordCount = Array.isArray(rawData) ? rawData.length : (rawData ? 1 : 0);

    row.getCell(1).value = table.label || table.name;
    row.getCell(2).value = table.description || '-';
    row.getCell(3).value = table.fields.length;
    row.getCell(4).value = recordCount;

    // Style alterné
    const isAlternate = (rowIndex - 5) % 2 === 1;
    for (let col = 1; col <= 4; col++) {
      const cell = row.getCell(col);
      if (isAlternate) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLORS.alternateRow },
        };
      }
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.border } },
        bottom: { style: 'thin', color: { argb: COLORS.border } },
        left: { style: 'thin', color: { argb: COLORS.border } },
        right: { style: 'thin', color: { argb: COLORS.border } },
      };
      cell.alignment = { vertical: 'middle' };
    }

    // Centrer les nombres
    row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };

    rowIndex++;
  }

  // Ajuster les largeurs de colonnes
  sheet.getColumn(1).width = 30;
  sheet.getColumn(2).width = 50;
  sheet.getColumn(3).width = 20;
  sheet.getColumn(4).width = 25;

  // Total
  const totalRow = sheet.getRow(rowIndex + 1);
  sheet.mergeCells(`A${rowIndex + 1}:C${rowIndex + 1}`);
  totalRow.getCell(1).value = 'Total des enregistrements';
  totalRow.getCell(1).font = { bold: true };
  totalRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };

  const totalRecords = Object.values(data).reduce((sum, arr) => sum + (arr?.length || 0), 0);
  totalRow.getCell(4).value = totalRecords;
  totalRow.getCell(4).font = { bold: true, color: { argb: COLORS.primary } };
  totalRow.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
}

function addTableSheet(
  workbook: ExcelJS.Workbook,
  table: TableDefinition,
  tableData: any[]
) {
  // Nom de l'onglet (max 31 caractères pour Excel)
  const sheetName = (table.label || table.name).substring(0, 31);
  const sheet = workbook.addWorksheet(sheetName, {
    properties: { tabColor: { argb: COLORS.primary } },
  });

  // Titre de la table
  const colCount = Math.max(table.fields.length, 4);
  sheet.mergeCells(1, 1, 1, colCount);
  const titleCell = sheet.getCell('A1');
  titleCell.value = table.label || table.name;
  titleCell.font = { size: 16, bold: true, color: { argb: COLORS.header } };
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
  sheet.getRow(1).height = 30;

  // Description
  if (table.description) {
    sheet.mergeCells(2, 1, 2, colCount);
    const descCell = sheet.getCell('A2');
    descCell.value = table.description;
    descCell.font = { size: 10, italic: true, color: { argb: '64748B' } };
    descCell.alignment = { horizontal: 'left', vertical: 'middle' };
  }

  // Espace
  sheet.getRow(3).height = 10;

  // En-têtes des colonnes
  const headerRowIndex = 4;
  const headerRow = sheet.getRow(headerRowIndex);

  table.fields.forEach((field, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = field.label || field.name;
    cell.font = { bold: true, color: { argb: COLORS.headerText }, size: 11 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.header },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: COLORS.border } },
      bottom: { style: 'thin', color: { argb: COLORS.border } },
      left: { style: 'thin', color: { argb: COLORS.border } },
      right: { style: 'thin', color: { argb: COLORS.border } },
    };

    // Commentaire avec informations du champ
    const note = buildFieldNote(field);
    if (note) {
      cell.note = {
        texts: [{ text: note }],
      } as ExcelJS.Comment;
    }
  });
  headerRow.height = 25;

  // Ligne des types (sous les en-têtes)
  const typeRowIndex = 5;
  const typeRow = sheet.getRow(typeRowIndex);
  table.fields.forEach((field, index) => {
    const cell = typeRow.getCell(index + 1);
    cell.value = getTypeLabel(field);
    cell.font = { size: 9, italic: true, color: { argb: '64748B' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.primaryLight },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: COLORS.border } },
      bottom: { style: 'medium', color: { argb: COLORS.primary } },
      left: { style: 'thin', color: { argb: COLORS.border } },
      right: { style: 'thin', color: { argb: COLORS.border } },
    };
  });
  typeRow.height = 20;

  // Données
  let dataRowIndex = 6;
  for (const record of tableData) {
    const row = sheet.getRow(dataRowIndex);
    const isAlternate = (dataRowIndex - 6) % 2 === 1;

    table.fields.forEach((field, index) => {
      const cell = row.getCell(index + 1);
      const value = record[field.name];

      // Formater la valeur selon le type
      cell.value = formatValue(value, field);

      // Appliquer le format numérique si nécessaire
      applyNumberFormat(cell, field);

      // Style
      if (isAlternate) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLORS.alternateRow },
        };
      }
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.border } },
        bottom: { style: 'thin', color: { argb: COLORS.border } },
        left: { style: 'thin', color: { argb: COLORS.border } },
        right: { style: 'thin', color: { argb: COLORS.border } },
      };
      cell.alignment = { vertical: 'middle', wrapText: true };

      // Alignement selon le type
      if (field.type === 'number' || field.type === 'integer') {
        cell.alignment.horizontal = 'right';
      } else if (field.type === 'boolean') {
        cell.alignment.horizontal = 'center';
      }
    });

    dataRowIndex++;
  }

  // Message si pas de données
  if (tableData.length === 0) {
    sheet.mergeCells(6, 1, 6, table.fields.length);
    const emptyCell = sheet.getCell('A6');
    emptyCell.value = 'Aucune donnée';
    emptyCell.font = { italic: true, color: { argb: '94A3B8' } };
    emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
  }

  // Ajuster les largeurs de colonnes
  table.fields.forEach((field, index) => {
    const column = sheet.getColumn(index + 1);
    let width = Math.max(
      (field.label || field.name).length,
      15 // Largeur minimum
    );

    // Largeur max selon le type
    if (field.type === 'string' || field.type === 'json') {
      width = Math.min(width, 50);
    } else if (field.type === 'date' || field.type === 'datetime') {
      width = Math.max(width, 18);
    } else if (field.type === 'number' || field.type === 'integer') {
      width = Math.max(width, 12);
    }

    column.width = width + 2;
  });

  // Figer les lignes d'en-tête
  sheet.views = [
    { state: 'frozen', ySplit: 5, xSplit: 0 },
  ];

  // Activer les filtres automatiques
  if (table.fields.length > 0 && tableData.length > 0) {
    sheet.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: dataRowIndex - 1, column: table.fields.length },
    };
  }
}

function buildFieldNote(field: FieldDefinition): string {
  const parts: string[] = [];

  parts.push(`Nom technique: ${field.name}`);
  parts.push(`Type: ${field.type}`);

  if (field.required) parts.push('Requis: Oui');
  if (field.unique) parts.push('Unique: Oui');
  if (field.description) parts.push(`Description: ${field.description}`);
  if (field.enumValues?.length) parts.push(`Valeurs: ${field.enumValues.join(', ')}`);
  if (field.min !== undefined) parts.push(`Min: ${field.min}`);
  if (field.max !== undefined) parts.push(`Max: ${field.max}`);
  if (field.sensitivity) parts.push(`Sensibilité: ${field.sensitivity}`);
  if (field.owner) parts.push(`Propriétaire: ${field.owner}`);

  return parts.join('\n');
}

function getTypeLabel(field: FieldDefinition): string {
  const typeLabels: Record<string, string> = {
    string: 'Texte',
    number: 'Nombre',
    integer: 'Entier',
    boolean: 'Oui/Non',
    date: 'Date',
    datetime: 'Date/Heure',
    enum: 'Liste',
    json: 'JSON',
  };

  let label = typeLabels[field.type] || field.type;

  if (field.required) label += ' *';

  return label;
}

function formatValue(value: any, field: FieldDefinition): any {
  if (value === null || value === undefined) {
    return '';
  }

  switch (field.type) {
    case 'boolean':
      return value ? 'Oui' : 'Non';
    case 'json':
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    case 'date':
    case 'datetime':
      if (value instanceof Date) {
        return value;
      }
      // Essayer de parser la date
      const date = new Date(value);
      return isNaN(date.getTime()) ? value : date;
    default:
      return value;
  }
}

function applyNumberFormat(cell: ExcelJS.Cell, field: FieldDefinition): void {
  switch (field.type) {
    case 'number':
      cell.numFmt = '#,##0.00';
      break;
    case 'integer':
      cell.numFmt = '#,##0';
      break;
    case 'date':
      cell.numFmt = 'DD/MM/YYYY';
      break;
    case 'datetime':
      cell.numFmt = 'DD/MM/YYYY HH:MM';
      break;
  }
}
