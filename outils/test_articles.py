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

print("\nRÉSUMÉ DES FILS")
FIL_RESUME = b"""<?xml version="1.0"?><rss version="2.0"><channel><title>R</title>
<item><title>Une eglise se refait une jeunesse</title>
<link>https://exemple.ca/nouvelle/3</link>
<description><![CDATA[<p>Des ma&ccedil;ons restaurent ses deux <b>clochers</b>.</p>]]></description>
</item></channel></rss>"""
lot = articles.extraire_entrees(FIL_RESUME, "Essai")
verdict("le résumé est lu, sans balises ni entités",
        lot and lot[0]["resume"] == "Des maçons restaurent ses deux clochers.",
        repr(lot and lot[0]["resume"]))

print("\nCLASSEMENT")
LEX = {
    "exclure": ["meurtre"],
    "rubriques_exclues": ["transports en direct"],
    "geographie": {
        "03": {"nom": "Patrimoine", "forts": ["clocher", "patrimoine"],
               "faibles": ["eglise"], "pieges": ["patrimoine familial"]},
        "05": {"nom": "Tourisme", "forts": ["tourisme", "croisiere"],
               "faibles": ["plage"]},
        "09": {"nom": "Industrie", "forts": ["acier", "stelco"],
               "faibles": ["usine", "tarif"]},
        "12": {"nom": "Autochtone", "forts": ["autochtone"], "faibles": []},
    },
}
r = articles.classer("Une eglise se refait une jeunesse", LEX,
                     "Des maçons restaurent ses deux clochers.")
verdict("un fort du résumé confirmé par un faible du titre suffit",
        r and r[0][1] == "03" and r[0][4] == 0, str(r))
r = articles.classer("Une belle journee a Quebec", LEX, "Les clochers sonnent.")
verdict("le résumé ne décide jamais seul", r == [], str(r))
r = articles.classer("Le tourisme repart", LEX, "Un meurtre en marge du festival.")
verdict("le veto lit aussi le résumé", r and r[0][0] == "veto", str(r))
r = articles.classer("Transports en direct | Le tourisme bloque l'autoroute", LEX)
verdict("une rubrique exclue est écartée par son chapeau",
        r and r[0][0] == "veto", str(r))
r = articles.classer("Le partage du patrimoine familial devant la cour", LEX)
verdict("un piège retire le territoire", r == [], str(r))
r = articles.classer("Les autochtones et l'acier", LEX)
verdict("à égalité, le territoire nommé en premier l'emporte",
        r and r[0][1] == "12", str(r))
r = articles.classer("Stelco : l'acierie de Hamilton", LEX)
verdict("les forts s'additionnent", r and r[0][0] == 2 and r[0][1] == "09",
        str(r))

print("\nAPPRENTISSAGE")
LEX["apprentissage"] = {"minimum": 5, "taux": 0.15}
registre = [{"fiche": "05", "titre": f"Le tourisme, chronique {i}",
             "garder": "N"} for i in range(5)]
retro = articles.retrogradations(LEX, registre)
verdict("cinq refus sans un O rétrogradent le terme", ("05", "tourisme") in retro,
        str(retro))
r = articles.classer("Le tourisme en hausse", LEX, "", retro)
verdict("un terme rétrogradé ne décide plus seul", r == [], str(r))
r = articles.classer("Le tourisme de croisière en hausse", LEX, "", retro)
verdict("il compte encore comme faible, à côté d'un fort",
        r and r[0][0] == 3 and r[0][4] == 1, str(r))
registre.append({"fiche": "05", "titre": "Le tourisme sauve Percé",
                 "garder": "O"})
verdict("un O dans le lot suffit à le garder fort (1 sur 6)",
        ("05", "tourisme") not in articles.retrogradations(LEX, registre))

LEX["apprentissage"] = {"minimum": 50, "taux": 0.15, "jours_recents": 14,
                        "minimum_recent": 3, "taux_recent": 0.25}
serie = [{"fiche": "09", "titre": f"Grève chez Stelco, jour {i}",
          "garder": "N", "date": f"2026-10-0{i}"} for i in range(1, 4)]
serie.append({"fiche": "09", "titre": "Stelco et l'acier canadien",
              "garder": "O", "date": "2026-08-01"})
verdict("un sujet refusé trois fois en deux semaines est rétrogradé",
        ("09", "stelco") in articles.retrogradations(LEX, serie,
                                                     avant="2026-10-05"))
verdict("l'effet s'éteint quand les refus sortent de la fenêtre",
        ("09", "stelco") not in articles.retrogradations(LEX, serie,
                                                         avant="2026-11-01"))

print("\nDOUBLONS")
deja = [(articles.mots_du_titre("Indonésie : des milliers d'évacués en attente "
                                "d'aide après le puissant séisme"), "2026-09-01")]
m = articles.mots_du_titre("Indonésie: des milliers d’évacués en attente d’aide "
                           "après le puissant séisme")
verdict("la même dépêche chez un autre média est reconnue",
        articles.doublon(m, "2026-09-02", deja))
verdict("pas au-delà de trois jours", not articles.doublon(m, "2026-09-09", deja))
m = articles.mots_du_titre("Séisme en Indonésie | Le bilan grimpe à 40 morts")
verdict("une suite de la nouvelle n'est pas un doublon",
        not articles.doublon(m, "2026-09-02", deja))

print("\nLEXIQUE RÉEL, CAS TIRÉS DU REGISTRE")
import yaml
REEL = yaml.safe_load(articles.LEXIQUE.read_text(encoding="utf-8"))
for titre, attendu in [
    ("Mine et usine d’explosifs : une menace pour le tourisme à la baie des "
     "Chaleurs?", "05"),
    ("Pour sa « survie » face aux tarifs américains, l'aciérie licencie", "09"),
    ("Usine de batteries Volkswagen en Ontario : l’ouverture reportée", "09"),
    ("ArcelorMittal à Contrecoeur : les Métallos en faveur de l’entente; fin de "
     "la grève", None),
    ("Les jeunes impressionnent chez les Remparts", None),
    ("Les agriculteurs ontariens demandent de l’aide", "10"),
    ("Cri du cœur pour sauver le patrimoine religieux de Québec", "03"),
    ("Autoroute 15: la voie réservée fermée pour quatre jours", None),
    ("Crise de l’itinérance : les coûts continuent d’exploser", None),
    ("L’affaire Thélyson Orélien, un séisme pour le monde de l’édition?", None),
    ("Vieux-Port de Montréal | Une « privatisation » dénoncée", None),
]:
    r = articles.classer(titre, REEL)
    obtenu = r[0][1] if r and r[0][0] != "veto" else None
    verdict(f"{titre[:55]} -> {attendu}", obtenu == attendu, str(obtenu))

rates = VERDICTS.count(False)
print(f"\n{len(VERDICTS)} vérification(s), {rates} raté(s)")
sys.exit(1 if rates else 0)
