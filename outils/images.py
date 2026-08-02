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
import shutil
import unicodedata
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
CREDITS = MEDIAS / "credits.yml"
API = "https://commons.wikimedia.org/w/api.php"
ENTETES = {"User-Agent": "MonsieurUniversSocial/1.0 (site pedagogique quebecois)"}
# lh3.googleusercontent.com sert les images aux navigateurs mais renvoie 403
# aux agents inconnus. Pour les adresses directes du registre, on se présente
# comme ce que la requête est vraiment : un chargement d'image de navigateur.
ENTETES_NAVIGATEUR = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"),
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Sec-Fetch-Dest": "image",
    "Sec-Fetch-Mode": "no-cors",
    "Sec-Fetch-Site": "cross-site",
    "Referer": "https://sites.google.com/",
}

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
    donnees = reponse.json()
    if "error" in donnees:
        raise ValueError(f"API Commons : {donnees['error'].get('info', 'erreur inconnue')}")
    for page in donnees.get("query", {}).get("pages", {}).values():
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


def _chercher_une(requete: str, limite: int) -> list[str]:
    reponse = requests.get(API, timeout=30, headers=ENTETES, params={
        "action": "query", "format": "json", "list": "search",
        "srsearch": requete, "srnamespace": 6, "srlimit": limite,
    })
    reponse.raise_for_status()
    return [e["title"] for e in reponse.json().get("query", {}).get("search", [])]


def chercher(termes: str, limite: int = 8, bavard: bool = False) -> list[str]:
    """Cherche sur Commons, avec plusieurs formulations de repli.

    filetype:bitmap écarte les SVG, or sur Commons les cartes sont presque
    toutes en SVG. On tente donc du plus restrictif au plus large.
    """
    tentatives = [
        f"filetype:bitmap|drawing {termes}",
        termes,
        " ".join(termes.split()[:3]),
    ]
    vus, resultat = set(), []
    for requete in tentatives:
        try:
            trouves = _chercher_une(requete, limite)
        except Exception as erreur:
            if bavard:
                print(f"           requête « {requete[:40]} » : {erreur}")
            continue
        if bavard:
            print(f"           « {requete[:46]} » -> {len(trouves)} résultat(s)")
        for t in trouves:
            if t not in vus:
                vus.add(t)
                resultat.append(t)
        if len(resultat) >= limite:
            break
    return resultat[:limite]


EXPLOITABLES = ("image/jpeg", "image/png", "image/svg+xml", "image/webp", "image/tiff")


def resoudre(entree: dict, largeur: int, bavard: bool = False) -> dict | None:
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

    candidats = chercher(termes, 8, bavard)
    if bavard:
        print(f"           {len(candidats)} candidat(s) : "
              + ", ".join(c.replace("File:", "")[:28] for c in candidats[:4]))
    for candidat in candidats:
        try:
            trouve = interroger(candidat, largeur)
        except Exception:
            continue
        # Les SVG sont acceptés : Commons en fabrique une vignette PNG,
        # c'est elle qu'on récupère. On refuse seulement ce qui n'est pas
        # une image fixe exploitable.
        if trouve and trouve["mime"] in EXPLOITABLES:
            if trouve["mime"] == "image/svg+xml" and not trouve.get("vignette"):
                continue
            print(f"         retenu : {candidat}")
            return trouve
        if trouve and bavard:
            print(f"           écarté ({trouve['mime']}) : {candidat}")
        time.sleep(.3)
    if bavard:
        print(f"           aucun des {len(candidats)} candidats n'est exploitable")
    return None


def _simplifier(texte: str) -> str:
    """Nom de fichier ramené à ses lettres et chiffres, sans accent ni casse."""
    sans_accent = "".join(
        c for c in unicodedata.normalize("NFD", texte)
        if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]", "", sans_accent.lower())


def depot_manuel(nom: str, entree: dict, credit: dict) -> Path | None:
    """Image enregistrée à la main dans Téléchargements ou à la racine.

    On accepte aussi bien le nom local du registre (cabral.jpg) que le nom du
    fichier sur Commons, avec ou sans accents, espaces ou tirets bas : ce que
    le navigateur propose spontanément quand on enregistre une image.
    """
    extension = Path(nom).suffix.lower()
    cibles = {_simplifier(Path(nom).stem)}
    for source in (entree.get("commons"), credit.get("commons")):
        if source:
            cibles.add(_simplifier(Path(source.split(":", 1)[-1]).stem))
    cibles = {c for c in cibles if len(c) >= 6}
    for dossier in (Path.home() / "Downloads", RACINE):
        if not dossier.exists():
            continue
        for fichier in sorted(dossier.iterdir()):
            if not fichier.is_file() or fichier.suffix.lower() != extension:
                continue
            candidat = _simplifier(fichier.stem)
            if len(candidat) < 6:
                continue
            for attendu in cibles:
                if candidat == attendu or candidat in attendu or attendu in candidat:
                    return fichier
    return None


EXTENSIONS_IMAGE = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


def fichiers_deposes() -> list:
    """Images en attente dans Téléchargements ou à la racine du dépôt."""
    trouves = []
    for dossier in (Path.home() / "Downloads", RACINE):
        if not dossier.exists():
            continue
        for fichier in sorted(dossier.iterdir()):
            if fichier.is_file() and fichier.suffix.lower() in EXTENSIONS_IMAGE:
                trouves.append(fichier)
    return trouves


def ranger(registre: dict, credits: dict) -> None:
    """Associe à la main une image déposée à une entrée du registre.

    Quand on choisit soi-même une image ailleurs que sur Commons, son nom n'a
    aucun rapport avec celui du registre : aucune correspondance automatique
    n'est possible. On apparie donc par numéros.
    """
    manquantes = []
    for nom, entree in registre.items():
        dossier = MEDIAS / entree.get("fiche", "divers")
        if not (dossier / nom).exists():
            manquantes.append((nom, entree, dossier))
    if not manquantes:
        print("Aucune image ne manque.")
        return
    candidats = fichiers_deposes()
    if not candidats:
        print("Aucune image en attente dans Téléchargements ni à la racine du dépôt.")
        print("Enregistre l'image, puis relance cette commande.")
        return

    print("Images manquantes :")
    for i, (nom, entree, _) in enumerate(manquantes, 1):
        print(f"  {i:2}. {nom}   ({entree.get('fiche', 'divers')})")
    print("\nImages en attente :")
    for j, fichier in enumerate(candidats, 1):
        poids = fichier.stat().st_size // 1024
        print(f"  {chr(96 + j)}. {fichier.name}   {poids} ko   ({fichier.parent.name})")
    print("\nAssocie-les, par exemple : 3a 7b 9c   (vide pour quitter)")

    try:
        reponse = input("> ").strip()
    except EOFError:
        return
    if not reponse:
        return

    for paire in reponse.replace(",", " ").split():
        chiffres = "".join(c for c in paire if c.isdigit())
        lettres = "".join(c for c in paire if c.isalpha()).lower()
        if not chiffres or not lettres:
            print(f"  {paire} : format non compris, attendu par exemple 3a")
            continue
        i, j = int(chiffres) - 1, ord(lettres[0]) - 97
        if not (0 <= i < len(manquantes)) or not (0 <= j < len(candidats)):
            print(f"  {paire} : numéro hors de la liste")
            continue
        nom, entree, dossier = manquantes[i]
        source = candidats[j]
        cible = dossier / nom
        if source.suffix.lower() != cible.suffix.lower():
            print(f"  {nom} : le fichier est en {source.suffix.lower()}, "
                  f"le registre attend {cible.suffix.lower()}")
            print(f"         corrige l'extension dans medias/sources.yml, "
                  f"ou enregistre l'image en {cible.suffix.lower()}")
            continue
        dossier.mkdir(parents=True, exist_ok=True)
        shutil.move(str(source), str(cible))
        print(f"  ok     {nom}  rangée depuis {source.name}")
        if not all(credits.get(nom, {}).get(c) for c in ("auteur", "licence", "lien")):
            print(f"         complète auteur, licence et lien dans medias/credits.yml")


# ---------------------------------------------------------- téléchargement

def essayer(url: str) -> bytes:
    dernier = ""
    for tentative in range(2):
        if tentative:
            time.sleep(2)
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
            if "429" in str(erreur):
                # Commons demande de ralentir : une seule pause courte, une
                # seule reprise. Deux longues attentes par largeur coûtaient
                # jusqu'à six minutes par image, pour un gain quasi nul.
                time.sleep(12)
                try:
                    return essayer(info["vignette"])
                except Exception as seconde:
                    soucis.append(f"{largeur}px : {seconde}")
            else:
                soucis.append(f"{largeur}px : {erreur}")
        time.sleep(.4)
    if trouve.get("mime") == "image/svg+xml":
        soucis.append("SVG : seule une vignette est exploitable")
        raise ValueError(" ; ".join(soucis))
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


def diagnostiquer(nom: str, largeur: int) -> None:
    """Explique étape par étape pourquoi une image ne se récupère pas.

    Sans cela, un échec ne dit que sa dernière cause; on veut savoir si le
    fichier existe sur Commons, s'il a une vignette, et laquelle des largeurs
    répond, pour distinguer un mauvais nom d'un simple ralentissement.
    """
    registre = yaml.safe_load(REGISTRE.read_text(encoding="utf-8")) or {}
    entree = registre.get(nom)
    if not entree:
        sys.exit(f"{nom} n'est pas dans medias/sources.yml.")
    titre = (entree.get("commons") or "").strip()
    print(f"Diagnostic de {nom}\n")
    print(f"  registre  fiche {entree.get('fiche', 'divers')}, "
          f"cadrage {entree.get('cadrage', 'aucun')}")
    print(f"  commons   {titre or 'aucun nom épinglé'}")

    info = None
    if titre:
        try:
            info = interroger(titre, largeur)
        except Exception as erreur:
            print(f"  1. nom exact : l'API a répondu par une erreur ({erreur})")
        else:
            print(f"  1. nom exact : {'trouvé' if info else 'AUCUN fichier de ce nom'}")
    if not info:
        termes = (entree.get("recherche") or "").strip()
        print(f"  2. recherche « {termes} »")
        for candidat in chercher(termes, 5):
            print(f"       candidat : {candidat}")
        print("     corrige le champ commons avec un de ces noms, au caractère près")
        return

    print(f"  2. type    {info['mime']}, {info['poids'] // 1024} ko d'origine")
    print(f"  3. vignette {'disponible' if info.get('vignette') else 'ABSENTE'}")
    for essai in (largeur, 1024, 800):
        detail = interroger(titre, essai)
        url = (detail or {}).get("vignette")
        if not url:
            print(f"     {essai}px : pas de vignette proposée")
            continue
        try:
            reponse = requests.get(url, timeout=90, headers=ENTETES)
            etat = f"HTTP {reponse.status_code}, {len(reponse.content) // 1024} ko"
            if reponse.status_code == 429:
                etat += "  (Commons demande de ralentir : relance dans une minute)"
        except Exception as erreur:
            etat = f"pas de réponse ({erreur})"
        print(f"     {essai}px : {etat}")
        time.sleep(1)
    print("\n  Si toutes les largeurs répondent HTTP 200, relance simplement")
    print("  python outils/images.py : l'image manquante sera reprise.")


# --------------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--refaire", action="store_true")
    ap.add_argument("--verifier", action="store_true")
    ap.add_argument("--chercher", metavar="TERMES")
    ap.add_argument("--ranger", action="store_true",
                    help="associe à la main une image déposée à une entrée du registre")
    ap.add_argument("--diagnostic", metavar="IMAGE",
                    help="explique pourquoi une image précise ne se récupère pas")
    ap.add_argument("--bavard", action="store_true",
                    help="explique chaque tentative de recherche")
    ap.add_argument("--largeur", type=int, default=1400)
    args = ap.parse_args()

    if not REGISTRE.exists():
        sys.exit("medias/sources.yml est introuvable.")

    if args.verifier:
        verifier()
        return

    if args.diagnostic:
        diagnostiquer(args.diagnostic, args.largeur)
        return

    if args.ranger:
        registre = yaml.safe_load(REGISTRE.read_text(encoding="utf-8")) or {}
        credits = (yaml.safe_load(CREDITS.read_text(encoding="utf-8"))
                   if CREDITS.exists() else {}) or {}
        ranger(registre, credits)
        return

    if args.chercher:
        print(f"Fichiers trouvés pour « {args.chercher} » :\n")
        for titre in chercher(args.chercher, 10):
            info = interroger(titre, 320)
            if info:
                print(f"  {titre}\n      {info['auteur']} · {info['licence']}\n")
        return

    registre = yaml.safe_load(REGISTRE.read_text(encoding="utf-8")) or {}
    credits = (yaml.safe_load(CREDITS.read_text(encoding="utf-8")) or {}
               if CREDITS.exists() else {})

    # Migration : les anciens registres portaient les crédits directement.
    # On les déménage une fois pour toutes dans credits.yml, que les zips de
    # mise à jour du site n'écrasent jamais.
    for nom, entree in registre.items():
        if (entree.get("commons") or entree.get("recherche")) and nom not in credits \
                and all(entree.get(c) for c in ("auteur", "licence", "lien")):
            credits[nom] = {c: entree[c] for c in ("commons", "titre", "auteur",
                                                   "licence", "lien") if entree.get(c)}
    reussites = echecs = sautees = 0

    def sauvegarder():
        # Après chaque image, pas seulement à la fin : un plantage en cours de
        # route laissait des fichiers sur le disque sans leurs crédits.
        CREDITS.write_text(
            yaml.safe_dump(credits, allow_unicode=True, sort_keys=False, width=100),
            encoding="utf-8")

    for nom, entree in registre.items():
        dossier = MEDIAS / entree.get("fiche", "divers")
        cible = dossier / nom
        # Certaines images ne se téléchargent pas : les cartes d-maps, dont les
        # conditions interdisent les aspirateurs de site, et tes propres
        # documents. On les signale, on ne les récupère jamais.
        if entree.get("source") == "locale":
            if cible.exists():
                sautees += 1
            else:
                print(f"  À DÉPOSER  {nom}")
                print(f"             enregistre la carte depuis {entree.get('lien', '')}")
                print(f"             dans medias/{entree.get('fiche', 'divers')}/")
            continue

        # Les images à adresse directe viennent de l'ancien Google Site : on
        # les copie telles quelles, sans passer par Commons. Le crédit inscrit
        # dans le registre est conservé tel quel.
        url_directe = (entree.get("url") or "").strip()
        if url_directe:
            if cible.exists() and not args.refaire:
                sautees += 1
                continue
            # Une carte déjà enregistrée à la main sous son nom final, dans
            # Téléchargements ou à la racine du dépôt, est simplement rangée.
            for attente in (Path.home() / "Downloads" / nom, RACINE / nom):
                if attente.exists():
                    dossier.mkdir(parents=True, exist_ok=True)
                    shutil.move(str(attente), str(cible))
                    print(f"  ok     {nom}  rangée depuis {attente.parent.name}")
                    reussites += 1
                    break
            if cible.exists():
                continue
            try:
                reponse = requests.get(url_directe, timeout=90, headers=ENTETES_NAVIGATEUR)
                reponse.raise_for_status()
                contenu = reponse.content
                signatures = (b"\x89PNG", b"\xff\xd8\xff", b"GIF8", b"RIFF")
                if not any(contenu.startswith(s) for s in signatures):
                    raise ValueError("la réponse n'est pas une image (adresse expirée?)")
                dossier.mkdir(parents=True, exist_ok=True)
                cible.write_bytes(contenu)
                print(f"  ok     {nom}  {len(contenu) // 1024} ko  (ancien site)")
                reussites += 1
                sauvegarder()
            except Exception as erreur:
                print(f"  ECHEC  {nom} : {erreur}")
                print("         En dernier recours : clic droit sur la carte dans le")
                print(f"         Google Site, Enregistrer l'image sous, dans medias/{entree.get('fiche', 'divers')}/{nom}")
                echecs += 1
            continue

        credit = credits.get(nom, {})
        complet = all(credit.get(c) for c in ("auteur", "licence", "lien"))
        # Si le registre épingle désormais un autre fichier Commons que celui
        # du crédit, l'image sur le disque n'est plus la bonne : on la refait.
        if complet and entree.get("commons") and credit.get("commons") \
                and entree["commons"] != credit["commons"]:
            complet = False
        if cible.exists() and complet and not args.refaire:
            sautees += 1
            continue

        # Porte de sortie quand Commons refuse obstinément un fichier : si
        # l'image a été enregistrée à la main sous son nom final, dans
        # Téléchargements ou à la racine du dépôt, on la range simplement.
        range_a_la_main = False
        if not cible.exists():
            depot = depot_manuel(nom, entree, credit)
            if depot:
                dossier.mkdir(parents=True, exist_ok=True)
                shutil.move(str(depot), str(cible))
                print(f"  ok     {nom}  rangée depuis {depot.name}")
                range_a_la_main = True

        trouve = None
        try:
            effective = dict(entree)
            effective["commons"] = entree.get("commons") or credit.get("commons", "")
            trouve = resoudre(effective, args.largeur, args.bavard)
        except Exception as erreur:
            print(f"  ECHEC  {nom} : {erreur}")

        if not trouve:
            print(f"  ECHEC  {nom} : rien trouvé sur Commons")
            print(f"         précise le champ commons ou recherche dans medias/sources.yml")
            echecs += 1
            continue

        # Un fichier présent mais sans crédits est retéléchargé : impossible de
        # garantir autrement que l'image sur le disque et le crédit inscrit
        # décrivent bien le même document.
        # Une image rangée à la main ne se retélécharge pas : on ne va
        # chercher sur Commons que ses crédits.
        if not range_a_la_main and (not cible.exists() or not complet or args.refaire):
            try:
                donnees = recuperer(trouve, trouve["commons"], [args.largeur, 1024, 800])
                dossier.mkdir(parents=True, exist_ok=True)
                cible.write_bytes(donnees)
            except Exception as erreur:
                print(f"  ECHEC  {nom} : {erreur}")
                print(f"         python outils/images.py --diagnostic {nom}")
                echecs += 1
                continue
            time.sleep(1)

        credits[nom] = {
            "commons": trouve["commons"],
            "titre": entree.get("titre") or joli_titre(trouve["commons"]),
            "auteur": trouve["auteur"],
            "licence": trouve["licence"],
            "lien": trouve["lien"],
        }
        sauvegarder()
        print(f"  ok     {nom}  {cible.stat().st_size // 1024} ko  {trouve['licence']}")
        reussites += 1

    sauvegarder()

    print(f"\n{reussites} traitées, {sautees} déjà complètes, {echecs} en échec.")
    print("Relance python build.py pour reconstruire le site.")


if __name__ == "__main__":
    main()
