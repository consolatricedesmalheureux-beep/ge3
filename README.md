# Gestionnaire d'Évaluation — GE 3.0

Plateforme hiérarchisée de gestion scolaire pour l'enseignement primaire (Bénin).
Seize modules, six profils, remontée automatique des données de l'enseignant au ministère.

Conception fonctionnelle : MAÎTRE MARIANO.
Référence : *Cahier des charges — Plateforme hiérarchisée de gestion scolaire* et
*Notes conceptuelles des modules 1 à 16*.

En ligne : <https://ge3.vercel.app>

## Principe directeur

**La saisie unique.** Une donnée n'est renseignée qu'une seule fois, au niveau où
elle est constatée. Toutes les consolidations en découlent automatiquement : aucun
échelon supérieur ne ressaisit ce qu'un échelon inférieur a déjà enregistré.

## Contenu du dépôt

| Fichier | Rôle |
|---|---|
| `index.html` | L'application : 16 modules, génération PDF, imports/exports Excel, signatures |
| `assets/ge3-backend.js` | Authentification, session, stockage cloud, file d'attente hors ligne |
| `assets/ge3-saisie-cloud.js` | Module ① branché sur les tables relationnelles |
| `assets/ge3-droits.js` | Matrice des droits d'accès (cahier des charges §5.1) |
| `assets/ge3-sync.js` | Synchronisation incrémentale et résolution des conflits |
| `assets/ge3-admin.js` | Module ⑰ Administration : comptes et habilitations |
| `assets/ge3-syntheses.js` | Modules ⑬ et ⑭ : consolidation calculée, appréciation rédigée |
| `assets/ge3-etablissements.js` | Établissements (§6.1) et module ⑱ Tableau de bord |
| `sw.js` | Service worker : fonctionnement hors connexion |
| `manifest.webmanifest`, `icons/` | Installation sur l'appareil |

## Les six profils

| Niveau | Profil | Périmètre |
|---|---|---|
| 1 | Enseignant | Sa classe |
| 2 | Directeur d'école | Toutes les classes de son école |
| 3 | Responsable d'unité pédagogique | Les écoles de son unité |
| 4 | Circonscription scolaire | Toutes les écoles de son ressort |
| 5 | DDEMP | Toutes les CS de son département |
| 6 | MEMP | Vision nationale |

Un profil `admin` administre la plateforme et n'appartient pas à la hiérarchie.

Chaque utilisateur ne voit que les modules relevant de ses attributions : les
fonctions inaccessibles sont **absentes de la navigation**, non désactivées (§4.4).
Enseignant 11 modules, directeur 16, circonscription 16, DDEMP 14, MEMP 12.

## Modèle de données

La hiérarchie administrative est reflétée dans le schéma (§10.3) :

```
MEMP → DDEMP → Circonscription → Unité pédagogique → École → Classe → Élève
```

- `annees_scolaires` — l'année est une dimension à part entière ; une seule active.
- `ups`, `classes` — entités introduites pour respecter le §10.3.
- `eleves` — identifié par son **NPI** ; le rang dans la liste sert de secours et
  distingue deux homonymes d'une même classe.
- `evaluations`, `notes` — une ligne par note ; validation et signature tracées.
- `parametres` — seuil de réussite et paramètres nationaux.
- `journal` — traçabilité des saisies et modifications (§7.4).

## Sécurité des accès

Le contrôle des droits est appliqué **côté serveur**, par les politiques RLS de
PostgreSQL, indépendamment de ce qu'affiche l'application cliente (§10.4). Le
filtrage de l'interface est un confort, jamais une protection.

Les vues de consolidation sont déclarées `security_invoker` : sans cela, elles
s'exécuteraient avec les droits de leur propriétaire et un compte d'école verrait
le pays entier.

## Consolidation

Les agrégats sont calculés côté serveur (§10.1), jamais dans le navigateur :

`v_conso_classe` → `v_conso_ecole` → `v_conso_up` → `v_conso_cs` → `v_conso_ddemp` → `v_conso_national`

Le seuil de réussite provient du paramètre national. Des taux calculés sur des
seuils différents ne seraient ni consolidables ni comparables (§6.3). La
ventilation garçons / filles est systématique.

## Règle de résolution des conflits

Le §10.2 exige une règle « définie et documentée ». La voici.

Chaque donnée porte un **numéro de version**. Le client annonce la version sur
laquelle il s'est fondé. Si la version en base a changé depuis, l'écriture est
**refusée** : la valeur écartée est conservée côté serveur, dans la table
`conflits`, et l'utilisateur est informé. Il choisit alors laquelle fait foi, et
son choix est inscrit au journal.

**Aucune écriture n'écrase donc une autre à l'insu de son auteur.** Un enseignant
revenant en ligne après une saisie hors connexion ne peut pas effacer sans le
savoir le travail d'un collègue.

La synchronisation est incrémentale dans les deux sens : seules les données
modifiées circulent, la bande passante étant facturée à l'usage.

## Fonctionnement hors connexion

Exigence déterminante (§7.2) : de nombreuses écoles n'ont pas de connexion
permanente.

- Toutes les saisies fonctionnent sans réseau ; l'écriture locale a toujours lieu
  d'abord, la remontée est opportuniste.
- Les écritures faites hors ligne sont empilées et rejouées à la reconnexion.
- L'état de synchronisation est affiché en permanence.
- Les bibliothèques d'export sont mises en cache, pour que **PDF et Excel restent
  disponibles hors ligne**.
- À la déconnexion, les données du compte sont effacées du cache local : les
  postes sont souvent partagés.

## Arbitrages retenus par défaut

Le cahier des charges (§13) laisse plusieurs points à la décision de l'autorité.
Deux ont été tranchés provisoirement, selon l'option que le document recommande :

- **Seuil de réussite** : fixé au niveau **national**, condition de comparabilité.
- **Responsable d'unité pédagogique** : **sixième profil** distinct.

Ces choix sont réversibles.

## Reste à faire

- **Migration relationnelle des modules ② à ⑯.** Le module ① et les synthèses
  ⑬ ⑭ sont branchés sur les tables ; les autres passent encore par le stockage
  par compte, versionné et synchronisé, mais non consolidable entre écoles.
- Base locale dans l'appareil, en remplacement de `localStorage` (§10.1).
- Interface de paramétrage du seuil national et du calendrier scolaire (§6.3).
- Validation et signature des documents par le directeur (§7.5).

## Licence

Projet éducatif — usage interne.
