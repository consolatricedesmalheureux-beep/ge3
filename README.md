# Gestionnaire d'Évaluation — GE 3.0

Plateforme de gestion scolaire pour l'enseignement primaire (Bénin), organisée
autour de l'élève et de la hiérarchie administrative :
**Ministère → DDEMP → Circonscription Scolaire → École / Directeur → Enseignant → Élève**.

## Contenu du dépôt

| Fichier | Description |
|---------|-------------|
| **`plateforme.html`** | Version **autonome** (hors-ligne). Toutes les données restent dans le navigateur (localStorage). Aucune installation, aucun serveur. |
| **`plateforme-cloud.html`** | Version **connectée** à une base de données centrale Supabase : authentification réelle, données partagées entre tous les appareils, sécurité par rôle. |
| `index.html` | Page d'accueil : liens vers les deux versions. |

## Modules

Saisie des notes · Bulletins · Statistiques & analyses · Bilan de passage ·
Examen blanc CEP · Relevé de notes CEP · Fiche d'inscription CEP · Carte scolaire ·
Cantine · Présences · Relevés mensuels · Tableau d'affichage · Enrôlement des élèves ·
Synthèses École / Circonscription / DDEMP / National · Export CSV & Excel ·
Conversion PDF → tableau · Impression en masse (bulletins, cartes).

## Utilisation

### Version locale
Ouvrir `plateforme.html` dans un navigateur. Compte de départ : `admin` / `admin`.

### Version cloud
Ouvrir `plateforme-cloud.html` (connexion Internet requise). La configuration Supabase
(URL + clé publique) est intégrée dans le fichier. L'administrateur crée la hiérarchie,
les directeurs créent les enseignants, les enseignants enrôlent les élèves.

## Architecture cloud (Supabase)

- **PostgreSQL** : 13 tables reliées (hiérarchie, élèves, notes, modules annexes).
- **Auth** : comptes email/mot de passe.
- **RLS (Row Level Security)** : chaque rôle ne voit que son périmètre.
- **Edge Functions** : création de comptes et réinitialisation de mots de passe sécurisées.

## Licence

Projet éducatif — usage interne.
