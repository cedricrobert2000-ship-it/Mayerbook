# 📘 Mayerbook

Application de suivi pour cours particuliers, du CM1 à la Terminale.

Chaque élève a **son propre espace**, avec un identifiant et un code donnés par le prof.
Chaque semaine, le prof y prépare :
- 💡 des **notions à revoir** : rappel de cours, fichiers, liens ;
- ✏️ des **exercices** : énoncé, **fichiers importés** (PDF, photos), et une correction type qui reste privée ;
- ❓ des **quiz** : QCM, vrai/faux, réponse courte.

Le prof peut tout faire **créer par l'IA de son choix** (Claude, ChatGPT…), **sans clé API ni coût en plus**.
Mayerbook prépare la demande adaptée à l'élève. Le prof la colle dans l'IA, joint un document s'il veut,
puis recolle la réponse : les exercices, le quiz ou les notions sont importés automatiquement.

## Le parcours

1. **Le prof** prépare la semaine, à la main ou en important ce que l'IA a créé, puis la **publie**.
2. **L'élève** se connecte, lit les notions, écrit ses réponses ou envoie une photo de sa feuille, fait les quiz,
   puis clique sur **Envoyer à mon prof**. Avant l'envoi, il ne voit **ni la correction ni les bonnes réponses**.
   Une fois son travail envoyé, il ne peut plus le modifier.
3. **Le prof** retrouve les copies dans **À corriger**. Il rédige une **correction détaillée**. S'il le souhaite, Mayerbook lui prépare
   une demande de correction à coller dans Claude ou ChatGPT, ajoute une note et peut joindre une photo annotée. Il peut aussi **renvoyer** le travail
   à l'élève pour qu'il le refasse.
4. **L'élève** reçoit sa correction et suit sa progression dans **Mon suivi** : avancement par matière,
   moyenne aux quiz, historique des semaines.

Pour les quiz, le prof choisit si le score s'affiche dès l'envoi ou seulement après sa validation.

## Essayer tout de suite (mode démo)

Sans configuration, l'application démarre en **mode démo** : les données restent dans le navigateur.

```bash
python3 -m http.server 8000
```

Ouvre ensuite http://localhost:8000. Comptes d'exemple : prof `prof@demo.fr` / `demo1234`, élèves `lea` / `1234` et `hugo` / `1234`.

## Mettre en ligne

Suis le guide pas à pas : **[INSTALLATION.md](INSTALLATION.md)**. Il faut un projet Supabase gratuit
et GitHub Pages.

## Sécurité

- Les réponses des quiz et les corrections types sont dans une table que **seul le prof** peut lire.
  Le score d'un quiz est calculé **sur le serveur**.
- Un élève ne voit que **ses** semaines publiées et **ses** copies. Il ne peut rien modifier après l'envoi.
- Les notes privées du prof sur un élève ne lui sont jamais visibles.

## Structure

```
index.html                    page unique
css/style.css                 styles (clair/sombre automatique, adapté au téléphone)
js/config.js                  adresse et clé publique Supabase (vide = mode démo)
js/api.js                     accès aux données : Supabase ou mode démo
js/tutor.js                   espace prof (élèves, semaines, éditeur, corrections)
js/ai.js                      demandes à copier dans Claude / ChatGPT et import des réponses
js/student.js                 espace élève (suivi, réponses, envoi)
js/app.js                     connexion, navigation, actions
js/demo.js                    données d'exemple du mode démo
supabase/schema.sql           tables, règles de sécurité, fonctions
supabase/functions/eleves     création des comptes élèves
```
