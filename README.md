# Oummi RH

Application RH d'**Oummi Dressing** (La Réunion) : pointage avec selfie, plannings multi-boutiques,
congés, heures, remplacements, échanges de créneaux, documents. Espace collaboratrice sur
smartphone (code PIN) et espace direction sur ordinateur.

## Tout est hébergé

Rien ne tourne sur votre ordinateur. Trois services se chargent de tout :

- **Supabase** héberge la base de données, les comptes et les fichiers.
- **Vercel** héberge l'application, avec une adresse que vos collaboratrices ouvrent sur leur téléphone.
- **GitHub** garde le code, applique les mises à jour de la base et redéploie automatiquement.

👉 **[Guide de mise en ligne, pas à pas](docs/DEPLOIEMENT.md)** — écrit pour une personne non
développeuse, uniquement depuis le navigateur.

## Au quotidien

| Ce que vous voulez faire          | Comment                                                           |
| --------------------------------- | ----------------------------------------------------------------- |
| Voir l'application                | Ouvrir l'adresse Vercel sur votre téléphone ou votre ordinateur   |
| Créer ou mettre à jour les tables | GitHub → onglet `Actions` → « Base de données » → `Run workflow`  |
| Vérifier que tout est sain        | GitHub → onglet `Actions` → le dernier « CI » doit être vert      |
| Modifier un réglage               | Table `settings` dans Supabase, ou `/admin/parametres` (Phase 11) |

Chaque modification du code redéploie l'application toute seule, en une minute environ.

## État d'avancement

| Phase | Contenu                                               | État |
| ----- | ----------------------------------------------------- | ---- |
| 0     | Fondations (projet, qualité, CI, structure modulaire) | ✅   |
| 1     | Socle base de données, registre de modules, espaces   | ✅   |
| 2     | Authentification (PIN, direction), collaboratrices    | ⏳   |
| 3     | Événements et notifications                           | ⏳   |
| 4     | Pointage selfie                                       | ⏳   |
| 5     | Planning                                              | ⏳   |
| 6     | Congés                                                | ⏳   |
| 7     | Heures et récupération                                | ⏳   |
| 8     | Remplacements directs                                 | ⏳   |
| 9     | Échanges de créneaux                                  | ⏳   |
| 10    | Documents                                             | ⏳   |
| 11    | Finitions et mise en production                       | ⏳   |

---

## Pour les développeurs

L'architecture, les règles de sécurité et les conventions sont dans [`CLAUDE.md`](CLAUDE.md).
Le cahier des charges complet est dans [`PROMPT.md`](PROMPT.md).

Travailler en local est **facultatif**. Si vous le souhaitez :

```bash
npm install
cp .env.example .env.local        # puis renseigner les valeurs Supabase
npm run dev                       # http://localhost:3000
```

Contrôles qualité, identiques à ceux de la CI :

```bash
npm run check      # formatage, règles d'architecture, types, tests unitaires
npm run test:e2e   # parcours automatisés (mobile + ordinateur)
```

Base de données, sur le projet hébergé :

```bash
npm run db:link    # une fois
npm run db:push    # applique les migrations
npm run db:types   # régénère src/core/db/database.types.ts
npm run test:db    # tests de sécurité (RLS), extension pgtap requise
```

Ces trois dernières commandes font exactement ce que fait le bouton « Base de données » de GitHub
Actions : utilisez l'un ou l'autre, jamais les deux en même temps.
