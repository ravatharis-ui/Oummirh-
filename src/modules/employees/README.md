# Module `employees` — Collaboratrices

_Implémenté en Phase 2._

- **Rôle** : fiches des collaboratrices, comptes de connexion, codes PIN.
- **Tables** : `employees`. Écrit aussi `user_roles` et `audit_log` via les fonctions SQL ci-dessous.
- **Événements émis** : aucun pour l'instant.
- **Événements écoutés** : aucun.
- **Écrans** : `/admin/collaboratrices` (liste, création, fiche), `/profil` côté collaboratrice.

## Le point important : `pin_hash` n'est lisible par personne

Aucun rôle, direction comprise, n'a le droit de lire cette colonne. Seules les fonctions
`security definer` y accèdent. Deux conséquences :

1. **Ne jamais écrire `select *` sur `employees`.** Le client Supabase l'envoie par défaut quand
   `.select()` est appelé sans argument, et Postgres refuse la requête entière. Listez toujours
   les colonnes. Un test pgTAP verrouille ce comportement.
2. Un code PIN perdu ne se retrouve pas : on en génère un nouveau. C'est ce qui fait qu'il vaut
   quelque chose.

## Fonctions SQL

| Fonction                           | Qui peut l'appeler | Rôle                                                                    |
| ---------------------------------- | ------------------ | ----------------------------------------------------------------------- |
| `login_boutiques()`                | `anon`             | points de vente ayant au moins une collaboratrice                       |
| `login_employees(boutique)`        | `anon`             | prénoms d'une boutique, rien d'autre                                    |
| `login_employee(id)`               | `anon`             | une collaboratrice, pour l'écran mémorisé                               |
| `verify_employee_pin(id, pin, ip)` | `service_role`     | vérifie, journalise, verrouille après 5 échecs                          |
| `reset_employee_pin(id, pin)`      | direction          | remplace un code, trace, lève le verrouillage                           |
| `admin_create_employee(...)`       | direction          | crée la fiche, le rôle et le code haché, en une transaction             |
| `current_employee_id()`            | connectées         | identifiant de la collaboratrice, utilisé par la RLS des autres modules |

## Les deux emails

`employees.email` est l'adresse **réelle**, facultative, utilisée pour les notifications.
Le compte de connexion porte une adresse **technique** en `@staff.oummi.invalid`, un domaine
réservé par la RFC 2606 qui ne peut jamais recevoir de courrier. Les confondre casserait la
connexion : `verify_employee_pin` renvoie explicitement l'adresse technique.

## Verrouillage

Cinq échecs en 15 minutes bloquent le compte. Le compteur repart à zéro après une connexion
réussie, et les échecs sortent de la fenêtre d'eux-mêmes. Les tentatives faites pendant le
verrouillage ne sont pas journalisées : marteler la porte ne prolonge pas le blocage.
