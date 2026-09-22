# core/db

Clients Supabase et types de la base.

| Fichier     | Clé utilisée               | RLS            | À utiliser depuis                                        |
| ----------- | -------------------------- | -------------- | -------------------------------------------------------- |
| `client.ts` | `anon`                     | appliquée      | composants client                                        |
| `server.ts` | `anon` + cookie de session | appliquée      | Server Components, Server Actions, Route Handlers        |
| `admin.ts`  | `service_role`             | **contournée** | uniquement du code serveur qui a déjà vérifié les droits |

`database.types.ts` est régénéré par `npm run db:types` après chaque migration. Les alias
pratiques vivent dans `types.ts` pour ne pas être écrasés par la régénération.
