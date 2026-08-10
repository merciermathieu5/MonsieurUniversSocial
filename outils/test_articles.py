#!/usr/bin/env python3
"""Banc d'essai de la lecture des fils, sans toucher au réseau.

    python outils\\test_articles.py

Chaque réponse est servie depuis un annuaire local : fil sain, 404, refus
de robot, page qui annonce son fil, page qui n'annonce rien. Le banc vérifie
que lire_fil choisit la bonne adresse, poursuit le fil annoncé par une page
et rend des raisons lisibles quand tout se tait.
"""
from __future__ import annotations

import io
import sys
import urllib.error
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import articles

FIL_XML = b"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Essai</title>
<item><title>Un seisme secoue la cote</title>
<link>https://exemple.ca/nouvelle/1</link>
<pubDate>Mon, 03 Aug 2026 10:00:00 GMT</pubDate></item>
<item><title>La foret boreale sous la loupe</title>
<link>https://exemple.ca/nouvelle/2</link>
<pubDate>Tue, 04 Aug 2026 09:00:00 GMT</pubDate></item>
</channel></rss>"""

FIL_VIDE = b"""<?xml version="1.0"?><rss version="2.0"><channel>
<title>Rien</title></channel></rss>"""

PAGE_AVEC_FIL = b"""<!doctype html><html><head>
<link rel="alternate" type="application/rss+xml" title="Science"
      href="/rss/4165">
<script>var ailleurs = "https://ici.exemple.ca/rss/999";</script>
</head><body>Page de section</body></html>"""

PAGE_SANS_FIL = b"""<!doctype html><html><head><title>Muette</title>
</head><body>Aucun fil annonce ici</body></html>"""

# L'annuaire des réponses. Une adresse absente vaut un 404, comme en vrai.
REPONSES = {
    "https://ici.exemple.ca/rss/4159": FIL_XML,
    "https://ici.exemple.ca/rss/4165": FIL_XML,
    "https://ici.exemple.ca/rss/vide": FIL_VIDE,
    "https://ici.exemple.ca/science": PAGE_AVEC_FIL,
    "https://ici.exemple.ca/muette": PAGE_SANS_FIL,
}
ROBOT = "https://ici.exemple.ca/garde-barriere"


class FausseReponse:
    def __init__(self, brut: bytes):
        self.brut = brut

    def read(self) -> bytes:
        return self.brut

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


def faux_urlopen(requete, timeout=0):
    adresse = requete.full_url
    if adresse == ROBOT:
        raise urllib.error.HTTPError(adresse, 403, "Forbidden", None,
                                     io.BytesIO(b""))
    if adresse not in REPONSES:
        raise urllib.error.HTTPError(adresse, 404, "Not Found", None,
                                     io.BytesIO(b""))
    return FausseReponse(REPONSES[adresse])


articles.urllib.request.urlopen = faux_urlopen

VERDICTS = []


def verdict(nom: str, reussi: bool, detail: str = "") -> None:
    VERDICTS.append(reussi)
    print(f"    {'ok  ' if reussi else 'RATE'} {nom}"
          + (f" : {detail}" if detail and not reussi else ""))


print("LECTURE DIRECTE")
lot, note, retenue = articles.lire_fil("Essai", "https://ici.exemple.ca/rss/4159")
verdict("un fil sain livre ses articles", len(lot) == 2 and note == "", note)
verdict("l'adresse retenue est celle du lexique",
        retenue == "https://ici.exemple.ca/rss/4159", retenue)

print("\nCANDIDATES EN LISTE")
lot, note, retenue = articles.lire_fil("Essai", [
    "https://ici.exemple.ca/rss/absent",
    "https://ici.exemple.ca/rss/4159",
])
verdict("la deuxième candidate prend le relais du 404", len(lot) == 2, note)
verdict("l'adresse retenue est la deuxième",
        retenue == "https://ici.exemple.ca/rss/4159", retenue)

print("\nPAGE QUI ANNONCE SON FIL")
lot, note, retenue = articles.lire_fil("Essai", ["https://ici.exemple.ca/science"])
verdict("le fil annoncé par la page est suivi", len(lot) == 2, note)
verdict("l'adresse retenue est celle du fil, pas de la page",
        retenue == "https://ici.exemple.ca/rss/4165", retenue)

annonces = articles.decouvrir_fils(PAGE_AVEC_FIL, "https://ici.exemple.ca/science")
verdict("la balise link passe avant l'adresse semée dans le code",
        annonces[:2] == ["https://ici.exemple.ca/rss/4165",
                         "https://ici.exemple.ca/rss/999"], str(annonces))

print("\nSILENCES EXPLIQUÉS")
lot, note, retenue = articles.lire_fil("Essai", ROBOT)
verdict("un 403 est nommé refus de robot",
        not lot and "refus de robot" in note, note)
lot, note, retenue = articles.lire_fil("Essai", ["https://ici.exemple.ca/muette"])
verdict("une page sans fil annoncé le dit clairement",
        not lot and "n'en annonce aucun" in note, note)
lot, note, retenue = articles.lire_fil("Essai", ["https://ici.exemple.ca/rss/vide"])
verdict("un fil sans article est dit vide", not lot and "vide" in note, note)
lot, note, retenue = articles.lire_fil("Essai", "https://ici.exemple.ca/rss/absent")
verdict("un 404 garde sa raison d'origine",
        not lot and "fil introuvable" in note, note)

print("\nFORMES DU LEXIQUE")
verdict("une adresse seule devient une liste d'une candidate",
        articles.candidats_de("https://a.ca") == ["https://a.ca"])
verdict("une liste passe telle quelle, sans les vides",
        articles.candidats_de(["https://a.ca", "", "https://b.ca"])
        == ["https://a.ca", "https://b.ca"])

rates = VERDICTS.count(False)
print(f"\n{len(VERDICTS)} vérification(s), {rates} raté(s)")
sys.exit(1 if rates else 0)
