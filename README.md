# Gestionnaire d'Évaluation — GE 3.0

Plateforme de gestion scolaire pour l'enseignement primaire (Bénin), organisée
autour de l'élève et de la hiérarchie administrative :
**Ministère → DDEMP → Circonscription Scolaire → École / Directeur → Enseignant → Élève**.

## Contenu du dépôt

| Fichier | Description |
|---------|-------------|
| **`index.html`** | La plateforme, **connectée** à une base de données centrale Supabase : authentification réelle, données partagées entre tous les appareils, sécurité par rôle. |

## Modules

Saisie des notes · Bulletins · Statistiques & analyses · Bilan de passage ·
Examen blanc CEP · Relevé de notes CEP · Fiche d'inscription CEP · Carte scolaire ·
Cantine · Présences · Relevés mensuels · Tableau d'affichage · Enrôlement des élèves ·
Synthèses École / Circonscription / DDEMP / National · Export CSV & Excel ·
Conversion PDF → tableau · Impression en masse (bulletins, cartes).

## Utilisation

Ouvrir la plateforme dans un navigateur — connexion Internet requise. La configuration
Supabase (URL + clé publique) est intégrée dans le fichier. L'administrateur crée la
hiérarchie, les directeurs créent les enseignants, les enseignants enrôlent les élèves.

En ligne : <https://ge3.vercel.app>

## Architecture cloud (Supabase)

- **PostgreSQL** : 13 tables reliées (hiérarchie, élèves, notes, modules annexes).
- **Auth** : comptes email/mot de passe.
- **RLS (Row Level Security)** : chaque rôle ne voit que son périmètre.
- **Edge Functions** : création de comptes et réinitialisation de mots de passe sécurisées.

## Licence

Projet éducatif — usage interne.
