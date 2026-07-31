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
    },
    "sombre": {
        "--fond": "#10171F", "--surface": "#16202B", "--surface-2": "#1D2935",
        "--trait": "#2C3A48", "--encre": "#F2EFE8", "--encre-doux": "#B4BEC7",
        "--encre-pale": "#8A97A2", "--matiere": "#8FB4DC", "--matiere-fonce": "#B6D0EA",
        "--matiere-voile": "#1E3048", "--signal": "#E5AC44",
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
        if sans_espace(element.tag) != "rect":
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
        gauche = x if ancre == "start" else x - estimee / 2
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
    import yaml
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

    # Une légende sous un schéma qui résume au lieu de nommer, c'est du remplissage.
    for fiche in (RACINE / "contenu").rglob("*.md"):
        texte = fiche.read_text(encoding="utf-8")
        for bloc in re.findall(r"^::: *schema +[\w-]+ *$(.*?)^::: *$", texte,
                               re.MULTILINE | re.DOTALL):
            legende = bloc.strip()
            if legende:
                soucis.append(f"{fiche.name} : légende de schéma à retirer, « {legende[:40]} »")
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
