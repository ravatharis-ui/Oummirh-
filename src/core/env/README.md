# core/env

Lecture et validation (Zod) des variables d'environnement. La validation est **paresseuse** :
elle s'exécute à l'appel, pas à l'import, pour qu'un build reste possible sans projet configuré
et qu'une variable manquante produise un message clair en français plutôt qu'une page blanche.

`getPublicEnv()` ne contient que des valeurs publiques. `getServerEnv()` expose la clé
`service_role` et ne doit jamais être importée depuis un composant client.
