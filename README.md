# Campus Event Manager

Application web légère de gestion d'événements de campus, développée pour le projet **NoSQL Development Project – MCS DE2**.
Base de données **MongoDB**, backend **Node.js / Express**, templates **EJS + Bootstrap 5**.

**Auteur :** el mahdi zoui

---

## 1. Objectif

Fournir à une université une petite application capable de gérer des événements (workshops, talks, meetups, hackathons, activités étudiantes), leurs utilisateurs, leurs inscriptions, et de produire des indicateurs d'activité via des pipelines d'agrégation MongoDB.

## 2. Technologies

| Composant   | Choix                                     |
|-------------|-------------------------------------------|
| Base        | MongoDB (installée sur VM Ubuntu `emzoui`) |
| Backend     | Node.js 18+ · Express 4                   |
| Driver      | `mongodb` officiel (v6)                   |
| Vues        | EJS · Bootstrap 5 (CDN)                   |
| Config      | dotenv                                    |
| Outils      | method-override (formulaires PUT/DELETE)  |

## 3. Installation

Prérequis : Node.js ≥ 18 et une instance MongoDB accessible (locale ou sur VM).

```bash
git clone <votre-url-github> campus-event-manager
cd campus-event-manager
npm install
cp .env.example .env
```

## 4. Configuration de la connexion MongoDB

Éditer `.env` :

```
MONGODB_URI=mongodb://emzoui:27017
MONGODB_DB=campus_events
PORT=3000
```

- Si MongoDB est sur une VM (comme ici, VM Ubuntu appelée `emzoui`), assurez-vous que le nom `emzoui` est résolu (via `/etc/hosts` ou DNS local) et que le port 27017 est ouvert.
- En local : `MONGODB_URI=mongodb://localhost:27017`.
- Ne **jamais** commiter `.env` — utiliser `.env.example` comme référence.

## 5. Initialisation et seed de la base

```bash
npm run db:init    # crée les collections, la validation JSON-schema et les indexes
npm run db:seed    # insère 15 users, 18 events, 40+ inscriptions
# ou tout en un :
npm run db:setup
```

## 6. Lancer l'application

```bash
npm start
# http://localhost:3000
```

## 7. Pages de l'application

| # | Route                    | Fichier                          | Description |
|---|--------------------------|----------------------------------|-------------|
| 1 | `/`                      | `views/dashboard.ejs`            | Cartes KPI, 5 prochains events, event le plus populaire |
| 2 | `/events`                | `views/events/list.ejs`          | Catalogue + CRUD + filtres (titre, catégorie, tag, date, tri) |
| 3 | `/events/:id`            | `views/events/detail.ejs`        | Détail d'un event + gestion des inscriptions (embedded) |
| 4 | `/users`                 | `views/users/list.ejs`           | Annuaire + détail + historique d'inscriptions |
| 5 | `/analytics`             | `views/analytics.ejs`            | 6 pipelines d'agrégation (A à F) |

## 8. Où trouver les opérations MongoDB

Toutes les opérations sont regroupées dans `src/repositories/` :

- `repositories/events.js` : CRUD events, inscriptions embedded (`$push`, `$pull`, positional `$`), agrégations dashboard.
- `repositories/users.js` : CRUD users, unicité email (index unique), suppression avec vérification de références, pipeline "users sans inscription" (`$lookup`).
- `repositories/analytics.js` : pipelines A à F.

## 9. Structure du repo

```
campus-event-manager/
├── database/
│   ├── init.js     # collections + validation + indexes
│   └── seed.js     # données initiales reproductibles
├── src/
│   ├── app.js
│   ├── db.js
│   ├── repositories/{events,users,analytics}.js
│   ├── routes/{dashboard,events,users,analytics}.js
│   ├── views/…
│   └── public/css/style.css
├── report/report.pdf
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## 10. Sécurité

Aucun mot de passe ni chaîne de connexion privée n'est commité. La chaîne de connexion est lue depuis `.env` (ignoré par git).
