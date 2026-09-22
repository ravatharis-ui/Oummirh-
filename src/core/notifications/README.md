# core/notifications

`createNotifier(registry)` fabrique la fonction `notify` que reçoit chaque gestionnaire
d'événement. Un gestionnaire dit **quoi est arrivé et à qui**, jamais comment c'est formulé :
les titres et les corps viennent des manifestes de modules, via le registre.

## Deux canaux, une seule vérité

La **cloche** est le canal qui fait foi : la notification est en base, elle sera vue.
L'**email** est un confort par-dessus. Une clé Resend absente, un domaine non vérifié ou une
panne du service produisent donc un avertissement, pas une erreur : faire échouer un événement
métier à cause d'un email non parti serait un mauvais échange.

## Adresses

Une collaboratrice se connecte avec une adresse technique en `.invalid`, un suffixe que la
RFC 2606 garantit non routable. `resolveRecipientEmail()` cherche donc d'abord l'adresse réelle
sur sa fiche, et refuse tout ce qui se termine par `.invalid`.

## Emails

Styles en ligne et tableaux : la plupart des clients de messagerie suppriment les feuilles de
style, et plusieurs ignorent encore flexbox. La palette est écrite en dur pour la même raison,
les variables CSS ne survivent pas non plus à une boîte de réception.
