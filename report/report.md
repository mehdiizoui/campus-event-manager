# Campus Event Manager — Rapport technique

**Cohorte :** MCS DE1 · **Auteur :** emzoui · **Date :** 11 septembre 2026
**Repo :** *(à compléter avec l'URL GitHub)*

---

## 1. Vue d'ensemble

L'application **Campus Event Manager** permet à une université de gérer ses événements de campus (workshops, talks, meetups, hackathons, activités) et le suivi des inscriptions étudiantes. L'objectif du projet est de démontrer la conception et l'exploitation d'une base **NoSQL orientée document** avec MongoDB, incluant l'utilisation combinée d'embedding, de références, de mise à jour de tableaux imbriqués et de pipelines d'agrégation.

**Stack retenue :** Node.js + Express + driver MongoDB officiel + EJS/Bootstrap. Cette stack privilégie la rapidité d'exécution et l'accès direct à la syntaxe MongoDB (les pipelines ne sont pas cachés derrière un ODM).

**MongoDB** est hébergé sur une VM Ubuntu (`emzoui`) et joint via `MONGODB_URI`. La base est nommée `campus_events`.

---

## 2. Modèle de données NoSQL

Deux collections principales :

### 2.1 Collection `users`
```json
{
  "_id": ObjectId,
  "firstName": "Amine",
  "lastName": "Zouiten",
  "email": "amine.zouiten@campus.edu",
  "department": "Data",
  "role": "student",
  "interests": ["nosql", "python", "ml"],
  "createdAt": ISODate
}
```
- `interests` → tableau de strings.
- `email` → indexé unique.
- `role` → énumération contrôlée (`student`, `teacher`, `staff`, `admin`).

### 2.2 Collection `events`
```json
{
  "_id": ObjectId,
  "title": "MongoDB Aggregation Workshop",
  "description": "…",
  "category": "Workshop",
  "tags": ["nosql", "mongodb", "data"],
  "startDate": ISODate,
  "endDate":   ISODate,
  "capacity": 25,
  "location": {
    "building": "Innovation Center",
    "room": "B204",
    "campus": "Paris"
  },
  "organizerId": ObjectId,
  "registrations": [
    { "userId": ObjectId, "registeredAt": ISODate, "status": "confirmed" }
  ],
  "createdAt": ISODate
}
```
- `location` → objet imbriqué.
- `tags` → tableau de strings, indexé.
- `registrations` → **tableau d'objets embedded**.
- `organizerId`, `registrations.userId` → **références** vers `users._id`.

### 2.3 Indexes créés (fichier `database/init.js`)

| Index                              | Type     | Justification |
|-------------------------------------|----------|--------------|
| `users.email`                       | unique   | Contrainte métier + recherche login |
| `events.startDate`                  | ascending | Tri du catalogue par date, dashboard "prochains events" |
| `events.category`                   | ascending | Filtre côté catalogue et pipeline "par catégorie" |
| `events.tags`                       | multikey | Filtre par tag |
| `events.registrations.userId`       | multikey | Recherche des events auxquels un user est inscrit |

### 2.4 Validation JSON-Schema
Appliquée côté MongoDB (`$jsonSchema` dans `createCollection`) pour garantir :
- `title` non vide, `capacity ≥ 1`, dates typées `date`, structure `location` complète ;
- `role` et `registrations.status` restreints à des valeurs contrôlées ;
- email conforme à un pattern regex.
Complétée par une validation applicative (message d'erreur lisible côté UI) et une vérification `endDate ≥ startDate` avant chaque insert/update.

---

## 3. Choix de modélisation : embedding vs referencing

Deux décisions clés :

**1) Les inscriptions sont embedded dans `events.registrations`.**
Raison : chaque event a un nombre borné de participants (quelques dizaines à ~200 max), les inscriptions sont **toujours lues avec l'event** (page détail, dashboard), et il faut appliquer des règles atomiques (capacité, doublons). Un tableau embedded permet des mises à jour atomiques via `$push`/`$pull` et un accès à `$size` sans join. Une collection séparée `registrations` aurait été plus proche du modèle relationnel mais aurait multiplié les requêtes.

**2) L'organisateur et les utilisateurs sont référencés par `ObjectId`.**
Raison : un utilisateur peut être organisateur ou participant de nombreux events ; ses données changent (email, département…) et doivent rester cohérentes en un seul endroit. Dupliquer les infos dans chaque event aurait conduit à une dénormalisation coûteuse à maintenir. Le prix payé — un `$lookup` sur la page Users et un `find({_id: {$in:[…]}})` sur la page détail — reste faible car les volumes sont raisonnables et les indexes couvrent les jointures.

---

## 4. Architecture de l'application

```
src/
├── app.js                # bootstrap Express, EJS, méthodes overrides
├── db.js                 # singleton MongoClient (MongoDB driver v6)
├── routes/               # handlers HTTP par domaine
│   ├── dashboard.js
│   ├── events.js
│   ├── users.js
│   └── analytics.js
├── repositories/         # TOUTES les opérations MongoDB
│   ├── events.js         # CRUD + agrégations + registrations
│   ├── users.js          # CRUD + $lookup pour comptage / users sans inscription
│   └── analytics.js      # pipelines A..F
├── views/                # templates EJS (5 pages)
└── public/css/style.css
```

La séparation **routes ↔ repositories** rend les requêtes et pipelines MongoDB immédiatement identifiables dans le code, comme demandé dans le brief.

---

## 5. Pages de l'application (résumé)

| Page                | Fonctions clés (côté MongoDB) |
|---------------------|-------------------------------|
| **Dashboard**       | `countDocuments`, `find + sort + limit`, agrégation `$unwind + $match + $group` pour le total confirmé, `$filter + $size` pour le plus populaire. |
| **Events**          | CRUD complet (`insertOne`, `updateOne`, `deleteOne`), filtres via `$regex`, `$gte/$lt`, tag array, tri, projection. |
| **Détail event**    | `$push` (nouvelle inscription), positional `$` (`$set` sur `registrations.$.status`) pour annuler, `$pull` pour retirer, contrôle capacité + anti-doublon. |
| **Users**           | CRUD, `$lookup` pipeline pour compter les inscriptions par user, refus de suppression si références. |
| **Analytics**       | 6 pipelines d'agrégation (voir §6). |

*(Insérer ici les 5 captures d'écran, une par page)*

---

## 6. Focus sur deux pipelines d'agrégation

### 6.1 Analyse D — Events au-dessus de l'occupation moyenne (`analytics.eventsAboveAverageOccupancy`)

Cette analyse illustre le calcul d'une moyenne globale puis un filtrage individuel :

1. `$project` : calcule pour chaque event le nombre d'inscriptions confirmées via `$filter + $size`.
2. `$addFields` : calcule le pourcentage d'occupation `confirmed / capacity * 100` (avec `$cond` pour éviter la division par zéro).
3. `$group _id: null` : agrège tous les events pour calculer `avg` et pousse chaque document dans un tableau `items`.
4. `$unwind` + `$replaceRoot` + `$mergeObjects` : ré-étale les documents en injectant `overallAverage` dans chacun.
5. `$match: { $expr: { $gt: [ "$occupancy", "$overallAverage" ] } }` : ne conserve que ceux au-dessus de la moyenne.
6. `$sort` : trie par occupation décroissante.

Ce pipeline combine 6 stages et démontre l'usage de champs calculés (`$cond`, `$divide`, `$multiply`) et d'un `$expr` pour référencer un champ calculé dans un `$match`.

### 6.2 Analyse C — Utilisateurs sans inscription (`users.usersWithNoRegistration`)

Cette analyse utilise un `$lookup` corrélé pour identifier les utilisateurs jamais inscrits :

1. `$lookup` avec `let: { uid: '$_id' }` et un sous-pipeline qui filtre les events dont le tableau `registrations.userId` contient `$$uid` (utilisation de `$in` sur un tableau) ; `$limit: 1` pour arrêter dès qu'un event est trouvé.
2. `$match: { refs: { $size: 0 } }` : conserve les utilisateurs pour lesquels le résultat du `$lookup` est vide.
3. `$sort` : tri alphabétique.

L'usage du sous-pipeline dans `$lookup` évite de récupérer l'ensemble des events et permet à MongoDB d'exploiter l'index `events.registrations.userId`.

---

## 7. Cohérence et gestion d'erreurs

L'application détecte et affiche les erreurs suivantes :

- email en doublon (`code 11000` → 409) ;
- capacité invalide (400) ;
- date de fin < date de début (400) ;
- event ou user introuvable (404) ;
- inscription en double sur un event (409) ;
- event complet : l'inscription bascule automatiquement en `waiting` ;
- identifiant malformé (400 via `ObjectId.isValid`) ;
- suppression d'un user encore référencé : bloquée avec message explicite.

---

## 8. Conclusion

### Difficultés rencontrées
- Trouver le bon équilibre entre embedding (rapidité de lecture, atomicité) et referencing (cohérence) sur les inscriptions.
- Écrire un pipeline lisible pour l'analyse D : injecter une moyenne globale dans chaque document sans passer par deux requêtes séparées.

### Limitations
- Pas d'authentification : l'utilisateur "connecté" est simulé via la sélection d'un user dans les formulaires d'inscription.
- Pas de pagination : le volume de données est faible (18 events), inutile pour ce périmètre.

### Améliorations possibles
- Ajouter un `changeStream` pour rafraîchir le dashboard en temps réel.
- Passer les statistiques du dashboard dans un job planifié + cache Redis pour un service à plus grand volume.
- Ajouter un module d'authentification (Passport) pour restreindre le CRUD aux organisateurs.
