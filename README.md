# Mason Wheare, personal site

A one-screen portfolio laid out like a PSP-era game menu: silver menu bars on the left (About, Experience, Work, Skills, Contact) with sub-items, a crystal cursor, a details box, a live TIME strip (Melbourne time) and a PLAYER strip. The artwork on the right is a live WebGL scene in the style of late-90s Bryce renders: a marble pavilion with a mirror checkerboard floor, a hanging crystal and a sea of stratified white cliffs. Picking a section moves the camera to its shot, ending on the pavilion at dusk. On phones it's one screen too: title, scene, then the menu at the bottom. Tapping a section swaps the list for its items (with a back arrow), tapping an item slides the details up in a sheet, and the phone's back gesture closes the sheet, then the section, before it leaves the site. Mouse, touch and keyboard all work (arrows, Enter, Esc).

Every section and item has its own address to share, for example `masonwgit.github.io/#experience/captain` or `#work/chase`, and the back button steps back through them. Menu sounds are made in the browser and stay off until someone presses SOUND (desktop), which is remembered. A tiny blurred still of the pavilion shows while the 3D loads. Work cards have preview images in `public/work/`; the home-screen icon and manifest are in `public/`. The scene is original (built from code, no images or models), inspired by the reference render rather than copied from it.

It only draws when something moves (a camera move, a resize, a click on the crystal), so it uses no GPU while you read. The sky is baked once at load, reflections run at half resolution, and the pixel ratio is capped at 1.25.

## Run it

```bash
npm install
npm run dev        # http://localhost:3400
npm run build      # static site in dist/
npm run preview    # serve dist/ on http://localhost:3401
```

Handy URL switches while working on it:

- `?still&item=2` opens menu item 2 and parks the camera on its shot (0 About, 1 Experience, 2 Work, 3 Skills, 4 Contact)
- `?debug` exposes the scene as `window.pv` in the console
- `?nogl` shows the no-WebGL fallback (the poster image)

## Where things live

- `index.html`: all the words. The menu buttons and the cards in the details box share a `data-card` name, and each main bar's `data-shot` picks its camera shot.
- `src/scene/path.js`: one camera shot per section (position, look-at point, field of view) and its caption name.
- `src/scene/looks.js`: the day and dusk lighting the page drifts between.
- `src/scene/pavilion.js`, `props.js`, `terrain.js`, `water.js`, `sky.js`: the scene itself. Marble, checkerboards and cliff strata are drawn in shaders (`materials.js`), so there are no texture files.
- `src/ui.js`: the menu (highlight, open, keyboard, cursor), the card swapping, the camera calls and the clock.
- `public/poster.jpg` and `public/og.jpg`: renders used when WebGL isn't available and as the link preview.

## To confirm before it goes live

- LinkedIn link is `linkedin.com/in/mason-wheare`, taken from the 2025 site.
- Degree name: shown as Bachelor of Cyber Security.
- Dates: General Committee 2026, Director of Marketing from Nov 2026, VCE 2023 to 2025, School Captain 2022.
- Pharmacy Assistant (from Jan 2024) and KFC (2023): still accurate, and still wanted?
- Team name NoRISCNoReward: is that the official name for the ADF Cyber Skills Challenge?
- MineGuard AI (uni group project) and Instagram: keep or drop?
- No email shown yet. No résumé PDF yet.
- Kea Ridge card has no link until its domain is live.
- Left out from the 2025 site: Young Liberals and primary school.

## Deploying

Live at https://masonwgit.github.io (GitHub Pages, served from the `main` branch).

- This folder is the `source` branch of the `masonwgit/masonwgit.github.io` repo. Commit and push changes there as normal.
- `npm run deploy` builds the site and publishes `dist/` to `main`, which is what GitHub Pages serves. Give it a minute to update.
- `public/.nojekyll` stops GitHub running Jekyll over the build.
