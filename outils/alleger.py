#!/usr/bin/env python3
"""Allège les images du site sans changer leur nom ni leur format.

Le poids d'une page vient presque entièrement des images. Cet outil les
redimensionne à une largeur raisonnable et les réenregistre avec une
compression adaptée, ce qui divise le poids du site par un facteur important
sans perte visible au projecteur.

    python outils/alleger.py            # essai, n'écrit rien
    python outils/alleger.py --appliquer
    python outils/alleger.py --appliquer --largeur 2000 --qualite 88

Trois garde-fous :

- le nom et l'extension ne changent jamais, donc aucune référence ne casse,
  ni dans les fiches, ni dans le registre, ni dans credits.yml
- les cartes gardent une largeur plus grande, parce que leur texte doit rester
  lisible. Le registre sert à les repérer par leur cadrage
- un fichier n'est jamais remplacé par un résultat plus lourd que l'original
"""

import argparse
import io
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit("Pillow est requis : pip install pillow")

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None

RACINE = Path(__file__).resolve().parent.parent
MEDIAS = RACINE / "medias"
REGISTRE = MEDIAS / "sources.yml"

LARGEUR = 1400          # plus grand côté d'une photo
LARGEUR_CARTE = 2000    # les cartes gardent de quoi rester lisibles
QUALITE = 82
# Les PNG du site sont presque tous des cartes, des schémas ou des gravures.
# Les ramener à une palette de 256 couleurs les allège de trois à six fois sans
# que cela se voie, alors qu'un JPEG casserait les aplats et les traits fins.
# Le garde-fou reste le poids : si la palette ne fait pas gagner, on la jette.


def cadrages() -> dict:
    """Associe chaque nom de fichier à son cadrage, d'après le registre."""
    if yaml is None or not REGISTRE.exists():
        return {}
    donnees = yaml.safe_load(REGISTRE.read_text(encoding="utf-8")) or {}
    return {nom: (v or {}).get("cadrage", "") for nom, v in donnees.items()}


def alleger(chemin: Path, largeur_max: int, qualite: int = QUALITE,
            args_sans_palette: bool = False) -> bytes | None:
    """Retourne les octets allégés, ou None si l'original reste le meilleur."""
    original = chemin.read_bytes()
    try:
        im = Image.open(io.BytesIO(original))
        im.load()
    except Exception:
        return None

    anime = getattr(im, "n_frames", 1) > 1
    if anime:
        return None  # une image animée se réencode mal, on n'y touche pas

    # On borne le plus grand côté, sinon une image en hauteur passe au travers
    # du redimensionnement tout en pesant aussi lourd qu'une image en largeur.
    cote = max(im.width, im.height)
    if cote > largeur_max:
        facteur = largeur_max / cote
        im = im.resize((round(im.width * facteur), round(im.height * facteur)),
                       Image.LANCZOS)

    suffixe = chemin.suffix.lower()
    candidats = []

    if suffixe in (".jpg", ".jpeg"):
        tampon = io.BytesIO()
        im.convert("RGB").save(tampon, "JPEG", quality=qualite,
                               optimize=True, progressive=True)
        candidats.append(tampon.getvalue())
    elif suffixe == ".png":
        transparence = im.mode in ("RGBA", "LA", "P") and (
            "transparency" in im.info or im.mode in ("RGBA", "LA"))
        tampon = io.BytesIO()
        im.save(tampon, "PNG", optimize=True)
        candidats.append(tampon.getvalue())
        if not args_sans_palette:
            reduit = io.BytesIO()
            # quantize n'accepte que RGB ou RGBA, pas les modes P et LA.
            source = im.convert("RGBA" if transparence else "RGB")
            source.quantize(colors=256, method=Image.FASTOCTREE).save(
                reduit, "PNG", optimize=True)
            candidats.append(reduit.getvalue())
    else:
        return None

    meilleur = min(candidats, key=len)
    # Une image déjà bien compressée ne gagne rien à être réécrite.
    return meilleur if len(meilleur) < len(original) * 0.95 else None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--appliquer", action="store_true",
                    help="écrit les fichiers, sinon simple essai")
    ap.add_argument("--qualite", type=int, default=QUALITE,
                    help=f"qualité JPEG (défaut {QUALITE})")
    ap.add_argument("--sans-palette", action="store_true",
                    help="ne réduit pas les PNG à 256 couleurs")
    ap.add_argument("--largeur", type=int, default=LARGEUR,
                    help=f"plus grand côté des photos (défaut {LARGEUR})")
    args = ap.parse_args()

    cadre = cadrages()
    fichiers = sorted(f for f in MEDIAS.rglob("*")
                      if f.is_file() and f.suffix.lower() in
                      (".jpg", ".jpeg", ".png"))

    print("ALLÈGEMENT" + ("" if args.appliquer else " (essai, rien n'est écrit)"))
    avant = apres = 0
    touches = []
    for f in fichiers:
        poids = f.stat().st_size
        avant += poids
        largeur = LARGEUR_CARTE if cadre.get(f.name) == "carte" else args.largeur
        octets = alleger(f, largeur, args.qualite, args.sans_palette)
        if octets is None:
            apres += poids
            continue
        apres += len(octets)
        touches.append((f, poids, len(octets)))
        if args.appliquer:
            f.write_bytes(octets)

    for f, a, b in sorted(touches, key=lambda t: t[1] - t[2], reverse=True)[:15]:
        print("    %-44s %7.2f Mo → %6.0f Ko  (%.0f fois)"
              % (f.relative_to(MEDIAS), a / 1048576, b / 1024, a / b))
    if len(touches) > 15:
        print(f"    ... et {len(touches) - 15} autres")

    print(f"\n    {len(touches)} image(s) allégée(s) sur {len(fichiers)}")
    print(f"    {avant / 1048576:.1f} Mo → {apres / 1048576:.1f} Mo"
          f"   ({avant / max(apres, 1):.1f} fois moins)")
    if not args.appliquer:
        print("\n    Relance avec --appliquer pour écrire.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
