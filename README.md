# NFC Card Manager

Application Node.js pour gérer des cartes NFC avec profils sociaux et sous-domaines dynamiques.

## 🎯 Fonctionnalités

- ✅ Gestion de cartes NFC avec sous-domaines uniques
- ✅ Profils sociaux (Snapchat, TikTok, WhatsApp, LinkedIn, Instagram, Facebook)
- ✅ Page one-page personnalisée pour chaque carte
- ✅ Panel d'administration complet
- ✅ Base de données MySQL
- ✅ Support des sous-domaines dynamiques
- ✅ Déploiement Vercel ready

## 📋 Prérequis

- Node.js (v14 ou supérieur)
- MySQL (v5.7 ou supérieur)
- npm ou yarn

## 🚀 Installation

1. **Cloner le projet**
```bash
cd nfc_card
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configuration de l'environnement**
```bash
cp .env.example .env
```

Modifier le fichier `.env` avec vos informations :
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=votre_mot_de_passe
DB_NAME=nfc_cards_db
DB_PORT=3306

SESSION_SECRET=votre_cle_secrete
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

PORT=3000
NODE_ENV=development

BASE_DOMAIN=localhost:3000
```

4. **Initialiser la base de données**
```bash
npm run init-db
```

5. **Démarrer l'application**
```bash
# Mode développement
npm run dev

# Mode production
npm start
```

## 🌐 Utilisation

### Accès à l'administration
- URL: `http://localhost:3000/admin/login`
- Identifiants par défaut: admin / admin123

### Créer une carte NFC
1. Connectez-vous au panel admin
2. Cliquez sur "Nouvelle carte"
3. Remplissez les informations (nom, sous-domaine, réseaux sociaux)
4. Sauvegardez

### Accéder au profil
Chaque carte est accessible via son sous-domaine :
- Format: `http://[subdomain].localhost:3000`
- Exemple: `http://john-doe.localhost:3000`

## 🏗️ Structure du projet

```
nfc_card/
├── config/
│   └── database.js          # Configuration MySQL
├── middleware/
│   ├── auth.js              # Authentification admin
│   └── subdomain.js         # Gestion des sous-domaines
├── routes/
│   ├── admin.js             # Routes administration
│   └── profile.js           # Routes profils publics
├── scripts/
│   └── init-db.js           # Initialisation BDD
├── views/
│   ├── admin/
│   │   ├── login.ejs        # Page de connexion
│   │   ├── dashboard.ejs    # Tableau de bord
│   │   └── card-form.ejs    # Formulaire carte
│   └── profile/
│       └── default.ejs      # Template profil
├── server.js                # Serveur principal
├── package.json
└── .env                     # Configuration
```

## 🗄️ Base de données

### Table `cards`
- `id`: ID auto-incrémenté
- `card_id`: UUID unique
- `subdomain`: Sous-domaine unique
- `name`: Nom complet
- `title`: Titre/profession
- `bio`: Biographie
- `photo_url`: URL photo de profil
- `snapchat`, `tiktok`, `whatsapp`, `linkedin`, `instagram`, `facebook`: Liens réseaux sociaux
- `template`: Template utilisé (default)
- `is_active`: Statut actif/inactif
- `created_at`, `updated_at`: Timestamps

### Table `admins`
- `id`: ID auto-incrémenté
- `username`: Nom d'utilisateur
- `password`: Mot de passe hashé (bcrypt)
- `created_at`: Date de création

## 🚀 Déploiement sur Vercel

### Configuration DNS
Pour utiliser les sous-domaines sur Vercel, configurez votre DNS :
- Ajoutez un enregistrement A pointant vers Vercel
- Ajoutez un enregistrement CNAME wildcard `*.votredomaine.com`

### Variables d'environnement Vercel
Dans le dashboard Vercel, ajoutez :
- `DB_HOST`: Hôte MySQL
- `DB_USER`: Utilisateur MySQL
- `DB_PASSWORD`: Mot de passe MySQL
- `DB_NAME`: Nom de la base
- `DB_PORT`: Port MySQL (3306)
- `SESSION_SECRET`: Clé secrète session
- `ADMIN_USERNAME`: Nom admin
- `ADMIN_PASSWORD`: Mot de passe admin
- `BASE_DOMAIN`: votredomaine.com

### Déploiement
```bash
# Installer Vercel CLI
npm i -g vercel

# Déployer
vercel
```

## 🔒 Sécurité

- Les mots de passe sont hashés avec bcrypt
- Sessions sécurisées avec express-session
- Protection CSRF recommandée pour la production
- Validation des entrées utilisateur
- Changez les identifiants admin par défaut !

## 🛠️ Développement

### Ajouter un nouveau réseau social
1. Ajouter le champ dans la table `cards` (migration SQL)
2. Ajouter le champ dans le formulaire (`views/admin/card-form.ejs`)
3. Ajouter le lien dans le template (`views/profile/default.ejs`)
4. Mettre à jour les routes admin (`routes/admin.js`)

### Personnaliser le template
Modifier `views/profile/default.ejs` pour changer l'apparence des profils.

## 📝 Notes importantes

### Sous-domaines en local
Pour tester les sous-domaines en local, modifiez votre fichier hosts :
```
# Linux/Mac: /etc/hosts
# Windows: C:\Windows\System32\drivers\etc\hosts

127.0.0.1 localhost
127.0.0.1 john-doe.localhost
127.0.0.1 jane-smith.localhost
```

Ou utilisez un outil comme `dnsmasq` pour gérer automatiquement les sous-domaines `*.localhost`.

### Base de données en production
Pour la production, utilisez un service MySQL managé :
- PlanetScale
- AWS RDS
- Digital Ocean Managed Databases
- Railway

## 🐛 Dépannage

### Erreur de connexion MySQL
- Vérifiez que MySQL est démarré
- Vérifiez les credentials dans `.env`
- Vérifiez que la base de données existe

### Les sous-domaines ne fonctionnent pas
- Vérifiez la configuration DNS
- En local, vérifiez le fichier hosts
- Vérifiez `BASE_DOMAIN` dans `.env`

### Erreur de session
- Vérifiez `SESSION_SECRET` dans `.env`
- Videz les cookies du navigateur

## 📄 Licence

MIT

## 👤 Support

Pour toute question ou problème, créez une issue sur le repository.
