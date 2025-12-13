import type { NextApiRequest, NextApiResponse } from 'next';
import JSZip from 'jszip';
import { storage } from '@/lib/storage';
import { validator } from '@/lib/validator';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const state = await storage.loadState();

    // Valider avant export
    const report = validator.validate(state.schema, state.data, state.rules);

    // Créer le ZIP
    const zip = new JSZip();

    // Ajouter schema.json
    zip.file('schema.json', JSON.stringify(state.schema, null, 2));

    // Créer le dossier data/ avec un fichier par table
    const dataFolder = zip.folder('data');
    if (dataFolder) {
      Object.keys(state.data).forEach((tableName) => {
        const tableData = state.data[tableName];
        dataFolder.file(
          `${tableName}.json`,
          JSON.stringify(tableData, null, 2)
        );
      });
    }

    // Ajouter rules.json
    zip.file(
      'rules.json',
      JSON.stringify(
        { version: '1.0.0', updatedAt: new Date().toISOString(), rules: state.rules },
        null,
        2
      )
    );

    // Audit en NDJSON
    const auditLines = state.audit.map((e) => JSON.stringify(e)).join('\n');
    zip.file('audit.ndjson', auditLines);

    // Rapport de validation
    const validationReport = {
      ...report,
      exportedAt: new Date().toISOString(),
    };
    zip.file('validation-report.json', JSON.stringify(validationReport, null, 2));

    // Migration report (si des alertes de niveau C existent)
    if (report.levelC.length > 0) {
      const migrationReport = generateMigrationReport(report);
      zip.file('migration-report.md', migrationReport);
    }

    // Générer le ZIP
    const blob = await zip.generateAsync({ type: 'nodebuffer' });

    // Envoyer la réponse
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=koma-bbdr-export-${Date.now()}.zip`
    );
    res.status(200).send(blob);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erreur lors de l\'export' });
  }
}

function generateMigrationReport(report: any): string {
  const { levelC } = report;

  let md = '# Migration Report\n\n';
  md += `Généré le: ${new Date().toISOString()}\n\n`;
  md += '## Changements détectés\n\n';

  if (levelC.length === 0) {
    md += 'Aucun impact détecté.\n';
  } else {
    md += '| Localisation | Impact | Enregistrements affectés | Suggestion |\n';
    md += '|--------------|--------|--------------------------|------------|\n';

    levelC.forEach((alert: any) => {
      md += `| ${alert.location} | ${alert.message} | ${alert.context?.affectedCount || 'N/A'} | ${alert.suggestion || '-'} |\n`;
    });

    md += '\n## Remédiations recommandées\n\n';
    levelC.forEach((alert: any, i: number) => {
      md += `${i + 1}. **${alert.code}**: ${alert.suggestion}\n`;
    });
  }

  return md;
}
