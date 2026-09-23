# Oummi RH — guide de la direction

_Une page. Le reste s'apprend en cliquant._

## Les six écrans

| Écran               | Ce qu'on y fait                                                       |
| ------------------- | --------------------------------------------------------------------- |
| **Collaboratrices** | Créer une fiche, tirer un code PIN, archiver quelqu'un qui part.      |
| **Planning**        | La semaine de toute l'équipe. Cliquer une case pour la remplir.       |
| **Pointage**        | Qui est arrivé, qui manque, en temps réel. Et l'historique.           |
| **Congés**          | Valider, refuser, voir les soldes, le calendrier des absences.        |
| **Heures**          | Le compteur de récupération, mois par mois. Export pour le comptable. |
| **Documents**       | Déposer les fiches de paie, voir qui les a ouvertes.                  |

Plus **Remplacements**, **Échanges** et **Paramètres**.

## Les trois choses à faire chaque semaine

1. **Le planning.** Ouvrez la semaine, cliquez **Copier la semaine précédente**, ajustez. Les
   congés et remplacements déjà posés ne sont jamais écrasés.
2. **Les demandes en attente** — congés, récupérations, échanges. La cloche vous les signale.
3. **Un coup d'œil au pointage** en fin de journée : les départs non pointés sont signalés.

## Une fois par mois

**Déposer les fiches de paie.** Documents → _Déposer les fiches de paie du mois_ → glissez tous
les PDF d'un coup. L'application reconnaît les noms de fichiers ; ce qu'elle ne reconnaît pas,
vous l'associez à la main.

> Le bouton d'envoi reste bloqué tant qu'un fichier n'est pas associé. C'est voulu : mieux vaut
> trois clics de plus qu'une fiche de paie envoyée à la mauvaise personne.

## Une fois par an

**Les jours fériés.** Paramètres → Jours fériés. Pâques et l'Ascension changent de date chaque
année. Sans elles, ces journées seraient décomptées des congés comme des jours ordinaires —
l'écran vous prévient quand il n'en reste plus à venir.

## Corriger un pointage

Pointage → Historique → **Corriger**. Un motif est obligatoire.

La correction **s'ajoute**, elle ne remplace pas : le pointage d'origine reste en base, et la
ligne porte la mention « corrigé ». C'est ce qui rend le registre défendable si on vous le
demande un jour.

## Ce que vous pouvez régler vous-même

Paramètres. Nom de l'entreprise, horaires par défaut, règle d'acquisition des congés, tolérance
de retard, fenêtre des alertes, durée de conservation des photos, points de vente, types de
contrat, jours fériés, et l'activation de chaque module.

Chaque modification est enregistrée avec sa valeur précédente : on peut toujours savoir qui a
changé quoi, et quand.

## Trois principes à connaître

**Rien ne s'efface.** Un pointage corrigé, un congé annulé, un solde ajusté : l'original reste, et
la modification s'ajoute par-dessus. C'est plus sûr, et c'est ce qui permet d'expliquer un solde
un an plus tard.

**Un solde n'est jamais un chiffre qu'on rectifie.** C'est la somme de mouvements. Pour le
corriger, vous ajoutez un ajustement motivé — et le motif reste visible.

**Chaque collaboratrice ne voit que ce qui la concerne.** Ses collègues savent seulement qui
travaille avec elles aujourd'hui. Jamais un congé, jamais un arrêt maladie, jamais une raison
d'absence.

## Quelque chose ne va pas

- **Une page est blanche après une mise à jour.** Dans Vercel, ajoutez la variable
  `CSP_REPORT_ONLY` à `1` et redéployez : l'application refonctionne pendant qu'on regarde.
- **Le bouton « Base de données » échoue.** Ouvrez le détail dans l'onglet Actions : le premier
  message rouge nomme la cause.
- **Une collaboratrice ne reçoit pas ses emails.** Les notifications dans l'application, elles,
  arrivent toujours : l'email est un confort, la cloche fait foi.
