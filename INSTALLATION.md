# Installer Mayerbook en ligne (≈ 20 minutes)

Sans configuration, Mayerbook fonctionne en **mode démo** : tout reste dans le navigateur.
Pour que tes élèves aient leur propre compte et retrouvent leur travail sur n'importe quel appareil,
suis ces étapes une seule fois.

Il te faut :
- un compte **Supabase** (gratuit) : base de données, comptes, fichiers ;
- une clé **API Claude** (payante à l'usage) pour l'IA ;
- le site publié sur **GitHub Pages** (gratuit).

---

## 1. Créer le projet Supabase

1. Va sur https://supabase.com, crée un compte, puis **New project**.
2. Nom : `mayerbook`. Choisis un mot de passe de base de données (garde-le de côté).
   Région : **West EU (Paris)** ou **Central EU (Frankfurt)**.
3. Attends 1 à 2 minutes que le projet soit prêt.

## 2. Créer la base de données

1. Menu de gauche : **SQL Editor**, puis **New query**.
2. Ouvre le fichier [`supabase/schema.sql`](supabase/schema.sql) de ce dépôt, copie **tout** son contenu et colle-le.
3. Clique sur **Run**. Tu dois voir « Success ».

## 3. Installer les deux fonctions serveur

Menu **Edge Functions**, puis **Deploy a new function** et **Via Editor** :

| Nom de la fonction (exactement) | Fichier à copier-coller |
|---|---|
| `eleves` | [`supabase/functions/eleves/index.ts`](supabase/functions/eleves/index.ts) |
| `ia` | [`supabase/functions/ia/index.ts`](supabase/functions/ia/index.ts) |

Pour chacune : remplace tout le code d'exemple par celui du fichier, donne le nom indiqué, puis **Deploy function**.

> Avec la ligne de commande Supabase, c'est aussi possible : `supabase functions deploy eleves` et `supabase functions deploy ia`.

## 4. Ajouter la clé de l'IA

1. Sur https://console.anthropic.com : crée un compte, ajoute quelques euros de crédit
   (**Billing**), puis **API Keys** et **Create Key**. Copie la clé (`sk-ant-…`).
2. Dans Supabase, menu **Edge Functions**, onglet **Secrets** :
   ajoute un secret nommé `ANTHROPIC_API_KEY` avec ta clé comme valeur.

La clé reste sur le serveur : ni les élèves ni le navigateur ne la voient jamais.
Coût indicatif : quelques centimes par génération d'exercices, de quiz ou de proposition de correction.

## 5. Brancher le site sur Supabase

1. Dans Supabase, ouvre **Project Settings**, puis **API**. Copie :
   - **Project URL** (ex : `https://abcd1234.supabase.co`) ;
   - la clé **anon / publishable** (⚠️ **pas** la clé `service_role` ni la clé `secret`).
2. Sur GitHub, ouvre le fichier [`js/config.js`](js/config.js), clique sur ✏️ (Edit), puis remplis :
   ```js
   window.MAYERBOOK_CONFIG = {
     supabaseUrl: 'https://abcd1234.supabase.co',
     supabaseAnonKey: 'eyJhbGciOi...'
   };
   ```
3. Clique sur **Commit changes**.

## 6. Publier le site (GitHub Pages)

1. Sur GitHub : **Settings**, puis **Pages**.
2. *Source* : **Deploy from a branch**, branche `main`, dossier `/ (root)`, puis **Save**.
3. Après 1 à 2 minutes, le site est disponible sur `https://<ton-compte>.github.io/Mayerbook/`.
4. Dans Supabase : **Authentication**, puis **URL Configuration**. Mets cette adresse dans **Site URL**.

## 7. Créer ton compte prof

1. Ouvre le site, onglet **👩‍🏫 Prof**, saisis ton e-mail et un mot de passe,
   puis clique sur **Première utilisation ? Créer le compte prof**.
   (Si Supabase demande de confirmer l'adresse, clique sur le lien reçu par e-mail puis connecte-toi.)
2. **Important, pour la sécurité :** dans Supabase, ouvre **Authentication**, puis **Sign In / Providers**
   (ou **Settings**), et désactive **Allow new users to sign up**.
   Personne d'autre ne pourra créer de compte ; c'est toi qui crées ceux de tes élèves depuis l'application.

C'est prêt 🎉 Crée tes élèves : Mayerbook te donne leur **identifiant** et leur **code** à leur transmettre.

---

## En cas de problème

| Symptôme | Solution |
|---|---|
| « Ce compte n'a pas accès à l'espace prof » | Un autre compte prof existe déjà. Dans Supabase (**Table Editor**, table `tutors`), supprime la ligne en trop. |
| Création d'élève : « Failed to send a request to the Edge Function » | La fonction `eleves` n'est pas déployée ou mal nommée (étape 3). |
| « La clé API Claude n'est pas configurée » | Ajoute le secret `ANTHROPIC_API_KEY` (étape 4). |
| « Clé API Claude invalide » | Recrée une clé sur console.anthropic.com et remplace le secret. |
| Le site reste en mode démo | Vérifie `js/config.js` (étape 5) puis recharge la page (Ctrl+F5). |
