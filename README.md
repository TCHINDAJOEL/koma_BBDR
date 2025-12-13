# KOMA BBDR - Data Catalog & Schema Modeling Tool

Un outil web complet pour modéliser des schémas relationnels, gérer les données, valider l'intégrité et journaliser tous les changements en mode audit append-only.

## 🎯 Objectif

KOMA BBDR permet de :
- **Explorer et éditer** des schémas de données relationnels
- **Visualiser** les relations entre tables via un diagramme ER interactif
- **Enrichir** les données avec validation en temps réel
- **Valider** l'intégrité à 3 niveaux (structure, relations, impact)
- **Auditer** tous les changements en mode event sourcing
- **Exporter/Importer** des projets complets en ZIP

## 📦 Stack Technique

### Frontend
- **React 18** + **TypeScript** (strict mode)
- **Next.js 14** (App Router + API Routes)
- **Tailwind CSS** pour le styling
- **AG Grid** pour les grilles de données
- **React Flow** pour le diagramme ER
- **Monaco Editor** pour l'édition JSON
- **React Hook Form** pour les formulaires

### Backend
- **Next.js API Routes** (REST)
- **AJV** pour la validation JSON Schema
- **JSZip** pour l'export/import
- Stockage fichier (JSON + NDJSON)

### Tests
- **Jest** + **Testing Library**

## 🗂️ Structure du Projet

```
koma_BBDR/
├── src/
│   ├── components/
│   │   └── Layout.tsx              # Layout principal avec navigation
│   ├── lib/
│   │   ├── meta-schema.ts          # JSON Schema pour valider schema.json
│   │   ├── storage.ts              # Gestionnaire de fichiers
│   │   └── validator.ts            # Moteur de validation (3 niveaux)
│   ├── pages/
│   │   ├── _app.tsx                # App Next.js
│   │   ├── index.tsx               # Schema Explorer
│   │   ├── diagram.tsx             # ER Diagram (React Flow)
│   │   ├── data.tsx                # Data Enrichment (AG Grid)
│   │   ├── audit.tsx               # Audit Log viewer
│   │   ├── validation.tsx          # Validation Center
│   │   └── api/
│   │       ├── validate.ts         # POST /api/validate
│   │       ├── apply-change.ts     # POST /api/apply-change
│   │       ├── state.ts            # GET /api/state
│   │       ├── import.ts           # POST /api/import
│   │       └── export.ts           # GET /api/export
│   ├── styles/
│   │   └── globals.css             # Styles globaux + Tailwind
│   ├── types/
│   │   └── schema.ts               # Types TypeScript complets
│   └── __tests__/
│       └── validator.test.ts       # Tests unitaires
├── storage/                        # Stockage des données (gitignored)
│   ├── schema.json                 # Schéma relationnel
│   ├── data.json                   # Données par table
│   ├── rules.json                  # Règles métier
│   └── audit.ndjson                # Journal d'audit (append-only)
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
└── README.md
```

## 🚀 Installation et Lancement

### Prérequis
- **Node.js 18+**
- **npm** ou **yarn**

### Installation

```bash
# Cloner le repo
git clone <repo-url>
cd koma_BBDR

# Installer les dépendances
npm install

# Lancer en mode développement
npm run dev
```

L'application sera disponible sur **http://localhost:3000**

### Build de production

```bash
npm run build
npm start
```

### Lancer les tests

```bash
npm test
```

## 📋 Format des Fichiers

### Structure du ZIP Import/Export

Le ZIP exporté/importé a la structure suivante :

```
project-export.zip
├── schema.json                  # Schéma relationnel complet
├── data/                        # Dossier des données (un fichier par table)
│   ├── ref_articles.json       # Array d'enregistrements
│   ├── ref_categories_articles.json
│   ├── ref_unites.json
│   └── ... (un fichier par table)
├── rules.json                   # Règles métier
├── audit.ndjson                 # Journal d'audit (append-only)
├── validation-report.json       # Rapport de validation généré
└── migration-report.md          # Rapport de migration (si impacts détectés)
```

### 1. `schema.json` - Schéma relationnel

Contient la définition complète du modèle de données.

```json
{
  "version": "1.0.0",
  "updatedAt": "2025-01-15T10:00:00.000Z",
  "tables": [
    {
      "name": "Users",
      "label": "Utilisateurs",
      "description": "Table des utilisateurs",
      "primaryKey": "id",
      "sensitivity": "confidential",
      "owner": "IT Department",
      "status": "active",
      "fields": [
        {
          "name": "email",
          "type": "string",
          "label": "Email",
          "required": true,
          "unique": true,
          "regex": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\\\.[a-zA-Z]{2,}$"
        }
      ]
    }
  ],
  "relations": [
    {
      "id": "rel_001",
      "fromTable": "Projects",
      "fromField": "ownerId",
      "toTable": "Users",
      "toField": "id",
      "cardinality": "n-1",
      "onDelete": "restrict",
      "onUpdate": "cascade"
    }
  ]
}
```

**Types de champs supportés** :
- `string`, `number`, `integer`, `boolean`
- `date`, `datetime`
- `enum` (avec `enumValues`)
- `json`

**Cardinalités** : `1-1`, `1-n`, `n-1`, `n-n`

**Actions référentielles** : `restrict`, `cascade`, `setNull`, `noAction`

### 2. `data/` - Données par table

Les données sont organisées dans un dossier `data/` avec **un fichier JSON par table**.

**Structure du dossier data/ :**
```
data/
├── ref_articles.json       # Array d'enregistrements
├── ref_categories.json
└── ...
```

**Format de chaque fichier :**
```json
[
  {
    "id": "user_001",
    "email": "alice@example.com",
    "firstName": "Alice",
    "status": "ACTIVE"
  },
  {
    "id": "user_002",
    ...
  }
]
```

Chaque enregistrement **doit** avoir un champ `id` stable (UUID).

**Note :** En interne, l'application fusionne tous les fichiers dans `storage/data.json` pour faciliter le traitement.

### 3. `rules.json` - Règles métier

Règles de validation personnalisées.

```json
{
  "version": "1.0.0",
  "updatedAt": "2025-01-15T10:00:00.000Z",
  "rules": [
    {
      "id": "rule_001",
      "name": "Email requis pour utilisateurs actifs",
      "severity": "error",
      "scope": "table",
      "table": "Users",
      "when": [
        { "field": "status", "operator": "==", "value": "ACTIVE" },
        { "field": "email", "operator": "notExists" }
      ],
      "then": {
        "message": "Un utilisateur actif doit avoir un email",
        "suggestion": "Ajouter un email ou changer le statut",
        "quickFix": {
          "op": "setDefault",
          "value": "unknown@example.com"
        }
      }
    }
  ]
}
```

**Opérateurs supportés** :
- `==`, `!=`, `>`, `<`, `>=`, `<=`
- `regex`, `exists`, `notExists`, `in`, `notIn`

### 4. `audit.ndjson` - Journal d'audit

Un événement par ligne (newline-delimited JSON).

```json
{"eventId":"evt_001","ts":"2025-01-15T09:00:00.000Z","actor":"local-user","action":"SCHEMA_UPDATE","target":{"type":"table","ref":"Users"},"before":{"name":"Users"},"after":{"name":"Users","fields":[...]},"reason":"Ajout du champ email"}
{"eventId":"evt_002","ts":"2025-01-15T09:15:00.000Z","actor":"local-user","action":"DATA_UPSERT","target":{"type":"record","ref":"Users"},"after":{"id":"user_001","email":"alice@example.com"},"reason":"Création d'Alice"}
```

**Actions d'audit** :
- `SCHEMA_UPDATE`, `SCHEMA_TABLE_CREATE/UPDATE/DELETE`
- `SCHEMA_FIELD_CREATE/UPDATE/DELETE`
- `DATA_UPSERT`, `DATA_DELETE`
- `RELATION_CREATE/UPDATE/DELETE`
- `IMPORT`, `EXPORT`

## 🧪 Validation à 3 Niveaux

### Niveau A - Validation de Structure (AJV)

- Valide `schema.json` contre le **meta-schema**
- Valide les **données** contre le schéma généré
- Détecte : types incorrects, champs manquants, regex, min/max, enum

**Exemples d'alertes** :
```
❌ ERROR: email ne correspond pas au pattern requis
❌ ERROR: age doit être >= 0 et <= 150
```

### Niveau B - Intégrité Relationnelle

- Vérifie les **clés primaires** (unicité, présence)
- Vérifie les **contraintes UNIQUE**
- Valide les **foreign keys** (existence des références)
- Contrôle les **cardinalités** (1-1, 1-n)

**Exemples d'alertes** :
```
❌ ERROR: FK invalide: user_999 n'existe pas dans Users.id
❌ ERROR: Clé primaire dupliquée
```

### Niveau C - Impact sur les Données

Analyse l'impact des changements de schéma sur les données existantes.

- Champ devient `required` → compte les enregistrements sans valeur
- Type change → estime les conversions impossibles
- Enum change → détecte les valeurs hors liste
- Relation change → signale les impacts cascade/restrict

**Exemples d'alertes** :
```
❌ ERROR: Le champ 'status' est requis mais 15 enregistrements n'ont pas de valeur
⚠️  WARN: 8 valeurs ne peuvent pas être converties en 'number'
💡 INFO: Appliquer la valeur par défaut: 'ACTIVE'
```

## 🎨 Pages de l'Application

### 1. Schema Explorer
- Liste des tables (sidebar)
- Détails table : champs, contraintes, dictionnaire métier
- **Mode JSON brut** (Monaco Editor) pour éditer `schema.json` directement

### 2. ER Diagram
- Visualisation interactive des tables et relations (React Flow)
- Drag & drop pour créer une relation
- Click sur edge pour éditer cardinalité / onDelete / onUpdate

### 3. Data Enrichment
- Sélection de table
- **Grille AG Grid** : liste des enregistrements
- **Formulaire généré** depuis le schéma :
  - Champs texte/date/enum selon type
  - Validation required/regex/min/max
  - FK en select/autocomplete

### 4. Audit Log
- Liste chronologique des événements (filtre par action/table)
- Détails : before/after (diff JSON)
- Format : timestamp, actor, action, target, reason

### 5. Validation Center
- **Summary card** : nombre d'erreurs/warnings/infos
- Alertes groupées par niveau (A, B, C)
- Bouton "Relancer" pour re-valider
- Quickfix disponibles pour certaines alertes

## 🔧 API Endpoints

### `POST /api/validate`
Valide un schéma + données + règles.

**Request** :
```json
{
  "schema": {...},
  "data": {...},
  "rules": [...]
}
```

**Response** :
```json
{
  "valid": true,
  "report": {
    "timestamp": "...",
    "summary": { "errors": 0, "warnings": 2, "infos": 1 },
    "alerts": [...],
    "levelA": [...],
    "levelB": [...],
    "levelC": [...]
  }
}
```

### `POST /api/apply-change`
Applique une mutation (schéma/données/relation).

**Request** :
```json
{
  "action": "DATA_UPSERT",
  "target": { "type": "record", "ref": "Users" },
  "before": {...},
  "after": {...},
  "reason": "Ajout d'un utilisateur"
}
```

**Response** :
```json
{
  "success": true,
  "event": {...},
  "alerts": [...],
  "newState": {...}
}
```

### `GET /api/state`
Retourne l'état complet (schema, data, rules, audit).

### `GET /api/export`
Génère et télécharge un ZIP contenant :
- `schema.json` - Définition du schéma
- `data/` - Dossier contenant un fichier JSON par table
  - `data/ref_articles.json`
  - `data/ref_categories_articles.json`
  - `data/...` (un fichier par table)
- `rules.json` - Règles métier
- `audit.ndjson` - Journal d'audit
- `validation-report.json` - Rapport de validation
- `migration-report.md` - Rapport de migration (si impacts détectés)

### `POST /api/import`
Upload un ZIP pour restaurer un projet.

## 🧰 Migrations Assistées

Quand un champ est renommé/supprimé/modifié, le système :

1. **Détecte** l'impact (Niveau C)
2. **Génère** un `migration-report.md` :
   - Changements détectés
   - Nombre d'enregistrements affectés
   - Suggestions de remédiation

**Exemple de rapport** :

```markdown
# Migration Report

## Changements détectés

| Localisation | Impact | Enregistrements affectés | Suggestion |
|--------------|--------|--------------------------|------------|
| /data/Users/*/status | Enum change | 15 | Utiliser: ACTIVE, INACTIVE |

## Remédiations recommandées

1. **ENUM_VALUE_INVALID**: Corriger les 15 valeurs hors enum
2. **REQUIRED_FIELD_MISSING**: Ajouter des valeurs par défaut ou rendre optionnel
```

## 🧪 Tests

Les tests couvrent :
- ✅ Validation de structure (Niveau A)
- ✅ Intégrité relationnelle (Niveau B)
- ✅ Impact sur données (Niveau C)
- ✅ Règles métier personnalisées

```bash
npm test
```

**Exemple de test** :

```typescript
it('should detect missing required field', () => {
  const data = {
    Users: [{ id: 'user_001', status: 'ACTIVE' }] // email manquant
  };
  const report = validator.validate(schema, data);
  expect(report.levelA.filter(a => a.severity === 'error').length).toBeGreaterThan(0);
});
```

## 📚 Exemples Fournis

Le dossier `storage/` contient des exemples complets :

- **3 tables** : Users, Projects, Tasks
- **3 relations** : Project Owner, Task Project, Task Assignee
- **5 règles métier**
- **7 événements d'audit**

Ces exemples démontrent :
- Cardinalités variées (1-1, 1-n, n-1)
- Actions référentielles (restrict, cascade, setNull)
- Dictionnaire métier (sensitivity, owner, tags)
- Règles avec quickfix

## 🔐 Qualité et Contraintes

- ✅ **TypeScript strict** activé
- ✅ Validation **côté front ET backend**
- ✅ Messages d'erreur **ultra clairs**
- ✅ Séparation en **couches JSON** (pas de gros JSON mêlé)
- ✅ Chaque action importante génère un **événement d'audit**
- ✅ Pas de TODO bloquant

## 🚫 Non-Objectifs (V1)

- ❌ Connexion à une DB réelle (PostgreSQL, MySQL)
- ❌ Collaboration temps réel (CRDT, Yjs)
- ❌ Intégration Git directe dans l'app
- ❌ Authentification multi-utilisateurs

## 🤝 Contribution

Pour contribuer :

1. Respecter **TypeScript strict**
2. Ajouter des **tests** pour les nouvelles fonctionnalités
3. Documenter les **alertes** avec code + suggestion + quickfix
4. Maintenir la **séparation des couches** (schema/data/rules/audit)

## 📄 Licence

MIT

---

**KOMA BBDR** - Modélisation, Validation et Audit de Schémas Relationnels
