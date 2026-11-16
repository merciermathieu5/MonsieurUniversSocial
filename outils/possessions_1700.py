"""Calque « Les possessions vers 1700 » de la carte du traité de Tordesillas.

    py outils\\possessions_1700.py            # construit le calque et en fait le bilan
    py outils\\possessions_1700.py --ecrire   # le réécrit dans theme/composants/tordesillas.html

Les zones reprennent celles de la fiche d'activités « Possessions coloniales vers
1700 » (onze zones numérotées, plus les possessions néerlandaises en gris). Elles
sont données ici en longitude et latitude, puis découpées par la côte même du
composant : le calque colle au pixel près au fond de carte, sans retouche.

Hors des Amériques, seules les quatre métropoles sont colorées, d'après les
frontières actuelles de Natural Earth (domaine public). Les Grands Lacs et
quelques grands lacs naturels sont ajoutés pour situer la Nouvelle-France.

Dépendance : shapely (pip install shapely). Les fichiers de Natural Earth sont
téléchargés une seule fois dans extraction/natural-earth/, dossier non versionné.
Après --ecrire : node outils/test_tordesillas.js, puis python build.py.
"""
import json
import re
import sys
import urllib.request
from pathlib import Path

try:
    from shapely import set_precision
    from shapely.geometry import Point, Polygon, shape
    from shapely.geometry.polygon import orient
    from shapely.ops import linemerge, transform, unary_union
except ImportError:
    sys.exit("Ce script demande shapely : pip install shapely")

RACINE = Path(__file__).resolve().parent.parent
COMPOSANT = RACINE / "theme" / "composants" / "tordesillas.html"
CACHE = RACINE / "extraction" / "natural-earth"
SOURCE_NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"

LARGEUR, HAUTEUR = 1000, 702
LIMITE_AMERIQUES = -32  # longitude : à l'ouest, les Amériques; à l'est, le voile de l'Ancien Monde


def px(lon, lat):
    """Projection du composant : équirectangulaire, 6 px par degré, coin à 110° O et 60° N."""
    return ((lon + 110) * 6, (60 - lat) * 6)


def anneau_px(anneau):
    return Polygon([px(lon, lat) for lon, lat in anneau]).buffer(0)


def projeter(geom):
    return transform(lambda x, y, z=None: px(x, y), geom)


# --------------------------------------------------------------- les zones de la fiche
# id : (puissance, nom, anneaux). Les tracés passent souvent en mer : seule la terre compte.
ZONES = {
    "rupert": ("angleterre", "Terre de Rupert", [[
        [-72.61, 50.92], [-75.01, 49.62], [-77.41, 48.51], [-79.81, 48.62], [-83.01, 49.31], [-86.51, 49.61],
        [-90.52, 48.52], [-93.21, 47.91], [-95.32, 46.61], [-97.62, 45.81], [-100.52, 48.21], [-104.02, 49.61],
        [-112.03, 49.31], [-114.53, 50.51], [-117.53, 52.51], [-112.53, 55.51], [-110.03, 58.52], [-109.03, 61.02],
        [-106.03, 63.81], [-100.04, 64.82], [-92.02, 65.52], [-86.02, 65.02], [-78.01, 62.72], [-70.01, 61.72],
        [-64.6, 60.42], [-64.61, 58.52], [-65.31, 55.62], [-67.5, 54.32], [-70.21, 52.61]]]),
    "nouvelle-france": ("france", "Nouvelle-France", [[
        [-57.0, 51.52], [-61.5, 51.91], [-66.01, 52.21], [-69.01, 51.91], [-70.21, 52.61], [-72.61, 50.92],
        [-75.01, 49.62], [-77.41, 48.51], [-79.81, 48.62], [-83.01, 49.31], [-86.51, 49.61], [-90.52, 48.52],
        [-93.21, 47.91], [-95.32, 46.61], [-97.62, 45.81], [-100.52, 48.21], [-104.02, 49.61], [-112.03, 49.31],
        [-113.23, 48.21], [-112.73, 46.51], [-111.23, 44.61], [-109.83, 43.01], [-107.22, 41.21], [-106.12, 39.21],
        [-105.22, 36.0], [-104.02, 35.01], [-103.02, 34.0], [-101.52, 33.01], [-99.02, 32.51], [-96.02, 32.5],
        [-94.21, 31.3], [-93.81, 29.7], [-91.01, 28.61], [-88.01, 29.9], [-88.01, 30.41], [-88.22, 31.51],
        [-87.52, 34.01], [-85.51, 34.81], [-84.01, 35.51], [-82.61, 36.31], [-80.81, 37.2], [-79.81, 38.51],
        [-79.2, 39.61], [-78.61, 41.81], [-77.61, 42.21], [-76.01, 42.31], [-75.0, 42.91], [-74.61, 43.41],
        [-73.4, 43.61], [-72.01, 44.72], [-71.2, 45.31], [-70.31, 45.91], [-69.8, 44.61], [-69.81, 43.51],
        [-66.51, 43.61], [-63.0, 43.31], [-59.4, 45.61], [-60.3, 47.01], [-59.8, 48.41], [-58.6, 49.62],
        [-57.41, 51.21]]]),
    "colonies-anglaises": ("angleterre", "Colonies anglaises", [[
        [-70.31, 45.91], [-71.2, 45.31], [-72.01, 44.72], [-73.4, 43.61], [-74.61, 43.41], [-75.0, 42.91],
        [-76.01, 42.31], [-77.61, 42.21], [-78.61, 41.81], [-79.2, 39.61], [-79.81, 38.51], [-80.81, 37.2],
        [-82.61, 36.31], [-84.01, 35.51], [-83.31, 34.81], [-82.21, 33.6], [-81.11, 32.11], [-79.0, 31.51],
        [-74.01, 35.01], [-69.01, 40.51], [-69.01, 43.41], [-69.81, 43.51], [-69.8, 44.61]]]),
    "floride": ("espagne", "Floride", [[
        [-81.41, 31.05], [-84.61, 31.06], [-87.51, 31.01], [-87.42, 30.11], [-85.51, 29.21], [-83.21, 28.2],
        [-82.0, 24.6], [-80.01, 24.91], [-79.61, 27.0], [-80.61, 30.61]]]),
    "nouvelle-espagne": ("espagne", "Nouvelle-Espagne", [[
        [-124.63, 40.41], [-120.02, 38.51], [-114.53, 37.01], [-110.02, 37.51], [-106.32, 38.01], [-105.62, 37.4],
        [-105.22, 36.0], [-104.02, 35.01], [-103.02, 34.0], [-101.52, 33.01], [-99.02, 32.51], [-96.02, 32.5],
        [-94.21, 31.3], [-93.81, 29.7], [-93.51, 27.0], [-91.01, 24.0], [-86.51, 21.6], [-87.01, 18.5],
        [-87.81, 16.0], [-84.01, 15.9], [-82.91, 15.0], [-83.21, 11.0], [-82.0, 9.4], [-79.51, 9.9], [-77.41, 8.7],
        [-77.91, 7.2], [-80.51, 6.8], [-92.51, 13.8], [-100.02, 15.8], [-106.02, 20.2], [-110.02, 22.6],
        [-113.02, 24.8], [-117.36, 29.72], [-121.02, 33.8], [-125.03, 40.0]]]),
    "perou": ("espagne", "Vice-royauté du Pérou", [[
        [-77.41, 8.7], [-77.01, 8.9], [-75.61, 10.8], [-72.01, 12.6], [-70.0, 12.3], [-68.0, 11.0], [-66.0, 10.9],
        [-64.0, 10.76], [-62.6, 10.8], [-61.95, 10.78], [-61.82, 10.7], [-62.1, 10.35], [-61.92, 9.98],
        [-61.01, 9.78], [-59.81, 8.4], [-61.5, 7.0], [-64.51, 6.3], [-67.61, 6.0], [-68.51, 3.5], [-70.01, 2.0],
        [-73.5, -1.0], [-74.51, -4.0], [-73.01, -7.5], [-70.0, -10.0], [-66.5, -11.01], [-63.51, -13.0],
        [-60.0, -15.51], [-58.4, -18.01], [-57.5, -20.5], [-55.5, -22.21], [-53.5, -23.41], [-49.6, -28.61],
        [-48.9, -28.96], [-48.0, -30.51], [-52.5, -35.01], [-56.01, -35.61], [-56.5, -36.61], [-58.5, -36.31],
        [-62.0, -36.31], [-65.5, -35.52], [-69.01, -35.81], [-71.01, -36.61], [-72.01, -37.31], [-73.81, -37.31],
        [-75.01, -30.01], [-77.0, -15.01], [-82.0, -6.01], [-81.51, 1.0], [-78.8, 6.8], [-77.91, 7.2]],
        # Valdivia et Chiloé, au sud des terres mapuches
        [[-73.71, -39.52], [-72.9, -39.61], [-72.81, -40.32], [-73.41, -42.32], [-73.3, -43.21], [-74.41, -43.61],
         [-74.61, -41.72], [-73.8, -40.31]]]),
    "bresil": ("portugal", "Brésil", [[
        [-47.99, 0.2], [-50.3, -0.2], [-51.4, -0.6], [-52.6, -0.7], [-54.1, -1.2], [-55.51, -1.1], [-56.7, -1.8],
        [-58.4, -2.3], [-60.0, -2.31], [-60.9, -3.1], [-60.0, -3.9], [-58.4, -3.9], [-56.7, -3.4], [-55.5, -2.7],
        [-54.1, -2.8], [-52.6, -2.3], [-51.4, -2.2], [-50.6, -2.41], [-49.6, -4.0], [-47.2, -5.6], [-44.6, -7.6],
        [-44.2, -10.61], [-45.2, -14.01], [-46.2, -17.01], [-47.6, -19.61], [-49.2, -21.21], [-51.8, -22.61],
        [-52.3, -25.01], [-49.6, -28.61], [-48.9, -28.96], [-47.5, -28.51], [-39.99, -23.51], [-37.99, -16.0],
        [-33.99, -7.01], [-34.99, -4.5], [-41.0, -2.2], [-44.0, -1.5]]]),
    "guyane": ("france", "Guyane", [[
        [-54.0, 5.8], [-54.45, 4.8], [-54.0, 2.3], [-52.8, 2.2], [-52.0, 3.2], [-51.65, 4.15], [-51.0, 5.0],
        [-52.5, 6.3], [-53.9, 6.2]]]),
}
# Possessions des Provinces-Unies, en gris sur la fiche
GRIS = {
    "suriname": ("Suriname", [[-56.9, 6.1], [-54.1, 6.1], [-54.05, 5.6], [-54.41, 5.2], [-55.2, 5.0], [-57.01, 5.8]]),
    "berbice": ("Berbice et Essequibo", [[-58.9, 7.4], [-57.16, 6.6], [-57.15, 5.9], [-57.8, 5.95], [-58.6, 6.3], [-59.0, 6.9]]),
}
# Saint-Domingue : l'ouest à la France (reconnu en 1697), l'est à l'Espagne
SAINT_DOMINGUE_OUEST = [[-74.7, 17.8], [-74.7, 19.2], [-73.6, 20.0], [-72.5, 20.3], [-71.75, 20.2], [-71.7, 18.4], [-71.6, 17.4]]
SAINT_DOMINGUE_EST = [[-71.75, 20.2], [-68.0, 20.0], [-68.0, 17.4], [-71.6, 17.4], [-71.7, 18.4]]
# Îles des Antilles assez grandes pour figurer sur la carte : (nom, puissance, forme).
# La Dominique, laissée aux Kalinagos en 1660, reste blanche. Sainte-Lucie est
# une colonie de la couronne de France depuis 1674.
ILES = [
    ("Porto Rico", "espagne", ("cercle", -66.5, 18.2, 1.0)),
    ("Margarita", "espagne", ("cercle", -64.0, 11.0, 0.4)),
    ("Trinidad", "espagne", ("cercle", -61.3, 10.45, 0.8)),
    ("Jamaïque", "angleterre", ("cercle", -77.3, 18.1, 1.3)),
    ("Bahamas", "angleterre", ("anneau", [[-79.6, 27.5], [-76.5, 27.4], [-72.6, 22.9], [-71.0, 21.7], [-71.0, 20.9],
                                          [-73.6, 20.6], [-75.9, 22.2], [-78.6, 23.2], [-79.8, 25.6]])),
    ("Bermudes", "angleterre", ("cercle", -64.78, 32.3, 0.4)),
    ("Barbade", "angleterre", ("cercle", -59.55, 13.15, 0.3)),
    ("Guadeloupe", "france", ("cercle", -61.55, 16.2, 0.6)),
    ("Sainte-Lucie", "france", ("cercle", -60.95, 13.9, 0.3)),
    ("La Gonâve", "france", ("cercle", -73.05, 18.85, 0.35)),
    ("Cuba", "espagne", ("anneau", [[-85.1, 21.9], [-84.0, 23.0], [-80.5, 23.4], [-77.0, 22.4], [-74.0, 20.4],
                                    [-74.2, 19.8], [-77.8, 19.6], [-80.5, 21.3], [-83.2, 21.2], [-85.1, 21.4]])),
]
METROPOLES = {"espagne": ("Espagne", ["ESX", "ESI"]), "portugal": ("Portugal", ["PRX"]),
              "france": ("France", ["FXX"]), "angleterre": ("Angleterre", ["ENG", "WLS"])}
LACS = {"Lake Superior", "Lake Michigan", "Lake Huron", "Lake Erie", "Lake Ontario", "Lake Winnipeg",
        "Lago de Nicaragua", "Lago Titicaca"}
ORDRE = ["rupert", "nouvelle-france", "colonies-anglaises", "floride", "nouvelle-espagne", "perou", "bresil", "guyane",
         "suriname", "berbice", "ile-cuba", "saint-domingue-ouest", "saint-domingue-est", "ile-porto-rico", "ile-jamaique",
         "ile-bahamas", "ile-bermudes", "ile-barbade", "ile-guadeloupe", "ile-sainte-lucie", "ile-trinidad", "ile-margarita",
         "metropole-espagne", "metropole-portugal", "metropole-france", "metropole-angleterre", "autochtones"]


def natural_earth(nom):
    CACHE.mkdir(parents=True, exist_ok=True)
    fichier = CACHE / f"{nom}.geojson"
    if not fichier.exists():
        print(f"    téléchargement de {nom}")
        with urllib.request.urlopen(SOURCE_NE + nom + ".geojson", timeout=120) as r:
            fichier.write_bytes(r.read())
    return json.loads(fichier.read_text(encoding="utf-8"))


def anneaux_svg(d):
    """Lit un chemin SVG fait de M, l et z (le format du composant)."""
    jetons = re.findall(r"[MmLlZz]|[-+]?(?:\d+\.\d*|\.\d+|\d+)", d)
    anneaux, courant, x, y, cmd, i = [], [], 0.0, 0.0, None, 0
    while i < len(jetons):
        t = jetons[i]
        if t in "MmLlZz":
            cmd, i = t, i + 1
            if cmd in "Zz":
                if courant:
                    anneaux.append(courant)
                courant = []
            continue
        a, b = float(jetons[i]), float(jetons[i + 1])
        i += 2
        if cmd in "Mm":
            if courant:
                anneaux.append(courant)
            x, y = (a, b) if cmd == "M" else (x + a, y + b)
            courant = [(x, y)]
            cmd = "l" if cmd == "m" else "L"
        elif cmd == "L":
            x, y = a, b
            courant.append((x, y))
        else:
            x, y = x + a, y + b
            courant.append((x, y))
    if courant:
        anneaux.append(courant)
    return anneaux


# --------------------------------------------------------------- encodage, comme le reste du composant
def _nettoyer(points):
    sortie = []
    for p in points:
        q = (int(round(p[0])), int(round(p[1])))
        if not sortie or q != sortie[-1]:
            sortie.append(q)
    if len(sortie) > 1 and sortie[0] == sortie[-1]:
        sortie.pop()
    change = True
    while change and len(sortie) > 3:
        change = False
        for i in range(len(sortie)):
            a, b, c = sortie[i - 1], sortie[i], sortie[(i + 1) % len(sortie)]
            if (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) == 0 and \
               (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) >= 0:
                sortie.pop(i)
                change = True
                break
    return sortie


def _chemin(points, ferme=True):
    if ferme:
        pts = _nettoyer(points)
        if len(pts) < 3:
            return ""
    else:
        pts = []
        for x, y in points:
            q = (int(round(x)), int(round(y)))
            if not pts or q != pts[-1]:
                pts.append(q)
        if len(pts) < 2:
            return ""
    d = "M%d,%dl" % pts[0]
    for k in range(1, len(pts)):
        dx, dy = pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]
        d += ("" if k == 1 or dx < 0 else " ") + str(dx) + ("," if dy >= 0 else "") + str(dy)
    return d + ("z" if ferme else "")


def chemin_surface(g):
    if g.is_empty:
        return ""
    g = set_precision(g.buffer(0), 1.0)
    morceaux = []
    for p in getattr(g, "geoms", [g]):
        if p.geom_type != "Polygon" or p.area < 0.6:
            continue
        p = orient(p, 1.0)
        morceaux.append(_chemin(list(p.exterior.coords)))
        morceaux += [_chemin(list(t.coords)) for t in p.interiors if Polygon(t).area >= 0.6]
    return "".join(morceaux)


def chemin_lignes(g):
    if g.is_empty:
        return ""
    g = linemerge(set_precision(g, 1.0))
    lignes = [g] if g.geom_type == "LineString" else [x for x in getattr(g, "geoms", []) if x.geom_type == "LineString"]
    return "".join(_chemin(list(l.coords), ferme=False) for l in lignes if l.length >= 1)


# --------------------------------------------------------------- construction
def construire(source):
    m = re.search(r'<path class="tds__terre"[^>]* d="([^"]+)"', source)
    if not m:
        sys.exit("Chemin tds__terre introuvable dans le composant.")
    polys = [Polygon(a) for a in anneaux_svg(m.group(1)) if len(a) >= 3]
    # Un anneau contenu dans un plus grand est un trou (la mer Caspienne).
    trous = {i for i, p in enumerate(polys)
             if any(j != i and q.area > p.area and q.contains(p.representative_point()) for j, q in enumerate(polys))}
    morceaux = []
    for i, p in enumerate(polys):
        if i in trous:
            continue
        rp = p.representative_point()
        morceaux.append({"geom": p.buffer(0), "lon": rp.x / 6 - 110, "lat": 60 - rp.y / 6, "aire": p.area})
    terre = unary_union([x["geom"] for x in morceaux]).difference(unary_union([polys[i].buffer(0) for i in trous]))

    def inhabitee(x):  # Galápagos, Malouines, Géorgie du Sud : personne n'y vit vers 1700
        lon, lat = x["lon"], x["lat"]
        return (-92.5 < lon < -88.5 and -2 < lat < 1.5) or (-62 < lon < -57 and -53 < lat < -50.5) \
            or (-39 < lon < -34 and -56 < lat < -53)

    ameriques = unary_union([x["geom"] for x in morceaux if x["lon"] < LIMITE_AMERIQUES and not inhabitee(x)])
    ancien_monde = unary_union([x["geom"] for x in morceaux if x["lon"] >= LIMITE_AMERIQUES])
    lacs = unary_union([projeter(shape(f["geometry"])).buffer(0) for f in natural_earth("ne_50m_lakes")["features"]
                        if f["properties"].get("name") in LACS]).intersection(ameriques)

    zones = {}
    for zid, (puissance, nom, anneaux) in ZONES.items():
        zones[zid] = [puissance, nom, unary_union([anneau_px(a) for a in anneaux]).intersection(ameriques)]
    gris = unary_union([anneau_px(a) for _, a in GRIS.values()]).intersection(ameriques)
    for z in zones.values():
        z[2] = z[2].difference(gris)
    suriname = anneau_px(GRIS["suriname"][1]).intersection(ameriques)
    zones["suriname"] = ["autres", GRIS["suriname"][0], suriname]
    zones["berbice"] = ["autres", GRIS["berbice"][0], anneau_px(GRIS["berbice"][1]).intersection(ameriques).difference(suriname)]

    formes = [(nom, puissance, Point(px(f[1], f[2])).buffer(f[3] * 6) if f[0] == "cercle" else anneau_px(f[1]))
              for nom, puissance, f in ILES]
    par_ile, hispaniola = {}, None
    for x in morceaux:
        if not (-86 < x["lon"] < -59 and 9.5 < x["lat"] < 33):
            continue
        if -74.6 < x["lon"] < -68.2 and 17.5 < x["lat"] < 20.1 and x["aire"] > 100:
            hispaniola = x["geom"]
            continue
        rp = Point(px(x["lon"], x["lat"]))
        for nom, puissance, forme in formes:
            if forme.contains(rp):
                par_ile.setdefault((nom, puissance), []).append(x["geom"])
                break
    for (nom, puissance), geoms in par_ile.items():
        if nom != "La Gonâve":
            zid = "ile-" + nom.lower().replace(" ", "-").replace("ï", "i").replace("â", "a")
            zones[zid] = [puissance, nom, unary_union(geoms)]
    gonave = unary_union(par_ile.get(("La Gonâve", "france"), []))
    zones["saint-domingue-ouest"] = ["france", "Saint-Domingue (partie ouest)",
                                     unary_union([hispaniola.intersection(anneau_px(SAINT_DOMINGUE_OUEST)), gonave])]
    zones["saint-domingue-est"] = ["espagne", "Saint-Domingue (partie est)", hispaniola.intersection(anneau_px(SAINT_DOMINGUE_EST))]

    # Métropoles : élargies vers la mer seulement, pour couvrir la côte simplifiée du composant.
    pays = {}
    for f in natural_earth("ne_50m_admin_0_map_subunits")["features"]:
        g = shape(f["geometry"])
        if g.bounds[0] < 60 and g.bounds[2] > -40 and g.bounds[1] < 75:
            pays[f["properties"]["SU_A3"]] = projeter(g).buffer(0)
    for puissance, (nom, codes) in METROPOLES.items():
        propre = unary_union([pays[c] for c in codes])
        autres = unary_union([g for c, g in pays.items() if c not in codes])
        zones["metropole-" + puissance] = [puissance, nom, propre.buffer(4).difference(autres).intersection(ancien_monde)]

    colore = unary_union([z[2] for z in zones.values()])
    zones["autochtones"] = ["autochtones", "Territoires autochtones", ameriques.difference(colore).difference(lacs)]
    for zid, z in zones.items():
        if not zid.startswith("metropole"):
            z[2] = z[2].difference(lacs)

    # Limites intérieures seulement : ni les côtes ni le tour des lacs.
    cote = terre.boundary.buffer(0.35).union(lacs.boundary.buffer(0.35))
    limites = unary_union([z[2].boundary.difference(cote) for zid, z in zones.items() if zid != "autochtones"])

    manquants = set(ORDRE) ^ set(zones)
    if manquants:
        sys.exit(f"Zones inattendues ou manquantes : {sorted(manquants)}")
    x_voile = int(px(LIMITE_AMERIQUES, 0)[0])
    lignes = ['<g class="tds__possessions" data-tds="possessions">',
              f'<rect class="tds__voile" x="{x_voile}" y="0" width="{LARGEUR - x_voile}" height="{HAUTEUR}" clip-path="url(#tds-clip-terre)"/>',
              f'<path class="tds__lacs" d="{chemin_surface(lacs)}"/>']
    for zid in ORDRE:
        puissance, nom, geom = zones[zid]
        lignes.append(f'<path class="tds__possession tds__possession--{puissance}" data-possession="{puissance}" '
                      f'data-zone="{zid}" d="{chemin_surface(geom)}"><title>{nom}</title></path>')
        print(f"    {zid:22} {puissance:12} {round(geom.area):6} px²")
    lignes.append(f'<path class="tds__limites" d="{chemin_lignes(limites)}"/>')
    lignes.append("</g>")
    return lignes


def main():
    brut = COMPOSANT.read_bytes().decode("utf-8")
    fin_ligne = "\r\n" if "\r\n" in brut else "\n"
    source = brut.replace("\r\n", "\n")
    bloc = "\n".join(construire(source)) + "\n"
    print(f"    calque : {len(bloc)} octets")
    if "--ecrire" not in sys.argv:
        return
    motif = re.compile(r'<g class="tds__possessions"[^>]*>.*?</g>\n', re.DOTALL)
    if motif.search(source):
        source = motif.sub(lambda _: bloc, source, count=1)
    else:
        source = source.replace('</g>\n<g data-tds="voyages"></g>', '</g>\n' + bloc + '<g data-tds="voyages"></g>', 1)
    COMPOSANT.write_bytes(source.replace("\n", fin_ligne).encode("utf-8"))
    print(f"    écrit dans {COMPOSANT.relative_to(RACINE)}")


if __name__ == "__main__":
    main()
