# Module `documents`

Le coffre-fort numérique : fiches de paie, contrats, avenants, attestations.

## Ce que le module tient

Ce n'est pas un partage de fichiers. C'est le seul endroit où une collaboratrice retrouvera son
bulletin de septembre **dans deux ans**.

## L'exigence qui gouverne tout

**Une collaboratrice ne peut pas télécharger le document d'une autre, même en devinant le
chemin.** Trois barrières superposées :

1. **RLS sur la table** — elle ne voit que les lignes dont elle est destinataire. Deviner
   l'identifiant d'un document ne le fait pas apparaître.
2. **Politique de stockage sur le chemin** — un fichier n'est lisible que depuis `<son id>/…`.
3. **URL signée à soixante secondes** — demandée au clic, jamais stockée. Il n'existe donc aucun
   lien à recopier ou à transmettre.

Le dépôt, lui, est réservé à la direction : aucune politique d'`insert` n'existe pour une
collaboratrice.

## Le dépôt en lot

Vingt fiches de paie d'un coup, une fois par mois. Les associer une par une serait long, donc mal
fait — d'où la reconnaissance automatique par nom de fichier (`domain/matching.ts`).

Elle est délibérément **timide** : au moindre doute, elle ne propose rien.

| Cas                             | Résultat                               |
| ------------------------------- | -------------------------------------- |
| `HOARAU_Aurelie_092026.pdf`     | associée                               |
| `PAYET_Sophie.pdf` (deux Payet) | associée — le prénom tranche           |
| `PAYET_092026.pdf` (deux Payet) | **rien** — à associer à la main        |
| `PAYETTE.pdf`                   | rien — « PAYETTE » n'est pas « PAYET » |
| `bulletin_0042.pdf`             | rien                                   |

L'envoi reste bloqué tant qu'un fichier n'est pas associé, et l'écran prévient si deux fichiers
visent la même personne. Attribuer la fiche de paie de quelqu'un à une autre personne est l'erreur
la plus grave que ce module puisse commettre.

## Le chemin d'un fichier

Le PDF va **du navigateur de la direction directement au stockage** : dix mégaoctets n'ont rien à
faire dans la mémoire du serveur d'application. Seule la ligne de base passe par le serveur, et
`prepareDocumentPath` construit le chemin côté serveur — c'est lui qui garantit le bon dossier,
et la fonction SQL le revérifie.

Si l'enregistrement échoue après l'envoi, le fichier est retiré : sinon le stockage garderait un
orphelin que plus rien ne référence.

## Le suivi de lecture

`first_viewed_at` est écrit **par la base**, pas par le navigateur : une collaboratrice ne peut ni
prétendre n'avoir jamais vu un document, ni en marquer un qu'elle n'a pas ouvert.

Seule la **première** ouverture est retenue. Combien de fois elle relit son bulletin ne regarde
personne.

## Limites

PDF uniquement, **10 Mo** maximum. Vérifié dans le navigateur (`checkDocumentFile`) et par la
contrainte de taille en base.

## Événements

**Émis** : `documents.added` — `{ id, employee_id, category, title, period_month }`.

**Écoutés** : le sien, pour notifier la destinataire. « Ta fiche de paie de septembre est
disponible » est le genre de message qu'on attend : il part **aussi par email**.

## Écrans

| Route              | Espace         |
| ------------------ | -------------- |
| `/documents`       | Collaboratrice |
| `/admin/documents` | Direction      |
