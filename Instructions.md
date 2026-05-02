# Instructions

## App Shell
- Huvudfönstret är uppdelat i titelrad, breadcrumb, innehållsyta och en ikonbar till höger.
- Den aktiva vyn väljs i ikonbaren.
- Breadcrumb har en volymväljare vid root så vänster och höger filpanel kan ligga på olika enheter.

## Files
- Visar filsystemet som ett träd.
- Klick på en fil öppnar den i huvudvyn.
- Klick på en folder navigerar in i den.
- Delete-ikonen längst till höger tar bort filen eller foldern.
- Rename och new file finns i panelhuvudet.
- `..` går upp en nivå.
- Vid root öppnar `..` eller panelens root-trigger enhetsväljaren.
- Filsize visas till höger om varje filrad, och `..` visar totalstorleken för aktuell mapp.

## Split Files
- Transfer-ikonen slår på två filpaneler.
- Vänster och höger panel är lika stora.
- `Up` / `W` flyttar markeringen upp.
- `Down` / `S` flyttar markeringen ner.
- Vänster panel styrs med `WASD`, höger panel med piltangenter.
- Pilen mot den andra panelen kopierar den markerade filen eller foldern dit.
- Pilen bort från den andra panelen flyttar den markerade filen eller foldern dit.
- `Enter` / `q` öppnar markerad fil eller folder i aktuell panel.

## File Viewer
- Visar innehållet i markerad fil i huvudytan.
- Markdown kan växla mellan edit och preview.
- DOCX, EPUB, RTF, PDF, bilder, video och text öppnas i anpassade viewers.
- Vanliga textändelser som `.cjs`, `.mjs`, `.cts`, `.mts`, `.flow`, `.bnf`, `.applescript`, `.mod`, `.sum`, `.md5`, `.map`, `.proto`, `.svelte`, `.iml`, `.plist`, `.mdc`, `.manifest`, `.version`, `.work`, `.m`, `.jsonl`, `.ndjson`, `.tex`, `.bib`, `.bibtex`, `.rmd` och `.qmd` öppnas som text.
- `LICENSE`, `COPYING` och `NOTICE` öppnas också som text även utan filändelse.
- Save skriver tillbaka ändringar i edit-läget.
- MKV provas direkt först och transkodas bara om direktuppspelning misslyckas.
- Okända binärer visas som `No file support for this format.`

## Git
- Visar staged och unstaged ändringar.
- Klick på en fil stage:ar eller unstage:ar den beroende på var den ligger.
- Folder-rader kan vecklas ut.
- Revert-ikonen längst till höger återställer filen eller foldern.
- Push-knappen skickar ändringar till remote.
- Amends kan slå på senaste commit-meddelandet i commitfältet.

## Terminals
- Terminalerna visas som en sidopanel med AI-klienter överst och en sessionslista under.
- Klick på en klient startar en ny session för Codex, Copilot, Claude, Gemini eller Junie.
- En ny session läggs direkt till i sessionslistan med sitt namn.
- Klick på en session växlar main window till den terminalen.
- Main window är terminalytan för den aktiva sessionen.
- Terminalen använder en riktig PTY-baserad terminalrenderer i main window och har dessutom en inputrad längst ner för att skicka en linje.
- Terminalsessioner startar i den folder som breadcrumb visar när de skapas.
- Sidopanelen kan döljas utan att den aktiva terminalsessionen försvinner ur main window.

## Settings
- Här justeras panelbredden.
- Samma bredd används för panelsystemet.

## Breadcrumb
- Visar aktuell sökväg.
- Klick på en crumb navigerar dit.

## Notes
- ZIP-filer kan öppnas som virtuella folders.
- Delete och copy fungerar även för zip-innehåll där det är möjligt.
- EPUB och RTF renderas via pandoc-baserad HTML-preview.
