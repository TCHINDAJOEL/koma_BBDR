import type { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

interface ParsedInsert {
  tableName: string;
  columns: string[];
  values: any[][];
}

interface ImportResult {
  success: boolean;
  tablesImported: string[];
  recordsImported: number;
  errors: string[];
  warnings: string[];
}

/**
 * API endpoint pour importer des données depuis un fichier SQL
 * Parse les INSERT statements et ajoute les données aux tables existantes
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ImportResult | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sql, mode = 'merge' } = req.body;

    if (!sql || typeof sql !== 'string') {
      return res.status(400).json({ error: 'SQL content is required' });
    }

    // Parser le SQL
    const inserts = parseInsertStatements(sql);

    if (inserts.length === 0) {
      return res.status(400).json({ error: 'Aucun INSERT statement trouvé dans le fichier SQL' });
    }

    // Charger les données existantes
    const existingData = await storage.loadData();
    const schema = await storage.loadSchema();
    const existingTables = new Set(schema.tables.map(t => t.name));

    const result: ImportResult = {
      success: true,
      tablesImported: [],
      recordsImported: 0,
      errors: [],
      warnings: [],
    };

    // Traiter chaque INSERT
    for (const insert of inserts) {
      const { tableName, columns, values } = insert;

      // Vérifier si la table existe
      if (!existingTables.has(tableName)) {
        result.warnings.push(`Table '${tableName}' non trouvée dans le schéma, création automatique`);
        // On peut quand même importer les données
      }

      // Préparer les données
      const records: any[] = [];
      for (const valueRow of values) {
        const record: Record<string, any> = {};

        for (let i = 0; i < columns.length; i++) {
          const column = columns[i];
          const value = valueRow[i];
          record[column] = value;
        }

        // S'assurer que chaque enregistrement a un id
        if (!record.id) {
          record.id = uuidv4();
        }

        records.push(record);
      }

      // Fusionner ou remplacer selon le mode
      if (mode === 'replace') {
        existingData[tableName] = records;
      } else {
        // Mode merge: ajouter aux données existantes
        const existing = existingData[tableName] || [];
        const existingIds = new Set(existing.map((r: any) => r.id));

        for (const record of records) {
          if (existingIds.has(record.id)) {
            // Mettre à jour l'enregistrement existant
            const index = existing.findIndex((r: any) => r.id === record.id);
            if (index !== -1) {
              existing[index] = { ...existing[index], ...record };
            }
          } else {
            // Ajouter le nouvel enregistrement
            existing.push(record);
          }
        }
        existingData[tableName] = existing;
      }

      // Éviter les doublons dans tablesImported
      if (!result.tablesImported.includes(tableName)) {
        result.tablesImported.push(tableName);
      }
      result.recordsImported += records.length;
    }

    // Sauvegarder les données
    await storage.saveData(existingData, true);

    res.status(200).json(result);
  } catch (error: any) {
    console.error('Erreur import SQL:', error);
    res.status(500).json({ error: error.message || 'Erreur lors de l\'import SQL' });
  }
}

/**
 * Parse les INSERT statements d'un fichier SQL
 * Gère correctement les chaînes contenant des parenthèses
 */
function parseInsertStatements(sql: string): ParsedInsert[] {
  const inserts: ParsedInsert[] = [];

  // Normaliser les sauts de ligne
  const normalizedSql = sql.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Trouver tous les INSERT INTO statements
  const insertStartRegex = /INSERT\s+INTO\s+[`"']?(\w+)[`"']?\s*\(/gi;

  let match;
  while ((match = insertStartRegex.exec(normalizedSql)) !== null) {
    const tableName = match[1];
    const startIndex = match.index + match[0].length;

    // Parser les colonnes (jusqu'à la prochaine parenthèse fermante)
    const columnsEnd = findClosingParen(normalizedSql, startIndex - 1);
    if (columnsEnd === -1) continue;

    const columnsStr = normalizedSql.substring(startIndex, columnsEnd);
    const columns = parseColumns(columnsStr);

    // Trouver VALUES
    const afterColumns = normalizedSql.substring(columnsEnd + 1);
    const valuesMatch = afterColumns.match(/^\s*VALUES\s*/i);
    if (!valuesMatch) continue;

    const valuesStart = columnsEnd + 1 + valuesMatch[0].length;

    // Parser les groupes de valeurs jusqu'au point-virgule ou prochain INSERT
    const valuesSection = extractValuesSection(normalizedSql, valuesStart);
    const values = parseValuesSection(valuesSection);

    if (columns.length > 0 && values.length > 0) {
      inserts.push({ tableName, columns, values });
    }
  }

  return inserts;
}

/**
 * Trouve la parenthèse fermante correspondante en gérant les chaînes
 */
function findClosingParen(sql: string, startIndex: number): number {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let escaped = false;

  for (let i = startIndex; i < sql.length; i++) {
    const char = sql[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (!inString) {
      if (char === "'" || char === '"') {
        inString = true;
        stringChar = char;
      } else if (char === '(') {
        depth++;
      } else if (char === ')') {
        depth--;
        if (depth === 0) {
          return i;
        }
      }
    } else {
      if (char === stringChar) {
        inString = false;
      }
    }
  }

  return -1;
}

/**
 * Extrait la section VALUES jusqu'au point-virgule ou prochain statement
 */
function extractValuesSection(sql: string, startIndex: number): string {
  let result = '';
  let inString = false;
  let stringChar = '';
  let escaped = false;
  let parenDepth = 0;

  for (let i = startIndex; i < sql.length; i++) {
    const char = sql[i];

    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      result += char;
      continue;
    }

    if (!inString) {
      if (char === "'" || char === '"') {
        inString = true;
        stringChar = char;
        result += char;
      } else if (char === '(') {
        parenDepth++;
        result += char;
      } else if (char === ')') {
        parenDepth--;
        result += char;
        // Si on est revenu à 0 et qu'on a un point-virgule ou fin, c'est terminé
      } else if (char === ';' && parenDepth === 0) {
        break;
      } else if (parenDepth === 0 && sql.substring(i).match(/^\s*INSERT\s+INTO/i)) {
        break;
      } else {
        result += char;
      }
    } else {
      result += char;
      if (char === stringChar) {
        inString = false;
      }
    }
  }

  return result;
}

/**
 * Parse la section VALUES complète
 */
function parseValuesSection(valuesStr: string): any[][] {
  const results: any[][] = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  let escaped = false;
  let parenDepth = 0;

  for (let i = 0; i < valuesStr.length; i++) {
    const char = valuesStr[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      current += char;
      continue;
    }

    if (!inString) {
      if (char === "'" || char === '"') {
        inString = true;
        stringChar = char;
        current += char;
      } else if (char === '(') {
        parenDepth++;
        if (parenDepth === 1) {
          current = ''; // Début d'un nouveau groupe
        } else {
          current += char;
        }
      } else if (char === ')') {
        parenDepth--;
        if (parenDepth === 0) {
          // Fin d'un groupe de valeurs
          const values = parseValueGroup(current);
          if (values.length > 0) {
            results.push(values);
          }
          current = '';
        } else {
          current += char;
        }
      } else if (parenDepth > 0) {
        current += char;
      }
    } else {
      current += char;
      if (char === stringChar) {
        inString = false;
      }
    }
  }

  return results;
}

/**
 * Parse les noms de colonnes
 */
function parseColumns(columnsStr: string): string[] {
  return columnsStr
    .split(',')
    .map(col => col.trim().replace(/[`"']/g, ''))
    .filter(col => col.length > 0);
}

/**
 * Parse un groupe de valeurs
 */
function parseValueGroup(groupStr: string): any[] {
  const values: any[] = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  let escaped = false;

  for (let i = 0; i < groupStr.length; i++) {
    const char = groupStr[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      current += char;
      continue;
    }

    if (!inString && (char === "'" || char === '"')) {
      inString = true;
      stringChar = char;
      continue;
    }

    if (inString && char === stringChar) {
      inString = false;
      continue;
    }

    if (!inString && char === ',') {
      values.push(parseValue(current.trim()));
      current = '';
      continue;
    }

    current += char;
  }

  // Ajouter la dernière valeur
  if (current.trim()) {
    values.push(parseValue(current.trim()));
  }

  return values;
}

/**
 * Parse une valeur individuelle
 */
function parseValue(valueStr: string): any {
  // NULL
  if (valueStr.toUpperCase() === 'NULL') {
    return null;
  }

  // Nombre entier (ne pas convertir en booléen)
  if (/^-?\d+$/.test(valueStr)) {
    return parseInt(valueStr, 10);
  }

  // Nombre décimal
  if (/^-?\d+\.\d+$/.test(valueStr)) {
    return parseFloat(valueStr);
  }

  // Booléen explicite (seulement TRUE/FALSE, pas 0/1)
  if (valueStr.toUpperCase() === 'TRUE') {
    return true;
  }
  if (valueStr.toUpperCase() === 'FALSE') {
    return false;
  }

  // JSON
  if ((valueStr.startsWith('{') && valueStr.endsWith('}')) ||
      (valueStr.startsWith('[') && valueStr.endsWith(']'))) {
    try {
      return JSON.parse(valueStr);
    } catch {
      // Pas du JSON valide, retourner comme string
    }
  }

  // String - nettoyer les caractères d'échappement
  return valueStr
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\');
}
