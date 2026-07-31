#!/usr/bin/env python3
"""
Rapatrie tes propres images de l'ancien Google Site dans medias/.

    py outils\\rapatrier.py             télécharge ce qui manque
    py outils\\rapatrier.py --refaire   recommence tout

Les adresses viennent de medias/google.yml. Contrairement à images.py, il n'y a
ni recherche ni crédit à composer : ce sont tes documents, on les copie tels
quels. Relance py build.py une fois le rapatriement terminé.

Dépendances : pip install requests PyYAML
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

try:
    import requests
    import yaml
except ImportError:
    sys.exit("Lance d'abord : pip install requests PyYAML")

RACINE = Path(__file__).resolve().parent.parent
MEDIAS = RACINE / "medias"
REGISTRE = MEDIAS / "google.yml"
ENTETES = {"User-Agent": "Mozilla/5.0 (rapatriement muniverssocial)"}

SIGNATURES = {b"\x89PNG": "PNG", b"\xff\xd8\xff": "JPEG", b"GIF8": "GIF",
              b"RIFF": "WEBP"}


def telecharger(url: str) -> bytes:
    dernier = ""
    for tentative in range(3):
        if tentative:
            time.sleep(2 + 2 * tentative)
        try:
            reponse = requests.get(url, timeout=90, headers=ENTETES)
        except Exception as erreur:
            dernier = str(erreur)
            continue
        if reponse.status_code != 200:
            dernier = f"HTTP {reponse.status_code}"
            continue
        contenu = reponse.content
        if not any(contenu.startswith(s) for s in SIGNATURES):
            dernier = "la réponse n'est pas une image"
            continue
        if len(contenu) < 1024:
            dernier = f"{len(contenu)} octets seulement"
            continue
        return contenu
    raise ValueError(dernier or "cause inconnue")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--refaire", action="store_true")
    args = ap.parse_args()

    if not REGISTRE.exists():
        sys.exit("medias/google.yml est introuvable.")
    registre = yaml.safe_load(REGISTRE.read_text(encoding="utf-8")) or {}

    reussites = echecs = sautees = 0
    for nom, entree in registre.items():
        cible = MEDIAS / entree.get("fiche", "divers") / nom
        if cible.exists() and not args.refaire:
            sautees += 1
            continue
        url = (entree.get("url") or "").strip()
        if not url:
            print(f"  ECHEC  {nom} : aucune adresse dans google.yml")
            echecs += 1
            continue
        try:
            contenu = telecharger(url)
        except Exception as erreur:
            print(f"  ECHEC  {nom} : {erreur}")
            print("         Le Google Site limite parfois les accès. Réessaie, ou")
            print("         enregistre l'image depuis le navigateur directement dans")
            print(f"         medias/{entree.get('fiche', 'divers')}/{nom}")
            echecs += 1
            continue
        cible.parent.mkdir(parents=True, exist_ok=True)
        cible.write_bytes(contenu)
        genre = next(g for s, g in SIGNATURES.items() if contenu.startswith(s))
        print(f"  ok     {nom}  {genre}  {len(contenu) // 1024} ko")
        reussites += 1
        time.sleep(1)

    print(f"\n{reussites} rapatriées, {sautees} déjà là, {echecs} en échec.")
    print("Relance py build.py pour reconstruire le site.")


if __name__ == "__main__":
    main()
