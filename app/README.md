# Élémento Defense · application Android

Le jeu (dossier parent) est embarqué dans l'APK avec [Capacitor](https://capacitorjs.com) : il marche sans internet et le multijoueur local par QR code fonctionne.

## Outils (une fois)

- Java 21 : `brew install openjdk@21`
- SDK Android dans `~/Library/Android/sdk` (platform-tools, platforms;android-36, build-tools;36.0.0)
- `cd app && npm install`

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=$HOME/Library/Android/sdk
```

## Construire

- `npm run apk` : APK signé à installer à la main → `android/app/build/outputs/apk/release/app-release.apk`
- `npm run aab` : bundle pour Google Play → `android/app/build/outputs/bundle/release/app-release.aab`

Le numéro de version de l'app est `BUILD` dans `js/data.js` (à augmenter avec `CACHE` dans `sw.js` à chaque mise en ligne).

## Signature

La clé est hors du dépôt : `~/.android-keystores/elemento-release.jks` et ses mots de passe dans `~/.android-keystores/elemento.properties`.
**À sauvegarder** (gestionnaire de mots de passe, clé USB…) : sans elle, impossible de publier une mise à jour de l'app.
