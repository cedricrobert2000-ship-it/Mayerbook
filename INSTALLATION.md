# Installer Mayerbook en ligne (≈ 20 minutes)

Sans configuration, Mayerbook fonctionne en **mode démo** : tout reste dans le navigateur.
Pour que tes élèves aient leur propre compte et retrouvent leur travail sur n'importe quel appareil,
suis ces étapes une seule fois.

Il te faut :
- un compte **Supabase** (gratuit) : base de données, comptes, fichiers ;
- le site publié sur **GitHub Pages** (gratuit).

L'IA (Claude, ChatGPT…) s'utilise depuis ton propre compte, par copier-coller : rien à configurer, aucun coût en plus.

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

## 3. Installer la fonction de création des comptes élèves

Menu **Edge Functions**, puis **Deploy a new function** et **Via Editor** :
1. Nomme la fonction exactement `eleves`.
2. Remplace tout le code d'exemple par le contenu de [`supabase/functions/eleves/index.ts`](supabase/functions/eleves/index.ts).
3. Clique sur **Deploy function**.

> Avec la ligne de commande Supabase, c'est aussi possible : `supabase functions deploy eleves`.

## 4. Brancher le site sur Supabase

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

## 5. Publier le site (GitHub Pages)

1. Sur GitHub : **Settings**, puis **Pages**.
2. *Source* : **Deploy from a branch**, branche `main`, dossier `/ (root)`, puis **Save**.
3. Après 1 à 2 minutes, le site est disponible sur `https://<ton-compte>.github.io/Mayerbook/`.
4. Dans Supabase : **Authentication**, puis **URL Configuration**. Mets cette adresse dans **Site URL**.

## 6. Créer ton compte prof

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
| L'import depuis l'IA échoue | Copie bien toute la réponse de l'IA (le bloc qui commence par `{`). Au besoin, redemande-lui de répondre « uniquement avec le JSON ». |
| Le site reste en mode démo | Vérifie `js/config.js` (étape 4) puis recharge la page (Ctrl+F5). |
