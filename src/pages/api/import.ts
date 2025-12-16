import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import decompress from 'decompress';
import decompressUnzip from 'decompress-unzip';
import decompressTargz from 'decompress-targz';
import decompressTarbz2 from 'decompress-tarbz2';
import decompressTar from 'decompress-tar';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { storage } from '@/lib/storage';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Extensions supportées
const SUPPORTED_EXTENSIONS = ['.zip', '.tar', '.tar.gz', '.tgz', '.tar.bz2', '.tbz2', '.tbz'];

function getSupportedExtension(filename: string): string | null {
  const lowerName = filename.toLowerCase();
  for (const ext of SUPPORTED_EXTENSIONS) {
    if (lowerName.endsWith(ext)) {
      return ext;
    }
  }
  return null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let tempDir: string | null = null;

  try {
    // Parse le fichier uploadé
    const form = formidable({});
    const [fields, files] = await form.parse(req);

    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) {
      return res.status(400).json({ error: 'Aucun fichier uploadé' });
    }

    const originalFilename = file.originalFilename || 'archive';
    const extension = getSupportedExtension(originalFilename);

    if (!extension) {
      return res.status(400).json({
        error: `Format non supporté. Formats acceptés: ${SUPPORTED_EXTENSIONS.join(', ')}`
      });
    }

    // Créer un répertoire temporaire pour l'extraction
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'koma-import-'));

    // Décompresser le fichier avec les plugins appropriés
    const extractedFiles = await decompress(file.filepath, tempDir, {
      plugins: [
        decompressUnzip(),
        decompressTargz(),
        decompressTarbz2(),
        decompressTar(),
      ],
    });

    // Trouver et traiter les fichiers
    let schemaContent: string | null = null;
    let rulesContent: string | null = null;
    let auditContent: string | null = null;
    const allTableData: Record<string, any> = {};

    for (const extractedFile of extractedFiles) {
      const filePath = extractedFile.path;
      const fileData = extractedFile.data.toString('utf-8');

      // schema.json (peut être à la racine ou dans un dossier)
      if (filePath === 'schema.json' || filePath.endsWith('/schema.json')) {
        schemaContent = fileData;
      }
      // rules.json
      else if (filePath === 'rules.json' || filePath.endsWith('/rules.json')) {
        rulesContent = fileData;
      }
      // audit.ndjson
      else if (filePath === 'audit.ndjson' || filePath.endsWith('/audit.ndjson')) {
        auditContent = fileData;
      }
      // Fichiers de données dans le dossier data/
      else if (filePath.includes('data/') && filePath.endsWith('.json')) {
        try {
          const tableData = JSON.parse(fileData);
          // Extraire le nom de la table depuis le chemin
          const parts = filePath.split('/');
          const fileName = parts[parts.length - 1];
          const tableName = fileName.replace('.json', '');
          allTableData[tableName] = tableData;
        } catch (parseError) {
          console.warn(`Erreur de parsing pour ${filePath}:`, parseError);
        }
      }
    }

    // Sauvegarder les fichiers extraits
    if (schemaContent) {
      await storage.writeFile('schema.json', schemaContent);
    }

    if (Object.keys(allTableData).length > 0) {
      const dataContent = JSON.stringify({
        updatedAt: new Date().toISOString(),
        data: allTableData,
      }, null, 2);
      await storage.writeFile('data.json', dataContent);
    }

    if (rulesContent) {
      await storage.writeFile('rules.json', rulesContent);
    }

    if (auditContent) {
      await storage.writeFile('audit.ndjson', auditContent);
    }

    // Invalider tout le cache pour forcer le rechargement
    storage.invalidateCache('all');

    // Créer un événement d'audit pour l'import
    const importEvent = storage.createAuditEvent(
      'IMPORT',
      { type: 'file', ref: originalFilename },
      undefined,
      {
        filename: originalFilename,
        format: extension,
        filesExtracted: extractedFiles.length,
        tablesImported: Object.keys(allTableData).length,
      },
      `Import depuis ${extension.toUpperCase().replace('.', '')}`
    );
    await storage.appendAuditEvent(importEvent);

    res.status(200).json({
      success: true,
      message: 'Import réussi',
      details: {
        format: extension,
        filesExtracted: extractedFiles.length,
        tablesImported: Object.keys(allTableData).length,
        tableNames: Object.keys(allTableData), // Noms des tables importées
        hasSchema: !!schemaContent,
        hasRules: !!rulesContent,
        hasAudit: !!auditContent,
      }
    });
  } catch (error: any) {
    console.error('Erreur d\'import:', error);
    res.status(500).json({ error: error.message || 'Erreur lors de l\'import' });
  } finally {
    // Nettoyer le répertoire temporaire
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn('Erreur lors du nettoyage:', cleanupError);
      }
    }
  }
}
