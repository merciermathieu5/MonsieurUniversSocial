@echo off
rem Tout refaire d un double-clic : images manquantes puis reconstruction.
rem Une fois les images presentes et poussees sur GitHub, ce script devient
rem optionnel : le site se reconstruit tout seul a chaque push.
py outils\images.py
py build.py
pause
