# 📘 Mayerbook

Application web de suivi pour cours particuliers (du CM1 à la Terminale).

Chaque semaine, le prof prépare pour chaque élève :
- 💡 des **notions à revoir** (rappel de cours, lien vers une vidéo ou une fiche) ;
- ✏️ des **exercices** (énoncé + correction affichable ou non) ;
- ❓ des **quiz** (QCM, vrai/faux, réponse courte), corrigés automatiquement.

L'élève reçoit un **lien personnel**, coche ce qu'il a compris ou fait, répond aux quiz,
puis renvoie ses **résultats** au prof en un clic.

## Fonctionnement

| Côté prof | Côté élève |
|---|---|
| Fiches élèves (classe, matières, contact, notes privées) | Page « Mon travail de la semaine » |
| Une page par semaine : notions, exercices, quiz | « J'ai compris », « J'ai fait cet exercice » |
| Bouton **Obtenir le lien** → WhatsApp, e-mail, copie | Quiz avec score et corrections |
| **Importer les résultats** envoyés par l'élève | Progression enregistrée sur son appareil |
| **Préparer la semaine suivante** en reprenant ce qui n'est pas acquis | Bouton **Envoyer à mon prof** |

### Sans serveur ni compte

- Les données du prof sont enregistrées **dans son navigateur** (localStorage).
  Utilise **Exporter une sauvegarde** régulièrement, et pour changer d'ordinateur.
- Le contenu de la semaine est compressé **dans le lien** envoyé à l'élève (après le `#`,
  donc jamais envoyé à un serveur). Même principe pour le lien de résultats.
- Si tu modifies une semaine déjà envoyée, renvoie un nouveau lien : la progression de l'élève est conservée.

## Lancer l'application

Aucune installation : ce sont des fichiers HTML/CSS/JS.

En local :

```bash
python3 -m http.server 8000
```

puis ouvrir http://localhost:8000.

### Mettre en ligne gratuitement (GitHub Pages)

1. Sur GitHub : **Settings → Pages**.
2. *Source* : **Deploy from a branch**, branche `main`, dossier `/ (root)`.
3. L'application sera disponible sur `https://<ton-compte>.github.io/Mayerbook/`.

## Structure

```
index.html        page unique
css/style.css     styles (thème clair/sombre automatique, mobile)
js/utils.js       constantes (classes, matières) et utilitaires
js/store.js       données du prof (localStorage), calcul de progression
js/share.js       création et lecture des liens élève / résultats
js/tutor.js       écrans du prof
js/student.js     écran de l'élève
js/demo.js        élèves d'exemple
js/app.js         navigation et actions
```
