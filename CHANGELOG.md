# Changelog

## [1.1.0] - 2025-12-13

### ✨ Nouvelles fonctionnalités

#### Structure de données en couches séparées

**Export/Import avec dossier `data/`**

Le format ZIP a été modifié pour respecter strictement la séparation en couches :

**Ancienne structure :**
```
export.zip
├── schema.json
├── data.json          # Toutes les tables dans un fichier
├── rules.json
└── audit.ndjson
```

**Nouvelle structure :**
```
export.zip
├── schema.json
├── data/              # Un fichier par table
│   ├── ref_articles.json
│   ├── ref_categories_articles.json
│   └── ...
├── rules.json
├── audit.ndjson
├── validation-report.json
└── migration-report.md
```

**Avantages :**
- ✅ Séparation claire des données par table
- ✅ Facilite l'édition manuelle des données
- ✅ Meilleure lisibilité et maintenabilité
- ✅ Conforme au principe "pas de gros JSON"

### 🔧 Améliorations

#### Adaptateur de schéma universel

**Problème résolu :** Support de multiples formats de schéma

L'application supporte maintenant automatiquement :

1. **Format array** (format original) :
   ```json
   {
     "tables": [
       { "name": "Users", "fields": [...] }
     ]
   }
   ```

2. **Format objet** (format importé) :
   ```json
   {
     "tables": {
       "Users": { "fields": {...} },
       "Projects": { "fields": {...} }
     }
   }
   ```

**Fonctionnalités de l'adaptateur :**
- ✅ Conversion automatique objet → array
- ✅ Normalisation des types (`int` → `integer`, `text` → `string`)
- ✅ Extraction automatique des clés primaires (`pk: true`)
- ✅ Conversion des relations (`"from": "table.field"` → format standard)
- ✅ Support de formats hybrides

#### Chargement flexible des données

- Support de `data.json` ET dossier `data/`
- Fusion automatique des fichiers multiples
- Rétrocompatibilité avec l'ancien format

### 📚 Documentation

- ✅ README mis à jour avec la nouvelle structure
- ✅ Page d'import avec visualisation de la structure attendue
- ✅ Script de conversion fourni (`scripts/convert-data-format.js`)

### 🛠️ Scripts utilitaires

**`scripts/convert-data-format.js`**

Convertit automatiquement `storage/data.json` en structure `storage/data/`.

**Usage :**
```bash
node scripts/convert-data-format.js
```

**Résultat :**
```
✅ ref_articles.json créé (367 enregistrements)
✅ ref_categories_articles.json créé (13 enregistrements)
...
✨ Conversion terminée : 17 fichiers créés
```

## [1.0.0] - 2025-01-15

### ✨ Version initiale

- Schema Explorer avec Monaco Editor
- ER Diagram interactif (React Flow)
- Data Enrichment (AG Grid + forms auto-générés)
- Audit Log viewer
- Validation Center (3 niveaux)
- Export/Import ZIP
- Moteur de validation complet
- Tests unitaires

---

**Migration depuis 1.0.0 vers 1.1.0 :**

Si vous avez des exports au format 1.0.0, utilisez le script de conversion :
```bash
node scripts/convert-data-format.js
```

L'application peut charger les deux formats, mais les exports seront toujours au nouveau format.
