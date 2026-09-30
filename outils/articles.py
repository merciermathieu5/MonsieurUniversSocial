#!/usr/bin/env python3
"""
Tient le registre des articles d'actualité et remplit la page tout seul.

    python outils\\articles.py --chercher    lit les fils, propose, contrôle les liens
    python outils\\articles.py               écrit les articles validés dans la page
    python outils\\articles.py --diagnostic  montre les rejets et pourquoi
    python outils\\articles.py --sonder      éprouve chaque fil, sans toucher au registre
    python outils\\articles.py --bilan       tes O et tes N par territoire et par terme

Même principe que outils\\images.py : tu écris en clair dans un registre, le
script fait toute la mécanique. Ici le registre est contenu\\articles.yml.

    - adresse: "https://..."
      fiche: "06"
      media: "La Presse"
      date: "2026-08-05"
      titre: "Le réchauffement a doublé la probabilité des incendies de forêt"
      garder: ""          <- O pour publier, N pour refuser
      note: ""            <- facultatif, remplace le titre si tu l'écris

--chercher ajoute des propositions avec un champ garder vide. Tu écris O ou N
sur chacune. Tant que le champ est vide, l'entrée dort au registre sans
paraître nulle part.

Écris N plutôt que d'effacer une entrée : effacée, elle serait retrouvée dans
le fil au passage suivant et reproposée. Le N est une pierre tombale, et il
est nettoyé en même temps que les articles périmés.

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
import urllib.parse
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
# Un seul champ à remplir : garder.
#
#     garder: "O"   l'article paraît sur la page
#     garder: "N"   l'article est refusé, pour de bon
#     garder: ""    en attente, ne paraît nulle part
#
# Écris N plutôt que d'effacer l'entrée. Une entrée effacée serait retrouvée
# dans le fil au passage suivant et reproposée. Le N tient lieu de pierre
# tombale et disparaît en même temps que les articles périmés.
#
# Le champ note est facultatif : écris une phrase et elle remplacera le titre
# du média sur la carte. Laisse-la vide et c'est le titre qui paraît.
#
# Les liens morts et les articles périmés sont retirés automatiquement au
# passage suivant de --chercher.
"""


def aplatir(texte: str) -> str:
    sans = unicodedata.normalize("NFD", texte or "")
    sans = "".join(c for c in sans if unicodedata.category(c) != "Mn")
    return " ".join(sans.lower().replace("'", " ").replace("\u2019", " ").split())


def position(terme: str, texte: str) -> int:
    """Où le terme paraît dans le texte, -1 s'il n'y est pas.

    Le pluriel est toléré sur chacun de ses mots.
    """
    mots = [re.escape(m) for m in aplatir(terme).split()]
    trouve = re.search(r"\b" + r"s?\s+".join(mots) + r"s?\b", texte)
    return trouve.start() if trouve else -1


def contient(terme: str, texte: str) -> bool:
    """Cherche un terme en tolérant le pluriel sur chacun de ses mots."""
    return position(terme, texte) >= 0


def clef(adresse: str) -> str:
    """L'adresse dépouillée de ses paramètres, pour reconnaître un doublon."""
    return adresse.split("?")[0].rstrip("/")


def nettoyer(adresse: str) -> str:
    """Retire les marqueurs de provenance ajoutés par les fils.

    Un lien public n'a pas à traîner utm_source=rss : c'est long, laid, et ça
    attribue faussement la visite à une campagne. Les autres paramètres sont
    gardés, certains sites en ont besoin.
    """
    if "?" not in adresse:
        return adresse
    base, question, reste = adresse.partition("?")
    gardes = [p for p in reste.split("&")
              if p and not p.lower().startswith("utm_")]
    return base + ("?" + "&".join(gardes) if gardes else "")


def couper_titre(titre: str) -> tuple[str, str]:
    """Sépare le chapeau du titre : « Section | Titre » donne les deux.

    La Presse préfixe ses titres du sujet traité. Gardé tel quel, ce préfixe
    alourdit la carte; séparé, il devient un repère géographique utile.
    """
    if " | " in titre:
        chapeau, _, reste = titre.partition(" | ")
        if len(chapeau) <= 60 and reste.strip():
            return chapeau.strip(), reste.strip()
    return "", titre.strip()


def candidats_de(adresse) -> list[str]:
    """Les adresses d'un fil du lexique, qu'il en donne une ou plusieurs."""
    if isinstance(adresse, str):
        return [adresse]
    return [str(a) for a in (adresse or []) if a]


def telecharger(adresse: str) -> tuple[bytes, str]:
    """La réponse brute, ou la raison du silence."""
    requete = urllib.request.Request(adresse, headers=ENTETES)
    try:
        with urllib.request.urlopen(requete, timeout=20) as reponse:
            return reponse.read(), ""
    except urllib.error.HTTPError as erreur:
        raison = ("refus de robot, le fil est probablement vivant"
                  if erreur.code in (403, 429) else "fil introuvable")
        return b"", f"{erreur.code}, {raison}"
    except Exception as erreur:
        return b"", f"injoignable, {type(erreur).__name__}"


def texte_brut(fragment: str) -> str:
    """Le résumé d'un fil, sans balises ni entités, sur une ligne.

    Radio-Canada et La Presse glissent du HTML dans leur description; seul
    le texte compte pour le classement.
    """
    sans = re.sub(r"<[^>]+>", " ", fragment)
    texte = " ".join(html.unescape(html.unescape(sans)).split())
    return re.sub(r" ([.,)])", r"\1", texte)


def extraire_entrees(brut: bytes, nom: str) -> list[dict] | None:
    """Les articles d'un fil, ou None si la réponse n'est pas du XML."""
    try:
        racine = ET.fromstring(brut)
    except ET.ParseError:
        return None

    entrees = []
    for item in racine.iter():
        if not item.tag.endswith("item") and not item.tag.endswith("entry"):
            continue
        titre = lien = quand = resume = ""
        for enfant in item:
            balise = enfant.tag.rsplit("}", 1)[-1]
            if balise == "title":
                titre = (enfant.text or "").strip()
            elif balise == "link":
                lien = (enfant.text or enfant.get("href") or "").strip()
            elif balise in ("pubDate", "published", "updated"):
                quand = (enfant.text or "").strip()
            elif balise in ("description", "summary") and not resume:
                resume = texte_brut(enfant.text or "")
        if titre and lien:
            entrees.append({"titre": titre, "lien": lien, "date": quand,
                            "source": nom, "resume": resume})
    return entrees


def decouvrir_fils(brut: bytes, base: str) -> list[str]:
    """Les fils annoncés par une page, dans l'ordre où elle les donne.

    Une page de section n'est pas un fil, mais elle dit où est le sien :
    d'abord dans ses balises <link rel="alternate">, sinon dans toute
    adresse en /rss/ semée dans son code. Trois candidates au plus, la
    première annonce d'une page étant presque toujours la bonne.
    """
    texte = brut.decode("utf-8", errors="replace")
    trouves: list[str] = []

    def ajouter(adresse: str) -> None:
        adresse = html.unescape(adresse.strip())
        if adresse.startswith("//"):
            adresse = "https:" + adresse
        elif adresse.startswith("/"):
            adresse = urllib.parse.urljoin(base, adresse)
        if adresse.startswith("http") and adresse not in trouves:
            trouves.append(adresse)

    for balise in re.findall(r"<link\b[^>]*>", texte, flags=re.I):
        if not re.search(r"rel\s*=\s*[\"']?alternate", balise, flags=re.I):
            continue
        if not re.search(r"type\s*=\s*[\"'][^\"']*(rss|atom|xml)",
                         balise, flags=re.I):
            continue
        cible = re.search(r"href\s*=\s*[\"']([^\"']+)", balise, flags=re.I)
        if cible:
            ajouter(cible.group(1))
    for adresse in re.findall(r"(?:https?:)?//[^\s\"'<>()]*?/rss/\d+", texte):
        ajouter(adresse)
    for adresse in re.findall(r"[\"'](/rss/\d+)[\"']", texte):
        ajouter(adresse)
    return trouves[:3]


def lire_fil(nom: str, adresse) -> tuple[list[dict], str, str]:
    """Les articles, la raison du silence et l'adresse qui a répondu.

    Le lexique peut donner une adresse de fil, une liste de candidates
    essayées dans l'ordre, ou une page de section : la page n'est pas un
    fil, mais l'outil y lit l'adresse du fil annoncé et la suit, un seul
    niveau de poursuite, pas de furetage. L'adresse retournée est celle
    qui a livré les articles, à épingler dans le lexique quand elle
    diffère de la première candidate.
    """
    echecs = []
    for candidate in candidats_de(adresse):
        brut, raison = telecharger(candidate)
        if raison:
            echecs.append(f"{candidate} : {raison}")
            continue
        entrees = extraire_entrees(brut, nom)
        if entrees:
            return entrees, "", candidate
        annonces = decouvrir_fils(brut, candidate)
        if not annonces:
            echecs.append(f"{candidate} : fil vide" if entrees is not None
                          else f"{candidate} : pas un fil, et la page "
                               "n'en annonce aucun")
            continue
        for annonce in annonces:
            brut, raison = telecharger(annonce)
            if raison:
                echecs.append(f"{annonce} : {raison}")
                continue
            entrees = extraire_entrees(brut, nom)
            if entrees:
                return entrees, "", annonce
            echecs.append(f"{annonce} : fil vide ou illisible")
    return [], " ; ".join(echecs) or "adresse absente du lexique", ""


def en_iso(date_rss: str) -> str:
    try:
        return email.utils.parsedate_to_datetime(date_rss).strftime("%Y-%m-%d")
    except Exception:
        return date.today().isoformat()


def media_de(source: str) -> str:
    return source.split(" · ")[0].split(",")[0].strip()


def termes(liste, texte: str) -> list[str]:
    return [m for m in (liste or []) if contient(m, texte)]


def classer(titre: str, lexique: dict, resume: str = "",
            retrogrades: frozenset = frozenset()) -> list[tuple]:
    """Territoires candidats, du mieux noté au moins bon. Veto en premier.

    Deux portes d'entrée, décrites en tête du lexique : un terme fort dans
    le titre, ou un terme fort dans le résumé confirmé par un terme faible
    du titre. Un terme fort de « retrogrades » (voir apprentissage) compte
    comme un faible : tes N répétés lui ont retiré le droit de décider seul.
    """
    plat = aplatir(titre)
    plat_resume = aplatir(resume)
    tout = plat + " " + plat_resume
    for veto in lexique.get("exclure", []):
        if contient(veto, tout):
            return [("veto", veto)]
    chapeau, corps = couper_titre(titre)
    plat_corps = aplatir(corps)
    if chapeau:
        plat_chapeau = aplatir(chapeau)
        for rubrique in lexique.get("rubriques_exclues", []):
            if contient(rubrique, plat_chapeau):
                return [("veto", f"rubrique {rubrique}")]
    resultats = []
    for numero, regles in (lexique.get("geographie") or {}).items():
        if termes(regles.get("pieges"), tout):
            continue
        forts_bruts = termes(regles.get("forts"), plat)
        forts = [m for m in forts_bruts if (numero, m) not in retrogrades]
        faibles = termes(regles.get("faibles"), plat) + [
            m for m in forts_bruts if (numero, m) in retrogrades]
        du_resume = [m for m in termes(regles.get("forts"), plat_resume)
                     if m not in forts_bruts and (numero, m) not in retrogrades]
        if forts:
            note = 2 * len(forts) + len(faibles) + len(du_resume)
        elif du_resume and faibles:
            note = len(du_resume) + len(faibles)
        else:
            continue
        if note >= 2:
            # À égalité, le territoire nommé le plus tôt dans le titre
            # l'emporte : le sujet d'un titre vient d'habitude en tête.
            premier = min((position(m, plat_corps) for m in forts + faibles
                           if position(m, plat_corps) >= 0), default=len(plat))
            resultats.append((note, numero, regles["nom"],
                              forts + faibles + du_resume, len(forts),
                              premier))
    resultats.sort(key=lambda r: (-r[0], -r[4], r[5], r[1]))
    return [r[:5] for r in resultats]


def mots_du_titre(titre: str) -> frozenset:
    """Les mots porteurs d'un titre, sans chapeau, pour repérer un doublon."""
    _, corps = couper_titre(titre)
    return frozenset(m for m in re.findall(r"[a-z0-9]+", aplatir(corps))
                     if len(m) >= 4)


def doublon(mots: frozenset, quand: str, deja: list[tuple]) -> bool:
    """Vrai si un titre presque identique est au registre depuis peu.

    La même dépêche passe par Radio-Canada, La Presse et le Journal le même
    jour, parfois deux fois dans le même fil. Trois mots sur quatre en
    commun, à trois jours près : c'est la même nouvelle.
    """
    if not mots:
        return False
    try:
        jour = date.fromisoformat(quand)
    except ValueError:
        return False
    for autres, autre_date in deja:
        if not autres:
            continue
        try:
            ecart = abs((jour - date.fromisoformat(autre_date)).days)
        except ValueError:
            continue
        if ecart <= 3 and len(mots & autres) / len(mots | autres) >= 0.75:
            return True
    return False


def statut(a: dict) -> str:
    garder = (a.get("garder") or "").strip().upper()
    if garder.startswith("O"):
        return "O"
    if garder.startswith("N"):
        return "N"
    return ""


def statistiques_termes(lexique: dict, registre: list[dict]) -> dict:
    """Pour chaque terme fort : combien de O et de N il a amenés.

    Le calcul relit les titres du registre avec le lexique d'aujourd'hui,
    sur le territoire où chaque article a été rangé. Il n'a donc besoin
    d'aucun champ de plus au registre.
    """
    geo = lexique.get("geographie") or {}
    stats: dict = {}
    for a in registre:
        st = statut(a)
        regles = geo.get(a.get("fiche"))
        if not st or not regles:
            continue
        for m in termes(regles.get("forts"), aplatir(a.get("titre", ""))):
            o, n = stats.get((a["fiche"], m), (0, 0))
            stats[(a["fiche"], m)] = (o + (st == "O"), n + (st == "N"))
    return stats


def retrogradations(lexique: dict, registre: list[dict]) -> frozenset:
    """Les termes forts que tes jugements ont rendus faibles."""
    reglage = lexique.get("apprentissage") or {}
    minimum = int(reglage.get("minimum", 5))
    taux = float(reglage.get("taux", 0.15))
    return frozenset(
        cle for cle, (o, n) in statistiques_termes(lexique, registre).items()
        if o + n >= minimum and o / (o + n) <= taux)


def charger_registre() -> list[dict]:
    if not REGISTRE.exists():
        return []
    donnees = yaml.safe_load(REGISTRE.read_text(encoding="utf-8")) or {}
    articles = donnees.get("articles") or []
    # Nettoyage à la lecture, pas seulement à la collecte : les entrées déjà
    # au registre doivent en profiter sans attendre un passage réseau.
    for a in articles:
        a["adresse"] = nettoyer(a.get("adresse", ""))
        # Reprise de l'ancien registre, où le champ s'appelait apercu et où
        # écrire une note valait acceptation. Ces notes étaient des étiquettes
        # écrites pour un autre affichage : la validation est conservée, le
        # texte est effacé pour laisser paraître le titre du média.
        if "apercu" in a and "garder" not in a:
            a["titre"] = a.pop("apercu")
            a["garder"] = "O" if (a.get("note") or "").strip() else ""
            a["note"] = ""
    return articles


def ecrire_registre(articles: list[dict]) -> None:
    """Écrit le registre à la main pour garder l'en-tête et un diff lisible.

    Trois sections, séparées par des bandeaux commentés : ce qui attend ton
    jugement se lit en tête de fichier, sans chercher parmi les entrées déjà
    tranchées. À l'intérieur de chaque section, l'ordre reste le même
    qu'avant, du plus récent au plus ancien.
    """
    def guillemets(valeur: str) -> str:
        return '"' + str(valeur or "").replace("\\", "\\\\").replace('"', '\\"') + '"'

    SECTIONS = [("", "À JUGER"), ("O", "PUBLIÉS (O)"), ("N", "REFUSÉS (N)")]
    lignes = [EN_TETE_REGISTRE, "articles:"]
    tries = sorted(articles, key=lambda x: (x.get("date", ""), x.get("fiche", "")),
                   reverse=True)
    for code, bandeau in SECTIONS:
        retenus = [a for a in tries if statut(a) == code]
        if not retenus:
            continue
        lignes.append("")
        lignes.append(f"  # ---------------- {bandeau} ----------------")
        for a in retenus:
            lignes.append(f"  - adresse: {guillemets(a['adresse'])}")
            lignes.append(f"    fiche: {guillemets(a['fiche'])}")
            lignes.append(f"    media: {guillemets(a.get('media', ''))}")
            lignes.append(f"    date: {guillemets(a.get('date', ''))}")
            lignes.append(f"    titre: {guillemets(a.get('titre', ''))}")
            lignes.append(f"    garder: {guillemets(a.get('garder', ''))}")
            lignes.append(f"    note: {guillemets(a.get('note', ''))}")
            if a.get("echecs"):
                lignes.append(f"    echecs: {a['echecs']}")
            lignes.append("")
    # newline="\n" comme dans build.py : sans lui, Python traduit \n en \r\n
    # sous Windows. Le registre basculerait alors d'un format a l'autre selon
    # que la recherche a tourne sur ton poste ou sur le robot GitHub, et le
    # test jsdom, qui compare octet pour octet, echouerait sur ta machine.
    REGISTRE.write_text("\n".join(lignes).rstrip() + "\n",
                        encoding="utf-8", newline="\n")


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
    entrees, muets, epingles = [], [], []
    for nom, adresse in fils.items():
        lot, note, retenue = lire_fil(nom, adresse)
        entrees.extend(lot)
        if note:
            muets.append((nom, note))
        elif retenue != (candidats_de(adresse) or [""])[0]:
            epingles.append((nom, retenue))

    print(f"\n{len(entrees)} articles lus dans {len(fils) - len(muets)} fils")
    if muets:
        print("\nFILS SANS RÉPONSE")
        for nom, note in muets:
            print(f"    {nom}")
            for essai in note.split(" ; "):
                print(f"        {essai}")
    if epingles:
        print("\nADRESSES TROUVÉES EN COURS DE ROUTE")
        print("    Le fil a répondu à une autre adresse que la première du")
        print("    lexique. Épingle-la dans outils/lexique_actualite.yml")
        print("    pour économiser le détour au prochain passage.")
        for nom, retenue in epingles:
            print(f"    {nom} : {retenue}")

    retro = retrogradations(lexique, registre)
    if retro:
        print("\nTERMES RÉTROGRADÉS PAR TES REFUS (ne décident plus seuls)")
        for numero, terme in sorted(retro):
            print(f"    {numero} {terme}")

    connus = {clef(a["adresse"]) for a in registre}
    deja = [(mots_du_titre(a.get("titre", "")), a.get("date", ""))
            for a in registre]
    vus, ajoutes, vetos, doublons = set(), 0, 0, 0
    par_resume = 0
    for entree in entrees:
        cle = clef(entree["lien"])
        if cle in connus or cle in vus:
            continue
        vus.add(cle)
        candidats = classer(entree["titre"], lexique,
                            entree.get("resume", ""), retro)
        if not candidats:
            continue
        if candidats[0][0] == "veto":
            vetos += 1
            continue
        quand = en_iso(entree["date"])
        mots = mots_du_titre(entree["titre"])
        if doublon(mots, quand, deja):
            doublons += 1
            continue
        deja.append((mots, quand))
        _, numero, nom, _, nb_forts = candidats[0]
        par_resume += nb_forts == 0
        registre.append({
            "adresse": nettoyer(entree["lien"]), "fiche": numero,
            "media": media_de(entree["source"]),
            "date": quand,
            "titre": entree["titre"], "garder": "", "note": "",
        })
        ajoutes += 1
    print(f"\n{ajoutes} proposition(s) ajoutée(s), dont {par_resume} par le "
          f"résumé, {vetos} écartée(s) par le veto, {doublons} doublon(s) "
          "d'une dépêche déjà au registre")

    # Contrôle des liens et péremption, puisqu'on est déjà en ligne.
    limite = (datetime.now() - timedelta(days=jours)).strftime("%Y-%m-%d")
    gardes, retires = [], []
    for a in registre:
        if a.get("date", "") and a["date"] < limite:
            retires.append((a, f"périmé, plus de {jours} jours"))
            continue
        # Un refus n'a pas besoin d'être contrôlé : il ne mène nulle part.
        if (a.get("garder") or "").strip().upper().startswith("N"):
            gardes.append(a)
            continue
        etat = controler_lien(a["adresse"])
        if etat == "mort":
            a["echecs"] = a.get("echecs", 0) + 1
            if a["echecs"] >= 2:
                retires.append((a, "lien mort, confirmé deux fois"))
                continue
            print(f"    lien suspect, à reconfirmer : {a['titre'][:60]}")
        elif etat == "vivant":
            a.pop("echecs", None)
        else:
            print(f"    non concluant, gardé : {etat} · {a['titre'][:50]}")
        gardes.append(a)
    for a, raison in retires:
        print(f"    retiré ({raison}) : {a['titre'][:60]}")
    if retires:
        print(f"\n{len(retires)} article(s) retiré(s)")
    return gardes


def publier(lexique: dict, registre: list[dict]) -> int:
    noms = {n: r["nom"] for n, r in (lexique.get("geographie") or {}).items()}
    prets = [a for a in registre
             if (a.get("garder") or "").strip().upper().startswith("O")]
    prets.sort(key=lambda a: a.get("date", ""), reverse=True)

    lignes = []
    for a in prets:
        nom = noms.get(a["fiche"], "")
        if not nom:
            print(f"    ignoré, fiche {a['fiche']} inconnue : {a['titre'][:50]}")
            continue
        # La note écrite à la main l'emporte sur le titre du média.
        chapeau, titre = couper_titre(a.get("titre", ""))
        if (a.get("note") or "").strip():
            chapeau, titre = "", a["note"].strip()
        lignes.append(
            f'    <li data-fiche="{html.escape(a["fiche"])}" '
            f'data-source="{html.escape(a.get("media", ""))}" '
            f'data-date="{html.escape(a.get("date", ""))}" '
            f'data-territoire="{html.escape(nom, quote=True)}" '
            f'data-chapeau="{html.escape(chapeau, quote=True)}">'
            f'<a href="{html.escape(a["adresse"])}">'
            f'{html.escape(titre)}</a></li>')

    texte = COMPOSANT.read_text(encoding="utf-8")
    motif = re.compile(r'(<ul data-matiere="geographie">).*?(</ul>)', re.S)
    if not motif.search(texte):
        sys.exit("Le composant actualite.html n'a pas sa liste attendue.")
    corps = ("\n" + "\n".join(lignes)) if lignes else ""
    COMPOSANT.write_text(
        motif.sub(lambda m: m.group(1) + corps + "\n  " + m.group(2), texte),
        encoding="utf-8", newline="\n")

    refuses = sum(1 for a in registre
                  if (a.get("garder") or "").strip().upper().startswith("N"))
    attente = len(registre) - len(prets) - refuses
    # Une valeur illisible (le chiffre 0 pour la lettre O, une faute de
    # frappe) laisserait l'article en attente sans un mot : autant le dire.
    for a in registre:
        garder = (a.get("garder") or "").strip()
        if garder and not garder.upper().startswith(("O", "N")):
            print(f"    garder illisible « {garder} », traité comme en "
                  f"attente : {a['titre'][:50]}")
    print(f"\n{len(lignes)} article(s) publié(s) dans la page")
    if attente:
        print(f"{attente} en attente d'un O ou d'un N dans contenu/articles.yml")
    if refuses:
        print(f"{refuses} refusé(s), gardés au registre pour ne pas revenir")
    return 0


def diagnostic(lexique: dict) -> int:
    fils = lexique.get("fils") or {}
    entrees = []
    for nom, adresse in fils.items():
        lot, _, _ = lire_fil(nom, adresse)
        entrees.extend(lot)
    print(f"\n{len(entrees)} articles lus\n")
    print("Un article sans terme fort est écarté. Les termes faibles touchés\n"
          "sont montrés : s'ils reviennent souvent, il manque un terme fort.\n")
    retro = retrogradations(lexique, charger_registre())
    for entree in entrees:
        candidats = classer(entree["titre"], lexique,
                            entree.get("resume", ""), retro)
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


def sonder(lexique: dict) -> int:
    """Éprouve chaque fil du lexique et dit lequel répond, à quelle adresse.

    Rien n'est écrit : ni registre, ni page. C'est l'outil à lancer quand
    un fil se tait, ou avant d'épingler une adresse dans le lexique.
    """
    fils = lexique.get("fils") or {}
    vivants = 0
    for nom, adresse in fils.items():
        print(f"\n{nom}")
        lot, note, retenue = lire_fil(nom, adresse)
        if lot:
            vivants += 1
            print(f"    ok, {len(lot)} article(s) : {retenue}")
            if retenue != (candidats_de(adresse) or [""])[0]:
                print(f"    adresse à épingler dans le lexique : {retenue}")
        else:
            for essai in note.split(" ; "):
                print(f"    {essai}")
    print(f"\n{vivants} fil(s) vivant(s) sur {len(fils)}")
    return 0


def bilan(lexique: dict, registre: list[dict]) -> int:
    """Tes jugements relus : ce qui passe, ce qui ne passe pas, et pourquoi.

    Rien n'est écrit. C'est l'outil à lancer avant de retoucher le lexique :
    un territoire maigre demande des termes ou des fils de plus, un terme
    souvent refusé demande d'être retiré ou rangé parmi les faibles.
    """
    geo = lexique.get("geographie") or {}
    print("\nPAR TERRITOIRE")
    print(f"    {'':4}{'territoire':<52}{'O':>4}{'N':>5}{'attente':>9}{'taux':>7}")
    for numero, regles in geo.items():
        lot = [statut(a) for a in registre if a.get("fiche") == numero]
        o, n, e = lot.count("O"), lot.count("N"), lot.count("")
        taux = f"{100 * o / (o + n):.0f} %" if o + n else "  -"
        print(f"    {numero:<4}{regles['nom'][:50]:<52}{o:>4}{n:>5}{e:>9}{taux:>7}")

    print("\nPAR MÉDIA")
    for media in sorted({a.get("media", "") for a in registre}):
        lot = [statut(a) for a in registre if a.get("media", "") == media]
        o, n = lot.count("O"), lot.count("N")
        taux = f"{100 * o / (o + n):.0f} %" if o + n else "-"
        print(f"    {media:<28}{o:>4} O{n:>5} N    {taux}")

    stats = statistiques_termes(lexique, registre)
    retro = retrogradations(lexique, registre)
    print("\nTERMES FORTS LES PLUS REFUSÉS (au moins 3 jugements)")
    douteux = sorted(((o / (o + n), -(o + n), cle, o, n)
                      for cle, (o, n) in stats.items() if o + n >= 3))
    for taux, _, (numero, terme), o, n in douteux[:15]:
        marque = "  rétrogradé" if (numero, terme) in retro else ""
        print(f"    {numero} {terme:<28}{o:>3} O{n:>4} N{marque}")
    if not douteux:
        print("    aucun terme n'a encore trois jugements")

    print("\nTERMES FORTS JAMAIS VUS AU REGISTRE")
    print("    Normal pour un terme rare. Si tout un territoire est ici, il")
    print("    lui manque des fils ou des mots de tous les jours.")
    for numero, regles in geo.items():
        muets = [m for m in regles.get("forts", []) if (numero, m) not in stats]
        if len(muets) == len(regles.get("forts", [])):
            print(f"    {numero} aucun terme n'a encore servi")
    return 0


def main() -> int:
    a = argparse.ArgumentParser()
    a.add_argument("--chercher", action="store_true",
                   help="lit les fils, propose, contrôle les liens")
    a.add_argument("--diagnostic", action="store_true",
                   help="montre les rejets et pourquoi")
    a.add_argument("--sonder", action="store_true",
                   help="éprouve chaque fil, sans toucher au registre")
    a.add_argument("--bilan", action="store_true",
                   help="tes O et tes N par territoire et par terme")
    a.add_argument("--jours", type=int, default=365,
                   help="âge maximal d'un article, en jours")
    arguments = a.parse_args()

    lexique = yaml.safe_load(LEXIQUE.read_text(encoding="utf-8"))
    if arguments.sonder:
        return sonder(lexique)
    if arguments.diagnostic:
        return diagnostic(lexique)

    registre = charger_registre()
    if arguments.bilan:
        return bilan(lexique, registre)
    if arguments.chercher:
        registre = chercher(lexique, registre, arguments.jours)
        ecrire_registre(registre)
        print(f"\nRegistre écrit : {REGISTRE.relative_to(RACINE)}")
    return publier(lexique, registre)


if __name__ == "__main__":
    sys.exit(main())
