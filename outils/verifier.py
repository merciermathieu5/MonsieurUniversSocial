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
            remplissage = resoudre(element.get("fill") or proprietes.get("fill", ""), theme)
            if not remplissage:
                continue
            opacite = float(element.get("opacity") or proprietes.get("opacity", 1))
            rectangles.append({
                "x": min(xs), "y": min(ys),
                "l": max(xs) - min(xs), "h": max(ys) - min(ys),
                "couleur": poser(remplissage, fond_page, opacite),
            })
            continue
        if balise != "rect":
            continue
        proprietes = {}
        for c in (element.get("class") or "").split():
            proprietes.update(regles.get(c, {}))
        remplissage = resoudre(element.get("fill") or proprietes.get("fill", ""), theme)
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
        couleur = resoudre(element.get("fill") or proprietes.get("fill", ""), theme)
        if not couleur:
            continue
        taille = float(re.sub(r"[^\d.]", "", element.get("font-size")
                              or proprietes.get("font-size", "16")) or 16)

        x, y = float(element.get("x", 0)), float(element.get("y", 0))
        ancre = element.get("text-anchor", "start")

        # Fond réellement derrière le texte : le dernier rectangle qui le couvre.
        derriere = fond_page
        for r in rectangles:
            if r["x"] <= x <= r["x"] + r["l"] and r["y"] <= y <= r["y"] + r["h"]:
                derriere = r["couleur"]

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
        if y > hauteur:
            soucis.append(f"sort du cadre par le bas : « {contenu[:30]} »")
        elif y > hauteur - taille * .35:
            soucis.append(f"collé au bord bas : « {contenu[:30]} »")
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
        for nom, entree in registre.items():
            chemin = RACINE / "medias" / entree.get("fiche", "divers") / nom
            if not chemin.exists():
                soucis.append(f"image absente : {nom}")
            elif not entree.get("licence"):
                soucis.append(f"crédit incomplet : {nom}")

    # Les images rapatriées de l'ancien Google Site sont tes propres documents :
    # on vérifie leur présence, pas leur licence.
    registre_google = RACINE / "medias" / "google.yml"
    if registre_google.exists():
        registre = yaml.safe_load(registre_google.read_text(encoding="utf-8")) or {}
        for nom, entree in registre.items():
            chemin = RACINE / "medias" / entree.get("fiche", "divers") / nom
            if not chemin.exists():
                soucis.append(f"image absente : {nom}  (py outils\\rapatrier.py)")

    for fiche in sorted((RACINE / "contenu").rglob("*.md")):
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
    "galerie", "illustration", "figure-legende", "figure-role", "credit",
    "encadre", "encadre__titre", "schema", "video", "attente-image",
    "visionneuse", "diapo-barre", "jalon", "entete__ligne",
    "repere-ligne", "entete__bas", "pastilles",
    "frise__bascule", "sommaire__bascule", "declencheur", "actions",
    "mascotte", "documents", "galerie",
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


def main() -> int:
    print("PALETTE")
    soucis = controler_palette()

    print("\nSCHÉMAS")
    for chemin in sorted(SCHEMAS.glob("*.svg")):
        trouves = []
        for theme in THEMES:
            for probleme in controler_schema(chemin, theme):
                trouves.append(f"{theme} : {probleme}")
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

    print(f"\n{len(soucis)} problème(s).")
    return 1 if soucis else 0


if __name__ == "__main__":
    sys.exit(main())
