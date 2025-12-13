/**
 * Script pour convertir data.json (ancien format)
 * vers la structure data/ (nouveau format)
 *
 * Usage: node scripts/convert-data-format.js
 */

const fs = require('fs');
const path = require('path');

const STORAGE_DIR = path.join(__dirname, '../storage');
const DATA_FILE = path.join(STORAGE_DIR, 'data.json');
const DATA_DIR = path.join(STORAGE_DIR, 'data');

function convertDataFormat() {
  console.log('📦 Conversion du format de données...\n');

  // Lire data.json
  if (!fs.existsSync(DATA_FILE)) {
    console.error('❌ Fichier data.json introuvable');
    return;
  }

  const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
  const parsed = JSON.parse(rawData);

  // Extraire les données (support de plusieurs formats)
  const tableData = parsed.data || parsed;

  // Créer le dossier data/ si nécessaire
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('✅ Dossier data/ créé');
  }

  // Sauvegarder chaque table dans un fichier séparé
  let fileCount = 0;
  Object.keys(tableData).forEach((tableName) => {
    const records = tableData[tableName];
    const filePath = path.join(DATA_DIR, `${tableName}.json`);

    fs.writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf-8');
    console.log(`✅ ${tableName}.json créé (${records.length} enregistrements)`);
    fileCount++;
  });

  console.log(`\n✨ Conversion terminée : ${fileCount} fichiers créés dans storage/data/`);
  console.log(`💡 Vous pouvez maintenant supprimer storage/data.json si vous le souhaitez`);
}

// Exécuter
try {
  convertDataFormat();
} catch (error) {
  console.error('❌ Erreur:', error.message);
  process.exit(1);
}
