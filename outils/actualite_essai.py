#!/usr/bin/env python3
"""Éprouve le lexique d'actualité contre les fils de Radio-Canada et de La Presse.

Géographie seulement. L'histoire a été retirée après essai : un mot-clé ne sait
pas lire une date, et rangeait des articles à quatre siècles de leur fiche.

Cet outil ne touche à rien. Il lit les fils, applique le lexique, et imprime ce
qu'il proposerait. Aucune écriture dans contenu/, dans theme/ ni dans docs/.
Son seul but est de répondre à une question : le lexique se remplit-il, et de
quel côté.

Usage :
    python outils/actualite_essai.py                 # lit les fils en ligne
    python outils/actualite_essai.py --local dossier # lit des .xml enregistrés
    python outils/actualite_essai.py --tout          # montre aussi les rejets

Si un fil répond 403, c'est une détection de robots, pas une absence d'articles.
L'outil le dit franchement plutôt que de compter zéro.
"""
import argparse
import email.utils
import re
import sys
import unicodedata
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

import yaml

RACINE = Path(__file__).resolve().parent.parent
LEXIQUE = RACINE / "outils" / "lexique_actualite.yml"

# Un fil de presse refuse les requêtes qui n'ont pas l'air d'un navigateur.
ENTETES = {
    "User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) "
                   "Chrome/124.0 Safari/537.36"),
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
}

# Les fils vivent dans le lexique, pas ici : ajouter une adresse ne doit pas
# demander de toucher au code. Cette liste ne sert que si la clé manque.
FILS_PAR_DEFAUT = {
    "La Presse · actualités": "https://www.lapresse.ca/actualites/rss",
}


def aplatir(texte: str) -> str:
    """Minuscules, sans accents : le lexique s'écrit ainsi, les titres non."""
    sans = unicodedata.normalize("NFD", texte or "")
    sans = "".join(c for c in sans if unicodedata.category(c) != "Mn")
    return " ".join(sans.lower().replace("'", " ").replace("’", " ").split())


def contient(terme: str, texte: str) -> bool:
    """Cherche un terme en tolérant le pluriel sur chacun de ses mots.

    Le lexique s'écrit au singulier, les titres de presse sont au pluriel :
    « coupe forestiere » doit attraper « coupes forestieres », sinon il faut
    écrire chaque forme à la main et la liste devient impossible à tenir.
    """
    mots = [re.escape(m) for m in aplatir(terme).split()]
    motif = r"\b" + r"s?\s+".join(mots) + r"s?\b"
    return re.search(motif, texte) is not None


def lire_fil(nom: str, adresse: str) -> tuple[list[dict], str]:
    """Retourne les entrées d'un fil, et une note si le fil n'a pas répondu."""
    requete = urllib.request.Request(adresse, headers=ENTETES)
    try:
        with urllib.request.urlopen(requete, timeout=20) as reponse:
            brut = reponse.read()
    except urllib.error.HTTPError as erreur:
        raison = ("refus de robot, le fil est probablement vivant"
                  if erreur.code in (403, 429) else "fil introuvable")
        return [], f"{erreur.code}, {raison}"
    except Exception as erreur:  # réseau, délai, certificat
        return [], f"injoignable, {type(erreur).__name__}"
    try:
        racine = ET.fromstring(brut)
    except ET.ParseError:
        return [], "réponse illisible, ce n'est pas du XML"

    entrees = []
    for item in racine.iter():
        if not item.tag.endswith("item") and not item.tag.endswith("entry"):
            continue
        titre = lien = date = ""
        for enfant in item:
            balise = enfant.tag.rsplit("}", 1)[-1]
            if balise == "title":
                titre = (enfant.text or "").strip()
            elif balise == "link":
                lien = (enfant.text or enfant.get("href") or "").strip()
            elif balise in ("pubDate", "published", "updated"):
                date = (enfant.text or "").strip()
        if titre and lien:
            entrees.append({"titre": titre, "lien": lien, "date": date,
                            "source": nom})
    return entrees, ""


def indices(titre: str, lexique: dict) -> list[str]:
    """Les termes faibles touchés par un titre écarté, pour régler le lexique."""
    plat = aplatir(titre)
    trouves = []
    for numero, regles in (lexique.get("geographie") or {}).items():
        for mot in regles.get("faibles", []):
            if contient(mot, plat):
                trouves.append(f"{numero}:{mot}")
    return trouves


def en_iso(date_rss: str) -> str:
    """Date RSS vers AAAA-MM-JJ, la seule forme qui se trie et se compare."""
    try:
        return email.utils.parsedate_to_datetime(date_rss).strftime("%Y-%m-%d")
    except Exception:
        return ""


def media_de(source: str) -> str:
    """Le nom du média, sans la section : « La Presse · voyage » donne « La Presse »."""
    return source.split(" · ")[0].split(",")[0].strip()


def dedoublonner(entrees: list[dict]) -> list[dict]:
    """Un même article paraît dans plusieurs fils : on n'en garde qu'un.

    La comparaison se fait sur l'adresse sans ses paramètres, parce que les
    fils ajoutent souvent un marqueur de provenance qui change à chaque fil.
    Les sources sont fusionnées pour qu'on voie d'où l'article venait.
    """
    vus = {}
    for entree in entrees:
        cle = entree["lien"].split("?")[0].rstrip("/")
        if cle in vus:
            if entree["source"] not in vus[cle]["source"]:
                vus[cle]["source"] += f", {entree['source']}"
            continue
        vus[cle] = dict(entree)
    return list(vus.values())


def classer(titre: str, lexique: dict) -> list[tuple]:
    """Retourne les fiches candidates, de la mieux notée à la moins bonne."""
    plat = aplatir(titre)
    for veto in lexique.get("exclure", []):
        if contient(veto, plat):
            return [("veto", veto)]

    resultats = []
    for matiere in ("geographie",):
        for numero, regles in (lexique.get(matiere) or {}).items():
            forts = [m for m in regles.get("forts", []) if contient(m, plat)]
            faibles = [m for m in regles.get("faibles", []) if contient(m, plat)]
            if not forts:
                continue  # un terme faible seul ne décide de rien
            note = 2 * len(forts) + len(faibles)
            if note >= 2:
                resultats.append((note, matiere, numero, regles["nom"],
                                  forts + faibles, len(forts)))
    resultats.sort(key=lambda r: (-r[0], -r[5], r[2]))
    return [r[:5] for r in resultats]


def main() -> int:
    analyseur = argparse.ArgumentParser()
    analyseur.add_argument("--local", help="dossier de fichiers .xml enregistrés")
    analyseur.add_argument("--tout", action="store_true",
                           help="montre aussi les articles écartés")
    analyseur.add_argument("--proposer", action="store_true",
                           help="imprime les lignes prêtes pour le composant")
    analyseur.add_argument("--rapport", metavar="FICHIER",
                           help="écrit tout dans un fichier texte, rejets compris")
    arguments = analyseur.parse_args()

    lexique = yaml.safe_load(LEXIQUE.read_text(encoding="utf-8"))
    journal = []
    sortie_ecran = print

    def imprimer(*morceaux):
        texte = " ".join(str(m) for m in morceaux)
        journal.append(texte)
        sortie_ecran(texte)
    fils = lexique.get("fils") or FILS_PAR_DEFAUT

    entrees, muets = [], []
    if arguments.local:
        for chemin in sorted(Path(arguments.local).glob("*.xml")):
            lot, note = lire_fil(chemin.stem, chemin.as_uri())
            entrees.extend(lot)
            if note:
                muets.append((chemin.stem, note))
    else:
        for nom, adresse in fils.items():
            lot, note = lire_fil(nom, adresse)
            entrees.extend(lot)
            if note:
                muets.append((nom, note))

    bruts = len(entrees)
    entrees = dedoublonner(entrees)
    imprimer(f"\n{bruts} articles lus, {bruts - len(entrees)} doublons retirés, dans "
          f"{len(fils) - len(muets) if not arguments.local else '?'} fils")
    if muets:
        imprimer("\nFILS SANS RÉPONSE")
        for nom, note in muets:
            imprimer(f"    {nom} : {note}")

    retenus, ecartes = {}, []
    for entree in entrees:
        candidats = classer(entree["titre"], lexique)
        if candidats and candidats[0][0] == "veto":
            ecartes.append((entree, [f"VETO sur « {candidats[0][1]} »"]))
            continue
        if candidats:
            note, matiere, numero, nom, mots = candidats[0]
            cle = (matiere, numero, nom)
            retenus.setdefault(cle, []).append((note, entree, mots))
        else:
            ecartes.append((entree, indices(entree["titre"], lexique)))

    for matiere in ("geographie",):
        fiches = (lexique.get(matiere) or {})
        vides = []
        imprimer(f"\n{matiere.upper()}")
        for numero in sorted(fiches):
            cle = (matiere, numero, fiches[numero]["nom"])
            lot = sorted(retenus.get(cle, []), key=lambda t: -t[0])
            if not lot:
                vides.append(numero)
                continue
            imprimer(f"\n  {numero} · {fiches[numero]['nom']}  ({len(lot)})")
            for note, entree, mots in lot:
                imprimer(f"      [{note}] {entree['titre'][:88]}")
                imprimer(f"          {entree['source']} · {', '.join(mots[:3])}")
        if vides:
            imprimer(f"\n  sans aucun article : {', '.join(vides)}")

    total = sum(len(v) for v in retenus.values())
    imprimer(f"\n{total} articles proposés, {len(ecartes)} écartés, "
          f"{len(retenus)} fiches touchées")
    if arguments.tout:
        imprimer("\nÉCARTÉS")
        imprimer("Un article sans aucun terme fort est écarté. Les termes faibles\n"
              "qu'il touchait sont montrés : s'ils reviennent souvent sur le même\n"
              "genre d'article, c'est qu'il en manque un fort.\n")
        for entree, faibles in ecartes[:60]:
            imprimer(f"    {entree['titre'][:92]}")
            if faibles:
                imprimer(f"        faibles touchés : {', '.join(faibles[:6])}")

    if arguments.proposer:
        # Le titre de presse ne va PAS dans la page. Les fils des deux maisons
        # sont réservés à l'usage personnel, et une phrase de toi dit mieux à
        # l'élève pourquoi l'article est là. La mention reste donc à écrire.
        imprimer("\nLIGNES À COMPLÉTER puis à coller dans "
                 "theme/composants/actualite.html")
        imprimer("Remplace À DÉCRIRE par ta phrase. Le titre de presse est là "
              "pour ton jugement seulement, il ne doit pas être recopié.\n")
        for (matiere, numero, nom), lot in sorted(retenus.items()):
            for note, entree, mots in sorted(lot, key=lambda t: -t[0]):
                imprimer(f"    # {entree['source']} · {entree['titre'][:80]}")
                imprimer(f'    <li data-fiche="{numero}" '
                         f'data-source="{media_de(entree["source"])}" '
                         f'data-date="{en_iso(entree["date"])}" '
                         f'data-note="À DÉCRIRE"><a href="{entree["lien"]}">'
                         f'{nom}</a></li>')
        imprimer("\nAucune ligne ne doit partir avec « À DÉCRIRE ».")
    if arguments.rapport:
        Path(arguments.rapport).write_text("\n".join(journal), encoding="utf-8")
        sortie_ecran(f"\nRapport écrit dans {arguments.rapport}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
