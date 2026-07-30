#!/usr/bin/env python3
"""
Récupère les illustrations sur Wikimedia Commons et compose leurs crédits.

    python outils\\images.py                 récupère ce qui manque
    python outils\\images.py --verifier      contrôle les fichiers déjà là
    python outils\\images.py --refaire       recommence tout
    python outils\\images.py --chercher "neolithic sickle"

Tu n'as pas à connaître le nom exact d'un fichier sur Commons. Écris une
recherche en clair dans medias/sources.yml et le script trouve le fichier,
le télécharge et note l'auteur, le titre et la licence.

    poterie.jpg:
      fiche: 01-sedentarisation
      recherche: "neolithic pottery vessel museum"

Le nom exact retenu est réinscrit dans le registre, pour que la construction
soit reproductible. Si tu veux imposer un fichier précis, remplis toi-même le
champ commons et le script s'y tiendra.

Dépendances : pip install requests PyYAML
"""
from __future__ import annotations

import argparse
import html
import re
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
REGISTRE = MEDIAS / "sources.yml"
API = "https://commons.wikimedia.org/w/api.php"
ENTETES = {"User-Agent": "MonsieurUniversSocial/1.0 (site pedagogique quebecois)"}

# Noms de licence tels qu'ils doivent apparaître sous les images.
LICENCES = {
    "cc-by-sa-4.0": "Creative Commons BY-SA 4.0",
    "cc by-sa 4.0": "Creative Commons BY-SA 4.0",
    "cc-by-sa-3.0": "Creative Commons BY-SA 3.0",
    "cc by-sa 3.0": "Creative Commons BY-SA 3.0",
    "cc-by-sa-2.5": "Creative Commons BY-SA 2.5",
    "cc-by-sa-2.0": "Creative Commons BY-SA 2.0",
    "cc by-sa 2.0": "Creative Commons BY-SA 2.0",
    "cc-by-4.0": "Creative Commons BY 4.0",
    "cc by 4.0": "Creative Commons BY 4.0",
    "cc-by-3.0": "Creative Commons BY 3.0",
    "cc by 3.0": "Creative Commons BY 3.0",
    "cc-by-2.0": "Creative Commons BY 2.0",
    "cc by 2.0": "Creative Commons BY 2.0",
    "cc0": "Creative Commons Zero",
    "pd": "Domaine public",
    "public domain": "Domaine public",
    "pd-old": "Domaine public",
    "pd-art": "Domaine public",
    "pd-us": "Domaine public",
}

SIGNATURES = {
    b"\x89PNG": "PNG", b"\xff\xd8\xff": "JPEG", b"GIF8": "GIF", b"RIFF": "WEBP",
}


def nettoyer(valeur: str) -> str:
    """Les métadonnées de Commons arrivent en HTML, on garde le texte."""
    if not valeur:
        return ""
    texte = re.sub(r"<[^>]+>", " ", valeur)
    return " ".join(html.unescape(texte).split())


def joli_titre(titre_fichier: str) -> str:
    """« File:Or de Varna - Nécropole.jpg » devient « Or de Varna - Nécropole »."""
    nom = re.sub(r"^(File|Fichier|Image):", "", titre_fichier)
    nom = re.sub(r"\.[A-Za-z]{3,4}$", "", nom)
    return nom.replace("_", " ").strip()


def lisible(licence_brute: str) -> str:
    brut = nettoyer(licence_brute)
    return LICENCES.get(brut.lower(), brut or "voir la page source")


# ------------------------------------------------------------------- Commons

def interroger(titre: str, largeur: int) -> dict | None:
    reponse = requests.get(API, timeout=30, headers=ENTETES, params={
        "action": "query", "format": "json", "titles": titre,
        "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata",
        "iiurlwidth": largeur,
    })
    reponse.raise_for_status()
    for page in reponse.json().get("query", {}).get("pages", {}).values():
        if "missing" in page or not page.get("imageinfo"):
            return None
        info = page["imageinfo"][0]
        meta = info.get("extmetadata", {})
        return {
            "commons": page.get("title", titre),
            "vignette": info.get("thumburl"),
            "original": info["url"],
            "mime": info.get("mime", ""),
            "poids": info.get("size", 0),
            "auteur": nettoyer(meta.get("Artist", {}).get("value", "")) or "Auteur inconnu",
            "licence": lisible(meta.get("LicenseShortName", {}).get("value")
                               or meta.get("License", {}).get("value") or ""),
            "lien": info.get("descriptionurl", ""),
        }
    return None


def chercher(termes: str, limite: int = 8) -> list[str]:
    """Renvoie les noms exacts des fichiers correspondant à une recherche."""
    reponse = requests.get(API, timeout=30, headers=ENTETES, params={
        "action": "query", "format": "json", "list": "search",
        "srsearch": f"filetype:bitmap {termes}", "srnamespace": 6, "srlimit": limite,
    })
    reponse.raise_for_status()
    return [e["title"] for e in reponse.json().get("query", {}).get("search", [])]


def resoudre(entree: dict, largeur: int) -> dict | None:
    """Trouve le fichier : par son nom exact, sinon par la recherche en clair."""
    titre = (entree.get("commons") or "").strip()
    if titre:
        try:
            trouve = interroger(titre, largeur)
        except Exception:
            trouve = None
        if trouve:
            return trouve
        print(f"         nom inexact, on cherche : {titre}")

    termes = (entree.get("recherche") or "").strip()
    if not termes and titre:
        termes = re.sub(r"[,\-_\d]+", " ", joli_titre(titre)).strip()
    if not termes:
        return None

    for candidat in chercher(termes):
        try:
            trouve = interroger(candidat, largeur)
        except Exception:
            continue
        # On refuse ce qui n'est pas une photographie ou une carte exploitable.
        if trouve and trouve["mime"] in ("image/jpeg", "image/png"):
            print(f"         retenu : {candidat}")
            return trouve
        time.sleep(.3)
    return None


# ---------------------------------------------------------- téléchargement

def essayer(url: str) -> bytes:
    dernier = ""
    for tentative in range(3):
        if tentative:
            time.sleep(2 + 3 * tentative)
        try:
            reponse = requests.get(url, timeout=90, headers=ENTETES)
        except Exception as erreur:
            dernier = str(erreur)
            continue
        if reponse.status_code != 200:
            dernier = f"HTTP {reponse.status_code}"
            continue
        if not reponse.headers.get("Content-Type", "").startswith("image/"):
            dernier = "réponse qui n'est pas une image"
            continue
        if len(reponse.content) < 2048:
            dernier = f"{len(reponse.content)} octets seulement"
            continue
        return reponse.content
    raise ValueError(dernier or "cause inconnue")


def recuperer(trouve: dict, titre: str, largeurs: list[int]) -> bytes:
    """Vignette d'abord, puis largeurs de repli, puis le fichier d'origine."""
    soucis = []
    for largeur in largeurs:
        info = interroger(titre, largeur) if largeur != largeurs[0] else trouve
        if not info or not info.get("vignette"):
            continue
        try:
            return essayer(info["vignette"])
        except Exception as erreur:
            soucis.append(f"{largeur}px : {erreur}")
        time.sleep(1)
    if trouve.get("poids", 0) <= 12_000_000:
        try:
            return essayer(trouve["original"])
        except Exception as erreur:
            soucis.append(f"original : {erreur}")
    else:
        soucis.append("original trop lourd")
    raise ValueError(" ; ".join(soucis))


# -------------------------------------------------------------- vérification

def verifier() -> None:
    registre = yaml.safe_load(REGISTRE.read_text(encoding="utf-8")) or {}
    bons = mauvais = absents = 0
    for nom, entree in registre.items():
        cible = MEDIAS / entree.get("fiche", "divers") / nom
        if not cible.exists():
            print(f"  ABSENT   {nom}")
            absents += 1
            continue
        debut = cible.read_bytes()[:4]
        genre = next((g for s, g in SIGNATURES.items() if debut.startswith(s)), None)
        taille = cible.stat().st_size // 1024
        manque = [c for c in ("auteur", "licence", "lien") if not entree.get(c)]
        if genre and not manque:
            print(f"  ok       {nom}  {genre}  {taille} ko")
            bons += 1
        elif genre:
            print(f"  CREDIT   {nom}  il manque : {', '.join(manque)}")
            mauvais += 1
        else:
            print(f"  CORROMPU {nom}  {taille} ko")
            mauvais += 1
    print(f"\n{bons} valides, {mauvais} à revoir, {absents} absentes.")


# --------------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--refaire", action="store_true")
    ap.add_argument("--verifier", action="store_true")
    ap.add_argument("--chercher", metavar="TERMES")
    ap.add_argument("--largeur", type=int, default=1400)
    args = ap.parse_args()

    if not REGISTRE.exists():
        sys.exit("medias/sources.yml est introuvable.")

    if args.verifier:
        verifier()
        return

    if args.chercher:
        print(f"Fichiers trouvés pour « {args.chercher} » :\n")
        for titre in chercher(args.chercher, 10):
            info = interroger(titre, 320)
            if info:
                print(f"  {titre}\n      {info['auteur']} · {info['licence']}\n")
        return

    registre = yaml.safe_load(REGISTRE.read_text(encoding="utf-8")) or {}
    reussites = echecs = sautees = 0

    for nom, entree in registre.items():
        dossier = MEDIAS / entree.get("fiche", "divers")
        cible = dossier / nom
        if cible.exists() and entree.get("licence") and not args.refaire:
            sautees += 1
            continue

        trouve = None
        try:
            trouve = resoudre(entree, args.largeur)
        except Exception as erreur:
            print(f"  ECHEC  {nom} : {erreur}")

        if not trouve:
            print(f"  ECHEC  {nom} : rien trouvé sur Commons")
            print(f"         précise le champ recherche dans medias/sources.yml")
            echecs += 1
            continue

        if not cible.exists() or args.refaire:
            try:
                donnees = recuperer(trouve, trouve["commons"], [args.largeur, 1024, 800])
                dossier.mkdir(parents=True, exist_ok=True)
                cible.write_bytes(donnees)
            except Exception as erreur:
                print(f"  ECHEC  {nom} : {erreur}")
                echecs += 1
                continue
            time.sleep(1)

        entree["commons"] = trouve["commons"]
        entree["titre"] = entree.get("titre") or joli_titre(trouve["commons"])
        entree["auteur"] = trouve["auteur"]
        entree["licence"] = trouve["licence"]
        entree["lien"] = trouve["lien"]
        print(f"  ok     {nom}  {cible.stat().st_size // 1024} ko  {trouve['licence']}")
        reussites += 1

    REGISTRE.write_text(
        yaml.safe_dump(registre, allow_unicode=True, sort_keys=False, width=100),
        encoding="utf-8")

    print(f"\n{reussites} traitées, {sautees} déjà complètes, {echecs} en échec.")
    print("Relance python build.py pour reconstruire le site.")


if __name__ == "__main__":
    main()
