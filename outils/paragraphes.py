#!/usr/bin/env python3
"""Regroupe les paragraphes courts d'une fiche quand c'est pertinent.

    python3 outils/paragraphes.py                    rapport sur toutes les fiches
    python3 outils/paragraphes.py FICHE.md           rapport sur une fiche
    python3 outils/paragraphes.py --appliquer FICHE  fusionne et réécrit la fiche

Un paragraphe de prose plus court que COURT caractères se fond dans son
voisin quand toutes les conditions de pertinence sont réunies. Le processus
est volontairement prudent : dans le doute, il ne touche à rien.

Conditions de pertinence pour fusionner deux paragraphes voisins :
- les deux sont de la prose ordinaire, séparés d'une seule ligne vide;
- les deux sont courts (moins de COURT caractères chacun);
- le résultat reste digeste (moins de MAX_FUSION caractères);
- aucun des deux n'appartient à une citation ouverte par « et fermée
  par » : les citations restent telles quelles, paragraphe par paragraphe;
- aucun des deux n'est une mention de source (Source ...);
- le premier ne se termine pas par un deux-points, qui annonce une liste.

Ne sont jamais touchés : titres, blocs :::, images, listes, tableaux,
lignes entièrement en gras (sous-titres) et l'en-tête YAML.
"""
from __future__ import annotations

import re
import sys
import textwrap
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
CONTENU = RACINE / "contenu"

COURT = 340        # environ trois lignes à la largeur de lecture du site
MAX_FUSION = 700   # au-delà, on ne fusionne plus : le pavé serait indigeste
LARGEUR = 78       # largeur de réécriture des paragraphes fusionnés

STRUCTURE = re.compile(
    r"^(#{1,6} |::: ?|!\[|[-*] |\d+\. |\||\*\*[^*]+\*\*$)")


def decouper(corps: str) -> list[dict]:
    """Découpe le corps en unités : prose, structure ou vide."""
    unites, courant = [], []
    en_bloc = False
    for ligne in corps.split("\n"):
        if ligne.strip().startswith(":::"):
            if courant:
                unites.append({"type": "p", "lignes": courant}); courant = []
            en_bloc = not en_bloc if ligne.strip() == ":::" else True
            if ligne.strip() == ":::":
                en_bloc = False
            unites.append({"type": "structure", "lignes": [ligne]})
            continue
        if en_bloc or STRUCTURE.match(ligne.strip()) and ligne.strip():
            if courant:
                unites.append({"type": "p", "lignes": courant}); courant = []
            unites.append({"type": "structure", "lignes": [ligne]})
            continue
        if not ligne.strip():
            if courant:
                unites.append({"type": "p", "lignes": courant}); courant = []
            unites.append({"type": "vide", "lignes": [ligne]})
            continue
        courant.append(ligne)
    if courant:
        unites.append({"type": "p", "lignes": courant})
    return unites


def annoter_citations(unites: list[dict]) -> None:
    """Marque les paragraphes appartenant à une citation « ... »."""
    profondeur = 0
    for u in unites:
        if u["type"] != "p":
            continue
        texte = " ".join(u["lignes"])
        avant = profondeur
        profondeur += texte.count("«") - texte.count("»")
        u["citation"] = avant > 0 or texte.count("«") > 0 or profondeur > 0


def texte_de(u: dict) -> str:
    return " ".join(l.strip() for l in u["lignes"]).strip()


def fusionnable(a: dict, b: dict) -> bool:
    ta, tb = texte_de(a), texte_de(b)
    if a.get("citation") or b.get("citation"):
        return False
    if ta.startswith("(Source") or tb.startswith("(Source"):
        return False
    if ta.endswith(":"):
        return False
    if len(ta) >= COURT and len(tb) >= COURT:
        return False  # au moins un des deux doit être court
    if len(ta) + len(tb) + 1 > MAX_FUSION:
        return False
    return True


def traiter(chemin: Path, appliquer: bool) -> int:
    brut = chemin.read_text(encoding="utf-8")
    if not brut.startswith("---"):
        return 0
    fin_entete = brut.index("---", 3) + 3
    entete, corps = brut[:fin_entete], brut[fin_entete:]

    unites = decouper(corps)
    annoter_citations(unites)

    fusions = 0
    i = 0
    while i < len(unites):
        if unites[i]["type"] != "p":
            i += 1
            continue
        j = i
        # absorbe les voisins tant que la pertinence est réunie
        while (j + 2 < len(unites) and unites[j + 1]["type"] == "vide"
               and unites[j + 2]["type"] == "p"
               and fusionnable(unites[i], unites[j + 2])):
            fusion = texte_de(unites[i]) + " " + texte_de(unites[j + 2])
            unites[i]["lignes"] = textwrap.wrap(
                fusion, LARGEUR, break_long_words=False,
                break_on_hyphens=False)
            unites[j + 2]["type"] = "retire"
            unites[j + 1]["type"] = "retire"
            fusions += 1
            if fusions and not appliquer:
                pass
            j += 2
        i = j + 1

    if fusions:
        apercu = [texte_de(u)[:60] for u in unites
                  if u["type"] == "p" and len(u["lignes"]) > 1][:3]
        print(f"    {chemin.relative_to(RACINE)} : {fusions} fusion(s)")
    if appliquer and fusions:
        morceaux = ["\n".join(u["lignes"]) for u in unites
                    if u["type"] != "retire"]
        nouveau = entete + "\n".join(morceaux)
        nouveau = re.sub(r"\n{3,}", "\n\n", nouveau)
        if not nouveau.endswith("\n"):
            nouveau += "\n"
        chemin.write_text(nouveau, encoding="utf-8")
    return fusions


def compter(chemin: Path) -> int:
    """Compte sans rien écrire ni imprimer, pour le vérificateur."""
    import contextlib, io
    with contextlib.redirect_stdout(io.StringIO()):
        return traiter(chemin, appliquer=False)


def main() -> int:
    args = [a for a in sys.argv[1:] if a != "--appliquer"]
    appliquer = "--appliquer" in sys.argv
    if args:
        cibles = [Path(a).resolve() for a in args]
    else:
        cibles = sorted(CONTENU.rglob("*.md"))
    total = 0
    print("PARAGRAPHES" + (" (application)" if appliquer else " (rapport)"))
    for chemin in cibles:
        total += traiter(chemin, appliquer)
    if not total:
        print("    ok   rien à regrouper")
    else:
        verbe = "faites" if appliquer else "possibles, relance avec --appliquer"
        print(f"\n{total} fusion(s) {verbe}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
