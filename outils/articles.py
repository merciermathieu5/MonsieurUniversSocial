#!/usr/bin/env python3
"""
Tient le registre des articles d'actualité et remplit la page tout seul.

    python outils\\articles.py --chercher    lit les fils, propose, contrôle les liens
    python outils\\articles.py               écrit les articles validés dans la page
    python outils\\articles.py --diagnostic  montre les rejets et pourquoi

Même principe que outils\\images.py : tu écris en clair dans un registre, le
script fait toute la mécanique. Ici le registre est contenu\\articles.yml.

    - adresse: "https://..."
      fiche: "06"
      media: "La Presse"
      date: "2026-08-05"
      apercu: "Le titre du média, pour ton jugement seulement"
      note: ""            <- ta phrase. Tant qu'elle est vide, rien n'est publié.

--chercher ajoute des propositions avec une note vide. Tu écris une phrase pour
celles que tu gardes, tu effaces les lignes des autres. Le passage suivant les
publie. Effacer une entrée déjà publiée la retire de la page.

Pourquoi la note n'est pas remplie automatiquement : le seul texte disponible
serait le titre du média, et Radio-Canada comme La Presse réservent leurs fils
à l'usage personnel. Une phrase de toi dit en plus à l'élève pourquoi cet
article se rattache à ce territoire, ce qu'un titre ne fait jamais.

Dépendances : pip install PyYAML
"""
from __future__ import annotations

import argparse
import email.utils
import html
import re
import sys
import unicodedata
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("Lance d'abord : pip install PyYAML")

RACINE = Path(__file__).resolve().parent.parent
LEXIQUE = RACINE / "outils" / "lexique_actualite.yml"
REGISTRE = RACINE / "contenu" / "articles.yml"
COMPOSANT = RACINE / "theme" / "composants" / "actualite.html"

ENTETES = {
    "User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) "
                   "Chrome/124.0 Safari/537.36"),
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
}

EN_TETE_REGISTRE = """\
# Registre des articles d'actualité de la page Actualité.
#
# Rempli par outils/articles.py --chercher, publié par outils/articles.py.
#
# Une entrée n'est publiée que si sa note est écrite. La note est TA phrase :
# elle dit à l'élève pourquoi cet article éclaire ce territoire. Le champ
# apercu contient le titre du média, pour ton jugement seulement, et n'est
# jamais publié.
#
# Pour refuser une proposition, efface son entrée. Elle ne reviendra pas.
# Pour retirer un article publié, efface son entrée.
#
# Les liens morts et les articles périmés sont retirés automatiquement au
# passage suivant de --chercher.
"""


def aplatir(texte: str) -> str:
    sans = unicodedata.normalize("NFD", texte or "")
    sans = "".join(c for c in sans if unicodedata.category(c) != "Mn")
    return " ".join(sans.lower().replace("'", " ").replace("\u2019", " ").split())


def contient(terme: str, texte: str) -> bool:
    """Cherche un terme en tolérant le pluriel sur chacun de ses mots."""
    mots = [re.escape(m) for m in aplatir(terme).split()]
    return re.search(r"\b" + r"s?\s+".join(mots) + r"s?\b", texte) is not None


def clef(adresse: str) -> str:
    """L'adresse dépouillée de ses paramètres, pour reconnaître un doublon."""
    return adresse.split("?")[0].rstrip("/")


def lire_fil(nom: str, adresse: str) -> tuple[list[dict], str]:
    requete = urllib.request.Request(adresse, headers=ENTETES)
    try:
        with urllib.request.urlopen(requete, timeout=20) as reponse:
            brut = reponse.read()
    except urllib.error.HTTPError as erreur:
        raison = ("refus de robot, le fil est probablement vivant"
                  if erreur.code in (403, 429) else "fil introuvable")
        return [], f"{erreur.code}, {raison}"
    except Exception as erreur:
        return [], f"injoignable, {type(erreur).__name__}"
    try:
        racine = ET.fromstring(brut)
    except ET.ParseError:
        return [], "réponse illisible, ce n'est pas du XML"

    entrees = []
    for item in racine.iter():
        if not item.tag.endswith("item") and not item.tag.endswith("entry"):
            continue
        titre = lien = quand = ""
        for enfant in item:
            balise = enfant.tag.rsplit("}", 1)[-1]
            if balise == "title":
                titre = (enfant.text or "").strip()
            elif balise == "link":
                lien = (enfant.text or enfant.get("href") or "").strip()
            elif balise in ("pubDate", "published", "updated"):
                quand = (enfant.text or "").strip()
        if titre and lien:
            entrees.append({"titre": titre, "lien": lien, "date": quand,
                            "source": nom})
    return entrees, ""


def en_iso(date_rss: str) -> str:
    try:
        return email.utils.parsedate_to_datetime(date_rss).strftime("%Y-%m-%d")
    except Exception:
        return date.today().isoformat()


def media_de(source: str) -> str:
    return source.split(" · ")[0].split(",")[0].strip()


def classer(titre: str, lexique: dict) -> list[tuple]:
    """Territoires candidats, du mieux noté au moins bon. Veto en premier."""
    plat = aplatir(titre)
    for veto in lexique.get("exclure", []):
        if contient(veto, plat):
            return [("veto", veto)]
    resultats = []
    for numero, regles in (lexique.get("geographie") or {}).items():
        forts = [m for m in regles.get("forts", []) if contient(m, plat)]
        faibles = [m for m in regles.get("faibles", []) if contient(m, plat)]
        if not forts:
            continue
        note = 2 * len(forts) + len(faibles)
        if note >= 2:
            resultats.append((note, numero, regles["nom"], forts + faibles,
                              len(forts)))
    resultats.sort(key=lambda r: (-r[0], -r[4], r[1]))
    return resultats


def charger_registre() -> list[dict]:
    if not REGISTRE.exists():
        return []
    donnees = yaml.safe_load(REGISTRE.read_text(encoding="utf-8")) or {}
    return donnees.get("articles") or []


def ecrire_registre(articles: list[dict]) -> None:
    """Écrit le registre à la main pour garder l'en-tête et un diff lisible."""
    def guillemets(valeur: str) -> str:
        return '"' + str(valeur or "").replace("\\", "\\\\").replace('"', '\\"') + '"'

    lignes = [EN_TETE_REGISTRE, "articles:"]
    for a in sorted(articles, key=lambda x: (x.get("date", ""), x.get("fiche", "")),
                    reverse=True):
        lignes.append(f"  - adresse: {guillemets(a['adresse'])}")
        lignes.append(f"    fiche: {guillemets(a['fiche'])}")
        lignes.append(f"    media: {guillemets(a.get('media', ''))}")
        lignes.append(f"    date: {guillemets(a.get('date', ''))}")
        lignes.append(f"    apercu: {guillemets(a.get('apercu', ''))}")
        lignes.append(f"    note: {guillemets(a.get('note', ''))}")
        if a.get("echecs"):
            lignes.append(f"    echecs: {a['echecs']}")
        lignes.append("")
    REGISTRE.write_text("\n".join(lignes).rstrip() + "\n", encoding="utf-8")


def controler_lien(adresse: str) -> str:
    """Retourne « vivant », « mort », ou une raison de ne pas trancher.

    Un refus de robot ou une panne ne prouvent rien : seuls un 404 ou un 410
    confirment la disparition, et encore, il en faut deux à des passages
    différents avant de retirer quoi que ce soit.
    """
    requete = urllib.request.Request(adresse, headers=ENTETES, method="GET")
    try:
        with urllib.request.urlopen(requete, timeout=20) as reponse:
            finale = reponse.geturl()
            # Une refonte de section redirige souvent vers une racine avec un
            # beau code 200 : l'article n'existe plus pour autant.
            if len(finale.split("?")[0].rstrip("/").split("/")) <= 4:
                return "mort"
            return "vivant"
    except urllib.error.HTTPError as erreur:
        if erreur.code in (404, 410):
            return "mort"
        return f"{erreur.code}, non concluant"
    except Exception as erreur:
        return f"{type(erreur).__name__}, non concluant"


def chercher(lexique: dict, registre: list[dict], jours: int) -> list[dict]:
    fils = lexique.get("fils") or {}
    entrees, muets = [], []
    for nom, adresse in fils.items():
        lot, note = lire_fil(nom, adresse)
        entrees.extend(lot)
        if note:
            muets.append((nom, note))

    print(f"\n{len(entrees)} articles lus dans {len(fils) - len(muets)} fils")
    if muets:
        print("\nFILS SANS RÉPONSE")
        for nom, note in muets:
            print(f"    {nom} : {note}")

    connus = {clef(a["adresse"]) for a in registre}
    vus, ajoutes, vetos = set(), 0, 0
    for entree in entrees:
        cle = clef(entree["lien"])
        if cle in connus or cle in vus:
            continue
        vus.add(cle)
        candidats = classer(entree["titre"], lexique)
        if not candidats:
            continue
        if candidats[0][0] == "veto":
            vetos += 1
            continue
        _, numero, nom, _, _ = candidats[0]
        registre.append({
            "adresse": entree["lien"], "fiche": numero,
            "media": media_de(entree["source"]),
            "date": en_iso(entree["date"]),
            "apercu": entree["titre"], "note": "",
        })
        ajoutes += 1
    print(f"\n{ajoutes} proposition(s) ajoutée(s), {vetos} écartée(s) par le veto")

    # Contrôle des liens et péremption, puisqu'on est déjà en ligne.
    limite = (datetime.now() - timedelta(days=jours)).strftime("%Y-%m-%d")
    gardes, retires = [], []
    for a in registre:
        if a.get("date", "") and a["date"] < limite:
            retires.append((a, f"périmé, plus de {jours} jours"))
            continue
        etat = controler_lien(a["adresse"])
        if etat == "mort":
            a["echecs"] = a.get("echecs", 0) + 1
            if a["echecs"] >= 2:
                retires.append((a, "lien mort, confirmé deux fois"))
                continue
            print(f"    lien suspect, à reconfirmer : {a['apercu'][:60]}")
        elif etat == "vivant":
            a.pop("echecs", None)
        else:
            print(f"    non concluant, gardé : {etat} · {a['apercu'][:50]}")
        gardes.append(a)
    for a, raison in retires:
        print(f"    retiré ({raison}) : {a['apercu'][:60]}")
    if retires:
        print(f"\n{len(retires)} article(s) retiré(s)")
    return gardes


def publier(lexique: dict, registre: list[dict]) -> int:
    noms = {n: r["nom"] for n, r in (lexique.get("geographie") or {}).items()}
    prets = [a for a in registre if (a.get("note") or "").strip()]
    prets.sort(key=lambda a: a.get("date", ""), reverse=True)

    lignes = []
    for a in prets:
        nom = noms.get(a["fiche"], "")
        if not nom:
            print(f"    ignoré, fiche {a['fiche']} inconnue : {a['apercu'][:50]}")
            continue
        lignes.append(
            f'    <li data-fiche="{html.escape(a["fiche"])}" '
            f'data-source="{html.escape(a.get("media", ""))}" '
            f'data-date="{html.escape(a.get("date", ""))}" '
            f'data-note="{html.escape(a["note"].strip(), quote=True)}">'
            f'<a href="{html.escape(a["adresse"])}">{html.escape(nom)}</a></li>')

    texte = COMPOSANT.read_text(encoding="utf-8")
    motif = re.compile(r'(<ul data-matiere="geographie">).*?(</ul>)', re.S)
    if not motif.search(texte):
        sys.exit("Le composant actualite.html n'a pas sa liste attendue.")
    corps = ("\n" + "\n".join(lignes)) if lignes else ""
    COMPOSANT.write_text(
        motif.sub(lambda m: m.group(1) + corps + "\n  " + m.group(2), texte),
        encoding="utf-8")

    attente = len(registre) - len(prets)
    print(f"\n{len(lignes)} article(s) publié(s) dans la page")
    if attente:
        print(f"{attente} en attente de ta phrase dans contenu/articles.yml")
    return 0


def diagnostic(lexique: dict) -> int:
    fils = lexique.get("fils") or {}
    entrees = []
    for nom, adresse in fils.items():
        lot, _ = lire_fil(nom, adresse)
        entrees.extend(lot)
    print(f"\n{len(entrees)} articles lus\n")
    print("Un article sans terme fort est écarté. Les termes faibles touchés\n"
          "sont montrés : s'ils reviennent souvent, il manque un terme fort.\n")
    for entree in entrees:
        candidats = classer(entree["titre"], lexique)
        if candidats and candidats[0][0] == "veto":
            print(f"    {entree['titre'][:88]}")
            print(f"        VETO sur « {candidats[0][1]} »")
        elif not candidats:
            plat = aplatir(entree["titre"])
            faibles = [f"{n}:{m}" for n, r in (lexique.get("geographie") or {}).items()
                       for m in r.get("faibles", []) if contient(m, plat)]
            print(f"    {entree['titre'][:88]}")
            if faibles:
                print(f"        faibles touchés : {', '.join(faibles[:6])}")
    return 0


def main() -> int:
    a = argparse.ArgumentParser()
    a.add_argument("--chercher", action="store_true",
                   help="lit les fils, propose, contrôle les liens")
    a.add_argument("--diagnostic", action="store_true",
                   help="montre les rejets et pourquoi")
    a.add_argument("--jours", type=int, default=365,
                   help="âge maximal d'un article, en jours")
    arguments = a.parse_args()

    lexique = yaml.safe_load(LEXIQUE.read_text(encoding="utf-8"))
    if arguments.diagnostic:
        return diagnostic(lexique)

    registre = charger_registre()
    if arguments.chercher:
        registre = chercher(lexique, registre, arguments.jours)
        ecrire_registre(registre)
        print(f"\nRegistre écrit : {REGISTRE.relative_to(RACINE)}")
    return publier(lexique, registre)


if __name__ == "__main__":
    sys.exit(main())
