@echo off
rem Tout refaire d un double-clic : images, articles, puis reconstruction.
rem Une fois les fichiers pousses sur GitHub, ce script devient optionnel :
rem le site se reconstruit tout seul a chaque push.
rem
rem articles.py --chercher lit les fils de presse, ajoute des propositions
rem dans contenu\articles.yml et retire les liens morts. Une proposition n est
rem publiee que si tu lui as ecrit une phrase dans le champ note.
py outils\images.py
py outils\articles.py --chercher
py build.py
pause
