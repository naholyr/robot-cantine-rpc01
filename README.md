# robot-cantine-rpc01

Robot d'envoi hebdomadaire (avec option d'extraction quotidienne) du menu de la cantine du service rpc01

## Installation

```sh
npm i -g robot-cantine-rpc01
```

ATTENTION : **Node ≥ 6** requis

## Configuration

cf. sample.robotcantinerc:

```js
{
  // Save as .robotcantinerc
  "includeDayMenu": false,
  "filename": "[/tmp/menu-cantine-semaine-]w[.pdf]",
  "thumbname": "[/tmp/menu-cantine-jour-]DD/MM[.png]",
  "userAgent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.16 Safari/537.36",
  "mail": {
    "transport": "smtps://user%40gmail.com:password@smtp.gmail.com",
    "from": "user@gmail.com",
    "to": [
      // mailing list
    ],
    "subject": "[Menu cantine semaine du ]DD/MM",
    "text": "PDF ci-joint. Lien direct: {URL}"
  }
}
```

## Utilisation

```sh
robot-cantine-rpc01
```

Le robot sauvegarde l'état de dernier envoi dans `$HOME/.robotcantine.status.json`, ainsi le relancer plusieurs fois de suite n'a aucun effet si la précédente a fonctionné.
