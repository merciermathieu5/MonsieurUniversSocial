#!/usr/bin/env python3
"""Prépare une livraison : un zip qui ne contient que ce qui a changé.

Une livraison complète pèse près de 300 Mo, dont 280 d'images qui sont déjà
dans le dépôt et que la dépose réécrit à l'identique. Cet outil compare l'arbre
de travail à la dernière révision publiée et n'emporte que les fichiers
nouveaux ou modifiés. En pratique, une livraison de fiche tient sous le mégaoctet.

    python outils/livrer.py 102              # zip mince, le cas normal
    python outils/livrer.py 102 --complet    # tout l'arbre, si tu repars de zéro
    python outils/livrer.py 102 --liste      # ne zippe rien, montre le contenu

Une décompression ajoute et remplace, elle n'efface jamais. Les fichiers
supprimés depuis la dernière révision ne peuvent donc pas voyager dans le zip :
ils sont listés dans SUPPRIMER.txt, à la racine de l'archive.
"""

import signal
import subprocess
import sys
import zipfile
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent

# Le registre des crédits vit sur la machine de l'enseignant : il survit aux
# déposes, sinon images.py retélécharge les mêmes images à chaque lancement.
EXCLUS = {
    "medias/credits.yml",
    "docs/medias/credits.yml",
}
PREFIXES_EXCLUS = (".git", "node_modules/", "docs/medias/credits")
NOMS_EXCLUS = (".DS_Store", "package.json", "package-lock.json")


def git(*args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(RACINE), *args],
        capture_output=True, text=True, check=True,
    ).stdout


def retenu(chemin: str) -> bool:
    if chemin in EXCLUS:
        return False
    if any(chemin.startswith(p) for p in PREFIXES_EXCLUS):
        return False
    if Path(chemin).name in NOMS_EXCLUS:
        return False
    if "/node_modules/" in chemin or chemin.endswith(".zip"):
        return False
    return True


def etat() -> tuple[list[str], list[str]]:
    """Retourne les fichiers à emporter et ceux qui ont été supprimés."""
    emportes: list[str] = []
    supprimes: list[str] = []
    for ligne in git("status", "--porcelain", "-z").split("\0"):
        if not ligne:
            continue
        code, chemin = ligne[:2], ligne[3:].strip('"')
        if "->" in chemin:                      # fichier renommé
            chemin = chemin.split("->")[-1].strip()
        if code in (" D", "D ", "DD"):
            supprimes.append(chemin)
            continue
        cible = RACINE / chemin
        if cible.is_dir():                      # dossier entier non suivi
            for f in sorted(cible.rglob("*")):
                if f.is_file():
                    emportes.append(f.relative_to(RACINE).as_posix())
        elif cible.is_file():
            emportes.append(chemin)
    return (sorted({c for c in emportes if retenu(c)}),
            sorted({c for c in supprimes if retenu(c)}))


def tout_l_arbre() -> list[str]:
    fichiers = [f.relative_to(RACINE).as_posix()
                for f in RACINE.rglob("*") if f.is_file()]
    return sorted(c for c in fichiers if retenu(c))


def main() -> int:
    args = sys.argv[1:]
    if not args or args[0].startswith("--"):
        print(__doc__)
        return 1
    numero = args[0]
    complet = "--complet" in args
    liste_seule = "--liste" in args

    if complet:
        emportes, supprimes = tout_l_arbre(), []
    else:
        emportes, supprimes = etat()

    if not emportes:
        print("Rien n'a changé depuis la dernière révision. Aucun zip produit.")
        return 0

    poids = sum((RACINE / c).stat().st_size for c in emportes)
    print(f"LIVRAISON {numero}" + ("  (arbre complet)" if complet else ""))
    print(f"    {len(emportes)} fichier(s), {poids / 1048576:.2f} Mo avant compression")
    for c in emportes[:40]:
        print(f"    + {c}")
    if len(emportes) > 40:
        print(f"    + ... et {len(emportes) - 40} autres")
    for c in supprimes:
        print(f"    - {c}  (à supprimer à la main)")

    if liste_seule:
        return 0

    sortie = RACINE.parent / f"MonsieurUniversSocial-{numero}.zip"
    with zipfile.ZipFile(sortie, "w", zipfile.ZIP_DEFLATED) as z:
        for c in emportes:
            z.write(RACINE / c, c)
        if supprimes:
            texte = (
                "Fichiers à supprimer à la main dans le dépôt.\n"
                "Une décompression ajoute et remplace, elle n'efface jamais.\n\n"
                + "\n".join(supprimes) + "\n"
            )
            z.writestr("SUPPRIMER.txt", texte)

    print(f"\n    {sortie.name} : {sortie.stat().st_size / 1048576:.2f} Mo")
    if supprimes:
        print(f"    SUPPRIMER.txt liste {len(supprimes)} fichier(s) à retirer à la main")
    return 0


if __name__ == "__main__":
    # Sans cela, rediriger la sortie vers `head` fait planter l'outil.
    if hasattr(signal, "SIGPIPE"):
        signal.signal(signal.SIGPIPE, signal.SIG_DFL)
    raise SystemExit(main())
