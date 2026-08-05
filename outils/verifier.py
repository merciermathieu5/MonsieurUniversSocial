#!/usr/bin/env python3
"""
Contrôle de qualité visuelle. À lancer avant chaque publication.

    python outils\\verifier.py

Trois familles de contrôles :

  1. Palette      chaque couple fond / texte du site, dans les deux thèmes,
                  doit atteindre le seuil de contraste 4.5:1.
  2. Schémas      chaque texte d'un SVG est comparé au fond réellement
                  derrière lui, en tenant compte de l'opacité du rectangle.
                  Les débordements hors du cadre sont aussi signalés.
  3. Contenu      images déclarées mais absentes, crédits incomplets.

Ce fichier existe parce que l'oeil ne suffit pas : un texte blanc sur un
rectangle à 45 pour cent d'opacité paraît correct dans l'éditeur et devient
illisible au projecteur.
"""
from __future__ import annotations

import re
import sys

import yaml
import xml.etree.ElementTree as ET
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
SCHEMAS = RACINE / "medias" / "schemas"
SEUIL = 4.5

# Valeur des variables CSS dans chaque thème. Doit suivre theme/style.css.
THEMES = {
    "lecture": {
        "--fond": "#E4E8E1", "--surface": "#FBFBF8", "--surface-2": "#F1F3EE",
        "--trait": "#CBD2C6", "--encre": "#1A2530", "--encre-doux": "#55636E",
        "--encre-pale": "#67747E", "--matiere": "#2F4B6E", "--matiere-fonce": "#22374F",
        "--matiere-voile": "#DEE5EE", "--signal": "#D2952E",
        "--bloc": "#2F4B6E", "--bloc-texte": "#FFFFFF",
        "--bloc-pale": "#A9BACC", "--bloc-pale-texte": "#12202F",
        "--schema-cle": "#55636E", "--schema-accent": "#8A5D0C",
        "--schema-trait": "#C2CAD3",
    },
    "sombre": {
        "--fond": "#121A22", "--surface": "#18222D", "--surface-2": "#1F2A36",
        "--trait": "#2E3B48", "--encre": "#F1EEE7", "--encre-doux": "#B6C0C9",
        "--encre-pale": "#8B98A3", "--matiere": "#6F97C6", "--matiere-fonce": "#8FB4DC",
        "--matiere-voile": "#22334A", "--signal": "#E5AC44",
        "--bloc": "#3A6091", "--bloc-texte": "#FFFFFF",
        "--bloc-pale": "#2A4058", "--bloc-pale-texte": "#DCE7F2",
        "--schema-cle": "#B4BEC7", "--schema-accent": "#E5AC44",
        "--schema-trait": "#3B4C5E",
    },
}

# Le fond de la zone qui accueille un schéma, par thème.
FOND_SCHEMA = {"lecture": "--surface-2", "sombre": "--surface-2"}


# ------------------------------------------------------------------ couleurs

def rvb(couleur: str) -> tuple[int, int, int]:
    couleur = couleur.strip().lstrip("#")
    if len(couleur) == 3:
        couleur = "".join(c * 2 for c in couleur)
    return tuple(int(couleur[i:i + 2], 16) for i in (0, 2, 4))


def poser(dessus, dessous, alpha: float):
    a, b = (rvb(dessus) if isinstance(dessus, str) else dessus,
            rvb(dessous) if isinstance(dessous, str) else dessous)
    return tuple(round(x * alpha + y * (1 - alpha)) for x, y in zip(a, b))


def luminance(couleur) -> float:
    c = rvb(couleur) if isinstance(couleur, str) else couleur

    def canal(v):
        v /= 255
        return v / 12.92 if v <= .03928 else ((v + .055) / 1.055) ** 2.4
    r, v, b = (canal(x) for x in c)
    return .2126 * r + .7152 * v + .0722 * b


def contraste(a, b) -> float:
    l1, l2 = sorted((luminance(a), luminance(b)), reverse=True)
    return (l1 + .05) / (l2 + .05)


def resoudre(valeur: str, theme: dict) -> str | None:
    """Traduit var(--x), #abc ou un mot-clé en couleur hexadécimale."""
    if not valeur:
        return None
    valeur = valeur.strip()
    m = re.match(r"var\((--[\w-]+)\)", valeur)
    if m:
        return theme.get(m.group(1))
    if valeur.startswith("#"):
        return valeur
    return {"white": "#FFFFFF", "black": "#000000", "none": None}.get(valeur.lower())


# ------------------------------------------------------------------- schémas

def styles_du_svg(source: str) -> dict[str, dict[str, str]]:
    """Lit le bloc <style> et renvoie les propriétés par sélecteur de classe."""
    regles = {}
    for bloc in re.findall(r"<style>(.*?)</style>", source, re.DOTALL):
        for selecteur, corps in re.findall(r"\.([\w-]+)\s*\{([^}]*)\}", bloc):
            proprietes = {}
            for paire in corps.split(";"):
                if ":" in paire:
                    cle, val = paire.split(":", 1)
                    proprietes[cle.strip()] = val.strip()
            regles[selecteur] = proprietes
    return regles


def sans_espace(balise: str) -> str:
    return balise.split("}")[-1]


def controler_schema(chemin: Path, theme_nom: str) -> list[str]:
    theme = THEMES[theme_nom]
    source = chemin.read_text(encoding="utf-8")
    regles = styles_du_svg(source)
    racine = ET.fromstring(source)

    boite = [float(v) for v in racine.get("viewBox", "0 0 100 100").split()]
    largeur, hauteur = boite[2], boite[3]
    fond_page = theme[FOND_SCHEMA[theme_nom]]

    rectangles = []
    for element in racine.iter():
        balise = sans_espace(element.tag)
        if balise == "polygon":
            # Approximation par la boîte englobante : suffisant pour savoir
            # quelle couleur se trouve derrière un texte.
            points = [float(v) for v in re.split(r"[ ,]+", element.get("points", "").strip()) if v]
            if len(points) < 6:
                continue
            xs, ys = points[0::2], points[1::2]
            proprietes = {}
            for c in (element.get("class") or "").split():
                proprietes.update(regles.get(c, {}))
            remplissage = resoudre(proprietes.get("fill", "") or element.get("fill"), theme)
            if not remplissage:
                continue
            opacite = float(element.get("opacity") or proprietes.get("opacity", 1))
            rectangles.append({
                "x": min(xs), "y": min(ys),
                "l": max(xs) - min(xs), "h": max(ys) - min(ys),
                "couleur": poser(remplissage, fond_page, opacite),
                "sommets": list(zip(xs, ys)),
            })
            continue
        if balise != "rect":
            continue
        proprietes = {}
        for c in (element.get("class") or "").split():
            proprietes.update(regles.get(c, {}))
        remplissage = resoudre(proprietes.get("fill", "") or element.get("fill"), theme)
        if not remplissage:
            continue
        opacite = float(element.get("opacity") or proprietes.get("opacity", 1))
        rectangles.append({
            "x": float(element.get("x", 0)), "y": float(element.get("y", 0)),
            "l": float(element.get("width", 0)), "h": float(element.get("height", 0)),
            "couleur": poser(remplissage, fond_page, opacite),
        })

    soucis = []
    for element in racine.iter():
        if sans_espace(element.tag) != "text":
            continue
        contenu = "".join(element.itertext()).strip()
        if not contenu:
            continue

        classes = (element.get("class") or "").split()
        proprietes = {}
        for c in classes:
            proprietes.update(regles.get(c, {}))
        couleur = resoudre(proprietes.get("fill", "") or element.get("fill"), theme)
        if not couleur:
            continue
        taille = float(re.sub(r"[^\d.]", "", element.get("font-size")
                              or proprietes.get("font-size", "16")) or 16)

        x, y = float(element.get("x", 0)), float(element.get("y", 0))
        ancre = element.get("text-anchor", "start")

        # Fond réellement derrière le texte : le dernier rectangle qui le couvre.
        derriere, porteur = fond_page, None
        for r in rectangles:
            if r["x"] <= x <= r["x"] + r["l"] and r["y"] <= y <= r["y"] + r["h"]:
                derriere = r["couleur"]
                porteur = r

        rapport = contraste(couleur, derriere)
        # Un gros texte peut descendre à 3:1, la règle usuelle.
        seuil = 3.0 if taille >= 24 else SEUIL
        if rapport < seuil:
            soucis.append(f"contraste {rapport:.2f} (seuil {seuil}) sur « {contenu[:38]} »")

        # Débordement du cadre. Largeur estimée à .55 em par signe.
        estimee = len(contenu) * taille * .55
        if ancre == "middle":
            gauche = x - estimee / 2
        elif ancre == "end":
            gauche = x - estimee
        else:
            gauche = x
        droite = gauche + estimee
        if droite > largeur + 2:
            soucis.append(f"déborde à droite de {droite - largeur:.0f}px : « {contenu[:30]} »")
        if gauche < -2:
            soucis.append(f"déborde à gauche : « {contenu[:30]} »")

        # Un texte posé sur une forme doit tenir dans la forme, avec une marge
        # de 8px de chaque côté. Pour les polygones, la largeur disponible est
        # celle de la forme à la hauteur exacte du texte, pas celle de sa
        # boîte englobante : le haut d'une pyramide est bien plus étroit.
        if porteur is not None and theme_nom == "lecture":
            if porteur.get("sommets"):
                xs = []
                pts = porteur["sommets"]
                for i in range(len(pts)):
                    (x1, y1), (x2, y2) = pts[i], pts[(i + 1) % len(pts)]
                    if y1 != y2 and min(y1, y2) <= y <= max(y1, y2):
                        xs.append(x1 + (x2 - x1) * (y - y1) / (y2 - y1))
                dispo = (max(xs) - min(xs)) if len(xs) >= 2 else porteur["l"]
            else:
                dispo = porteur["l"]
            if estimee > dispo - 16:
                soucis.append(f"dépasse de sa forme de {estimee - dispo + 16:.0f}px : "
                              f"« {contenu[:34]} »")
        if y > hauteur:
            soucis.append(f"sort du cadre par le bas : « {contenu[:30]} »")
        elif y > hauteur - taille * .35:
            soucis.append(f"collé au bord bas : « {contenu[:30]} »")
    return soucis


# Largeur moyenne d'un signe, en fraction de la taille de police. Le gras et
# la chasse fixe occupent davantage de place.
CHASSE = {"mono": 0.601, "sans": 0.523}


def controler_chevauchements(chemin: Path) -> list[str]:
    """Signale deux textes qui se superposent dans un schéma.

    Le contrôle de contraste ne voit pas ce défaut : deux étiquettes peuvent
    être parfaitement lisibles chacune de son côté et se marcher dessus une
    fois le SVG rendu. C'est le genre d'erreur qui ne saute aux yeux qu'au
    projecteur, devant la classe.
    """
    source = chemin.read_text(encoding="utf-8")
    racine = ET.fromstring(source)
    regles = styles_du_svg(source)
    boites = []
    for el in racine.iter("{http://www.w3.org/2000/svg}text"):
        contenu = "".join(el.itertext()).strip()
        if not contenu:
            continue
        taille, genre, gras = 15.0, "sans", 400
        for classe in (el.get("class") or "").split():
            props = regles.get(classe, {})
            if "font-size" in props:
                taille = float(re.sub(r"[^\d.]", "", props["font-size"]))
            if "mono" in props.get("font-family", ""):
                genre = "mono"
            if props.get("font-weight", "").isdigit():
                gras = max(gras, int(props["font-weight"]))
        if el.get("font-size"):
            taille = float(re.sub(r"[^\d.]", "", el.get("font-size")))
        if (el.get("font-weight") or "").isdigit():
            gras = max(gras, int(el.get("font-weight")))
        large = len(contenu) * taille * CHASSE[genre] * (1.045 if gras >= 600 else 1.0)
        x, y = float(el.get("x", 0)), float(el.get("y", 0))
        ancre = el.get("text-anchor", "start")
        g = x - large / 2 if ancre == "middle" else (x - large if ancre == "end" else x)
        boites.append((g, y - taille * .78, g + large, y + taille * .24, contenu))

    soucis = []
    for i in range(len(boites)):
        for j in range(i + 1, len(boites)):
            a, b = boites[i], boites[j]
            if a[0] < b[2] - 2 and b[0] < a[2] - 2 and a[1] < b[3] - 2 and b[1] < a[3] - 2:
                soucis.append(f"se chevauchent : « {a[4][:32]} » et « {b[4][:32]} »")
    return soucis


def controler_classes_partagees() -> list[str]:
    """Deux schémas qui définissent la même classe se contaminent.

    Les blocs <style> des SVG insérés dans une page sont globaux : la classe
    .e blanche d'un schéma repeint la classe .e noire du schéma voisin. Le
    défaut n'apparaît qu'une fois les deux réunis sur la même fiche, jamais
    dans l'éditeur. Chaque schéma doit donc préfixer ses classes.
    """
    porteurs: dict[str, list[str]] = {}
    for chemin in sorted(SCHEMAS.glob("*.svg")):
        source = chemin.read_text(encoding="utf-8")
        for selecteur in set(re.findall(r"\.([A-Za-z][\w-]*)\s*\{", source)):
            porteurs.setdefault(selecteur, []).append(chemin.name)
    soucis = []
    for selecteur, fichiers in sorted(porteurs.items()):
        if len(fichiers) > 1:
            soucis.append(f"classe .{selecteur} définie dans plusieurs schémas : "
                          + ", ".join(fichiers))
    return soucis


# -------------------------------------------------------------------- palette

COUPLES = [
    ("encadré matière / texte doux", "--matiere-voile", "--encre"),
    ("page / texte", "--fond", "--encre"),
    ("surface / texte", "--surface", "--encre"),
    ("surface / texte doux", "--surface", "--encre-doux"),
    ("surface / crédit", "--surface", "--encre-pale"),
    ("encadré matière / texte", "--matiere-voile", "--encre"),
    ("zone de schéma / texte", "--surface-2", "--encre"),
    ("zone de schéma / matière", "--surface-2", "--matiere"),
]


def controler_palette() -> list[str]:
    soucis = []
    for nom_theme, theme in THEMES.items():
        for libelle, fond, texte in COUPLES:
            r = contraste(theme[fond], theme[texte])
            etat = "ok  " if r >= SEUIL else "FAIBLE"
            print(f"    {etat} {r:5.2f}  {nom_theme:8} {libelle}")
            if r < SEUIL:
                soucis.append(f"{nom_theme} : {libelle} à {r:.2f}")
    return soucis


# -------------------------------------------------------------------- contenu

def controler_contenu() -> list[str]:
    import yaml  # noqa: F401
    soucis = []
    registre_fichier = RACINE / "medias" / "sources.yml"
    if registre_fichier.exists():
        registre = yaml.safe_load(registre_fichier.read_text(encoding="utf-8")) or {}
        fichier_credits = RACINE / "medias" / "credits.yml"
        if fichier_credits.exists():
            for nom, credit in (yaml.safe_load(
                    fichier_credits.read_text(encoding="utf-8")) or {}).items():
                if nom in registre and isinstance(credit, dict):
                    registre[nom].update({c: v for c, v in credit.items() if v})
        for nom, entree in registre.items():
            chemin = RACINE / "medias" / entree.get("fiche", "divers") / nom
            if not chemin.exists():
                if entree.get("source") == "locale":
                    soucis.append(f"carte à déposer à la main : {nom}")
                else:
                    soucis.append(f"image absente : {nom}")
            elif not entree.get("licence"):
                soucis.append(f"crédit incomplet : {nom}")

    # Les pages de contenu/pages/ ne relèvent d'aucune matière : elles ne
    # portent aucun concept du programme, donc rien à valider contre lui.
    for fiche in sorted((RACINE / "contenu").rglob("*.md")):
        if fiche.parent.name == "pages":
            continue
        entete = fiche.read_text(encoding="utf-8").split("---")[1]
        donnees = yaml.safe_load(entete) or {}
        if not donnees.get("concepts_valides"):
            soucis.append(f"{fiche.name} : concepts non validés contre le programme")

    # Une légende sous un schéma qui résume au lieu de nommer, c'est du remplissage.
    for fiche in (RACINE / "contenu").rglob("*.md"):
        texte = fiche.read_text(encoding="utf-8")
        for bloc in re.findall(r"^::: *schema +[\w-]+ *$(.*?)^::: *$", texte,
                               re.MULTILINE | re.DOTALL):
            legende = bloc.strip()
            if legende:
                soucis.append(f"{fiche.name} : légende de schéma à retirer, « {legende[:40]} »")
    return soucis


def controler_variables() -> list[str]:
    """Toute variable utilisée dans un panneau doit exister dans les deux thèmes.

    C'est le contrôle qui manquait : --matiere-voile était bien définie en
    thème clair et redéfinie ailleurs en sombre, mais rien ne garantissait que
    les deux couvraient les mêmes cas. Un encadré finissait pâle sur pâle.
    """
    feuille = (RACINE / "theme" / "style.css").read_text(encoding="utf-8")
    soucis = []

    # Variables employées dans les règles qui ne valent qu'en projection.
    employees = set()
    for regle in re.findall(r"\.panneau[^{]*\{([^}]*)\}", feuille):
        employees |= set(re.findall(r"var\((--[\w-]+)\)", regle))

    # Les variables de police, d'arrondi et d'échelle ne sont pas des couleurs.
    hors_couleur = {"--titre", "--corps", "--donnee", "--rayon", "--echelle",
                    "--large", "--lecture", "--colonne"}
    employees -= hors_couleur

    for nom_theme, theme in THEMES.items():
        for variable in sorted(employees):
            if variable not in theme:
                soucis.append(f"{variable} employée dans le contenu, absente du thème {nom_theme}")
    if not soucis:
        print(f"    ok   {len(employees)} variables de panneau définies dans les deux thèmes")
    return soucis


CLASSES_EMISES = [
    "galerie", "illustration", "figure-legende", "credit", "videos-duo", "source-texte", "cartes", "integration",
    "encadre", "encadre__titre", "schema", "video", "attente-image",
    "visionneuse", "diapo-barre", "jalon", "entete__ligne",
    "repere-ligne", "entete__bas", "pastilles",
    "frise__bascule", "sommaire__bascule", "declencheur", "actions",
    "mascotte", "documents", "galerie",
    "entete--page", "page__corps", "ouverture__acces",
    "matieres__lien--ressources",
]


def controler_classes() -> list[str]:
    """Chaque classe émise par les gabarits ou le générateur doit être stylée.

    C'est le contrôle qui manquait quand les règles de la galerie ont disparu
    de la feuille sans que rien ne le signale : le HTML sortait avec la classe,
    le CSS ne la connaissait pas, la page s'affichait en vrac.
    """
    feuille = (RACINE / "theme" / "style.css").read_text(encoding="utf-8")
    soucis = [f"classe émise mais absente du CSS : .{c}"
              for c in CLASSES_EMISES if f".{c}" not in feuille]
    if not soucis:
        print(f"    ok   {len(CLASSES_EMISES)} classes émises, toutes stylées")
    return soucis


DOCS = RACINE / "docs"


def controler_editorial() -> list[str]:
    """Les conventions éditoriales du README s'appliquent à toutes les fiches.

    Deux règles outillées : les figures se placent en tête de leur bloc
    (outils/figures.py) et les paragraphes courts se regroupent
    (outils/paragraphes.py). Le vérificateur signale toute fiche en écart et
    la commande qui la remet d'aplomb.
    """
    import figures
    import paragraphes
    soucis = []
    for chemin in sorted((RACINE / "contenu").rglob("*.md")):
        for numero, ligne in enumerate(
                chemin.read_text(encoding="utf-8").split("\n"), 1):
            if re.match(r"^[:;!?»%](\s|$)", ligne) and not ligne.startswith(":::"):
                soucis.append(
                    f"ponctuation orpheline en début de ligne "
                    f"({chemin.relative_to(RACINE)}, ligne {numero}) : "
                    f"le moteur markdown la prend pour une liste de définitions")
        n = figures.compter(chemin)
        if n:
            soucis.append(
                f"{n} figure(s) pas en tête de bloc : "
                f"python3 outils/figures.py --appliquer {chemin.relative_to(RACINE)}")
        n = paragraphes.compter(chemin)
        if n:
            soucis.append(
                f"{n} paragraphe(s) courts à regrouper : "
                f"python3 outils/paragraphes.py --appliquer {chemin.relative_to(RACINE)}")
    return soucis



COMPOSANTS = RACINE / "theme" / "composants"


def controler_composants() -> list[str]:
    """Vérifie mécaniquement les conventions des composants interactifs.

    Chaque règle ici vient d'un défaut qui a été signalé au moins une fois.
    Les consigner au README ne suffisait pas : rien ne les vérifiait, et le
    même défaut revenait dans le composant suivant.
    """
    soucis = []
    if not COMPOSANTS.exists():
        return soucis
    for fichier in sorted(COMPOSANTS.glob("*.html")):
        nom = fichier.name
        texte = fichier.read_text(encoding="utf-8")

        # 1. Un titre de niveau 2 ou 3 découpe les blocs du moteur : une
        #    galerie viendrait alors se loger dans le composant.
        for niveau in ("h2", "h3"):
            if re.search(rf"<{niveau}[ >]", texte):
                soucis.append(f"{nom} : contient un <{niveau}>, "
                              f"utiliser <p role=\"heading\" aria-level=\"3\">")

        # 2. Toute liste doit neutraliser les puces du thème, sinon elles
        #    réapparaissent au milieu des jetons et des chronologies.
        if re.search(r"<[uo]l[ >]", texte) or "createElement(\"li\")" in texte or 'el("li"' in texte:
            if "list-style: none" not in texte:
                soucis.append(f"{nom} : contient une liste sans list-style: none")
            if "::marker" not in texte:
                soucis.append(f"{nom} : liste sans neutralisation de ::marker")
            if "li::before" not in texte:
                soucis.append(f"{nom} : liste sans neutralisation de li::before, "
                              f"la puce ronde du thème réapparaît")

        # 3. Deux éléments de texte qui se suivent dans un bouton doivent
        #    être en bloc, sinon ils se chevauchent sur la même ligne.
        paires = re.findall(r'appendChild\(el\("span", "(\w+)__(nom|titre)"[^)]*\)\);\s*'
                            r'\w+\.appendChild\(el\("span", "\w+__(\w+)"', texte)
        for prefixe, _, suivant in paires:
            for classe in (f"{prefixe}__nom", f"{prefixe}__{suivant}"):
                if not re.search(rf"\.{re.escape(classe)} \{{[^}}]*display: block", texte):
                    soucis.append(f"{nom} : .{classe} suit ou précède un autre "
                                  f"texte sans display: block")

        # 4. Un composant qui affiche des images doit gérer leur absence,
        #    sinon la vignette casse tant que le fichier n'est pas récupéré.
        if "<img" in texte and "onerror" not in texte and "est-absent" not in texte:
            soucis.append(f"{nom} : images sans repli en cas d'absence")

        # 5. Le thème sombre doit être prévu pour les bandeaux foncés.
        if "--matiere-fonce" in texte and 'data-sombre="on"' not in texte:
            soucis.append(f"{nom} : fond foncé sans variante pour le thème sombre")
    return soucis


def controler_conventions_fiches() -> list[str]:
    """Contrôle les conventions d'écriture qui se répètent d'une fiche à l'autre."""
    soucis = []
    registre = {}
    fichier_registre = RACINE / "medias" / "sources.yml"
    if fichier_registre.exists():
        registre = yaml.safe_load(fichier_registre.read_text(encoding="utf-8")) or {}
    for chemin in sorted((RACINE / "contenu").rglob("*.md")):
        texte = chemin.read_text(encoding="utf-8")
        court = str(chemin.relative_to(RACINE))

        # Pas de point final après l'intertitre d'un encadré ::: cartes.
        for bloc in re.findall(r"^::: cartes\n(.*?)^:::$", texte, re.M | re.S):
            for titre in re.findall(r"^\*\*([^*]+\.)\*\*", bloc, re.M):
                soucis.append(f"{court} : intertitre de carte avec un point final, "
                              f"« {titre} »")

        # Une légende trop longue dans une colonne étroite allonge la figure
        # et creuse un vide sous le texte : la règle ne vise que ce cadrage.
        for legende, source in re.findall(r"^!\[([^\]]+)\]\(([^)]+)\)", texte, re.M):
            nom_image = source.rsplit("/", 1)[-1]
            if registre.get(nom_image, {}).get("cadrage") == "petit" and len(legende) > 55:
                soucis.append(f"{court} : légende de {len(legende)} caractères "
                              f"pour {nom_image}, en cadrage petit viser 55 au plus")
    return soucis


def controler_construit() -> list[str]:
    """Contrôles structurels sur les pages construites de docs/.

    Chaque duo de vidéos doit contenir exactement deux figures vidéo et rien
    d'autre : ni illustration, ni titre, ni encadré. Ce garde-fou vient d'une
    régression réelle où le jumelage avait englouti des pans entiers de page.
    """
    soucis = []
    if not DOCS.exists():
        return ["docs/ absent : lance build.py avant le vérificateur"]
    for page in sorted(DOCS.rglob("*.html")):
        html = page.read_text(encoding="utf-8")
        for duo in re.findall(r'<div class="videos-duo">(.*?)</div>', html, re.S):
            videos = duo.count('<figure class="video">')
            etranger = ('<figure class="illustration' in duo or "<h2" in duo
                        or "<h3" in duo or '<aside' in duo)
            if videos != 2 or etranger:
                soucis.append(
                    f"duo de vidéos difforme ({videos} vidéo(s)"
                    f"{', contenu étranger' if etranger else ''}) : "
                    f"{page.relative_to(DOCS)}")
    return soucis


def main() -> int:
    print("PALETTE")
    soucis = controler_palette()

    print("\nSCHÉMAS")
    for probleme in controler_classes_partagees():
        print(f"    {probleme}")
        soucis.append(probleme)
    for chemin in sorted(SCHEMAS.glob("*.svg")):
        trouves = []
        for theme in THEMES:
            for probleme in controler_schema(chemin, theme):
                trouves.append(f"{theme} : {probleme}")
        # Indépendant du thème : on ne le fait qu'une fois par schéma.
        trouves += controler_chevauchements(chemin)
        if trouves:
            print(f"    {chemin.name}")
            for t in trouves:
                print(f"        {t}")
            soucis += trouves
        else:
            print(f"    ok   {chemin.name}")

    print("\nCLASSES")
    ratees = controler_classes()
    for r in ratees:
        print(f"    {r}")
    soucis += ratees

    print("\nVARIABLES")
    manquantes_var = controler_variables()
    for m in manquantes_var:
        print(f"    {m}")
    soucis += manquantes_var

    print("\nCONTENU")
    contenu = controler_contenu()
    for c in contenu:
        print(f"    {c}")
    if not contenu:
        print("    ok   rien à signaler")
    soucis += contenu

    print("\nÉDITORIAL")
    editorial = controler_editorial()
    for e in editorial:
        print(f"    {e}")
    if not editorial:
        print("    ok   figures en tête de bloc et paragraphes regroupés")
    soucis += editorial

    print("\nCOMPOSANTS")
    composants = controler_composants()
    for c in composants:
        print(f"    {c}")
    if not composants:
        print("    ok   conventions des composants respectées")
    soucis += composants

    print("\nCONVENTIONS")
    conventions = controler_conventions_fiches()
    for c in conventions:
        print(f"    {c}")
    if not conventions:
        print("    ok   conventions d'écriture respectées")
    soucis += conventions

    print("\nCONSTRUIT")
    construit = controler_construit()
    for c in construit:
        print(f"    {c}")
    if not construit:
        print("    ok   duos de vidéos bien formés")
    soucis += construit

    print(f"\n{len(soucis)} problème(s).")
    return 1 if soucis else 0


if __name__ == "__main__":
    sys.exit(main())
