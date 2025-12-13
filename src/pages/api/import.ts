import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import JSZip from 'jszip';
import fs from 'fs/promises';
import { storage } from '@/lib/storage';

export const config = {
  api: {
    bodyParser: false,
  },
};

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

    // Lire le ZIP
    const zipBuffer = await fs.readFile(file.filepath);
    const zip = await JSZip.loadAsync(zipBuffer);

    // Extraire et sauvegarder les fichiers
    const schemaFile = zip.file('schema.json');
    const rulesFile = zip.file('rules.json');
    const auditFile = zip.file('audit.ndjson');

    if (schemaFile) {
      const content = await schemaFile.async('string');
      await storage.writeFile('schema.json', content);
    }

    // Lire les données depuis le dossier data/
    const dataFiles = zip.folder('data');
    const allTableData: Record<string, any> = {};

    if (dataFiles) {
      const files = Object.keys(zip.files).filter((name) => name.startsWith('data/') && name.endsWith('.json'));

      for (const fileName of files) {
        const file = zip.file(fileName);
        if (file) {
          const content = await file.async('string');
          const tableData = JSON.parse(content);
          // Extraire le nom de la table depuis le nom de fichier
          const tableName = fileName.replace('data/', '').replace('.json', '');
          allTableData[tableName] = tableData;
        }
      }
    }

    // Sauvegarder les données fusionnées
    if (Object.keys(allTableData).length > 0) {
      const dataContent = JSON.stringify({
        updatedAt: new Date().toISOString(),
        data: allTableData,
      }, null, 2);
      await storage.writeFile('data.json', dataContent);
    }

    if (rulesFile) {
      const content = await rulesFile.async('string');
      await storage.writeFile('rules.json', content);
    }

    if (auditFile) {
      const content = await auditFile.async('string');
      await storage.writeFile('audit.ndjson', content);
    }

    // Créer un événement d'audit pour l'import
    const importEvent = storage.createAuditEvent(
      'IMPORT',
      { type: 'file', ref: file.originalFilename || 'unknown.zip' },
      undefined,
      { filename: file.originalFilename },
      'Import depuis ZIP'
    );
    await storage.appendAuditEvent(importEvent);

    res.status(200).json({ success: true, message: 'Import réussi' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erreur lors de l\'import' });
  }
}
