# Timetrack launch video

20-second Russian-language landscape film. 1920×1080, 30 fps.

- `brag.mp4`: final H.264/AAC delivery, settled hook poster baked into frame zero.
- `brag.jpg`: full-resolution poster.
- `preview.html`: portable player page.
- `share-copy.txt`: ready-to-post caption.
- `composition/`: editable Hyperframes HTML and local media; CLI pinned to 0.8.96.
- `check-report.json`: validation report.

Run `npm run check` or `npm run render` in `composition/` to validate or render again. The render command creates the video; after a re-render, repeat the poster-baking step from the brag skill if the first-frame poster is desired.

The timesheet adapts the published demonstration at `hosting/timetrack.kz/downloads/primer-tabelya-timetrack.html`, showing the first seven days plus the monthly attendance summary. Names are the source's fictional demonstration names. The tablet and logos are project assets. Fonts reuse this project's existing brag assets. Music: Happy Beats / Business Moves vol.12 by ende.app, supplied with the brag skill. SFX: Kenney CC0, supplied with the brag skill. Tap choreography adapts the installed Hyperframes press-ripple component.

Validation: zero lint errors, zero runtime errors, zero layout findings, zero contrast findings. Six nonblocking lint warnings concern the compact single-file timeline structure and reused image sources. Representative full frames and the exact tap contact were visually inspected.
