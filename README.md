# Email Template Builder

A lightweight, frontend-only visual email builder. Build an email from blocks, preview it on desktop and mobile, and export clean, table-based, inline-CSS HTML for any email platform. No backend, database, accounts or paid services.

Production URL: <https://email-generator.farhan.app>

## Features

- **Blocks:** heading, text (with `**bold**`, `__italic__`, `[links](https://…)`), image, button, divider, spacer. Add by click or drag, reorder by drag, toolbar or keyboard (`Alt+↑/↓`), duplicate, delete.
- **Image library:** paste an image URL, see a live preview (with loading/error states), add it to the email or save it to the project's library. Per-image width, alignment, padding, corner radius, alt text and link.
- **Styling:** content width, page/email backgrounds, default font, text/heading/link colours, per-block font, size, colour, alignment, padding, background; button fill, border, radius, padding, full-width.
- **Live preview:** Edit canvas plus a true Preview (the exported HTML in an iframe) in Desktop and Mobile widths.
- **Export:** copy or download self-contained HTML, with a pre-export check (missing image URLs/alt text, buttons without links, `http://` images, Gmail's 102 KB clipping limit).
- **Projects:** autosaved to `localStorage`; starter templates (blank, welcome, editorial newsletter, bold promo, dark product launch, event invitation, personal letter); undo/redo; JSON import/export as a backup.
- **Accessible:** semantic landmarks, labelled controls, ARIA tabs/dialogs/live regions, full keyboard operation of the canvas, visible focus, reduced-motion support.
- **Responsive UI:** three panels on desktop; on screens under 1024px they become Add / Canvas / Settings views with a bottom bar.

### Keyboard shortcuts (canvas)

| Key | Action |
| --- | --- |
| `↑` / `↓`, `Home` / `End` | Move selection between blocks |
| `Alt+↑` / `Alt+↓` | Move the selected block |
| `Enter` | Edit the selected block's settings |
| `Ctrl/Cmd+D` | Duplicate block |
| `Delete` | Delete block |
| `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` | Undo / redo (outside text fields) |

## Project layout

```
public/               # the whole site – deployed as-is (no build step)
  index.html
  css/styles.css
  js/
    main.js           # bootstrap + wiring (dialogs, persistence, export)
    blocks.js         # block types, field schema, document model + validation
    render.js         # email HTML generation (pure functions, shared by canvas/preview/export)
    store.js          # document store, undo/redo, selection
    storage.js        # localStorage persistence with in-memory fallback
    templates.js      # starter templates
    ui/               # canvas, settings panel, form controls, library, toasts
  _headers            # Cloudflare Pages security headers (CSP etc.)
tests/                # unit tests for the generator (node:test, no dependencies)
scripts/serve.mjs     # zero-dependency local dev server
wrangler.toml         # optional, for CLI deploys
```

## Develop locally

Requires Node 18+ only to run the dev server and tests; the app itself has no dependencies or build step.

```sh
npm start        # http://localhost:8788  (serves public/ with the production CSP)
npm test         # unit tests for HTML generation, sanitising and import validation
```

Any static server pointed at `public/` also works.

## Deploy to Cloudflare Pages (free tier)

These steps need to be done once, manually, in the Cloudflare dashboard:

1. **Create the project:** Cloudflare dashboard → *Workers & Pages* → *Create* → *Pages* → *Connect to Git* → select this repository (authorise the Cloudflare GitHub app if prompted).
2. **Build settings:**
   - Production branch: `main`
   - Framework preset: `None`
   - Build command: *(leave empty)*
   - Build output directory: `public`
3. **Save and Deploy.** Every push to `main` now redeploys automatically; other branches get preview URLs.
4. **Custom domain:** in the Pages project → *Custom domains* → *Set up a custom domain* → `email-generator.farhan.app`. If `farhan.app` is a zone in the same Cloudflare account, the required `CNAME email-generator → <project>.pages.dev` record is created automatically; otherwise add that CNAME (proxied) in your DNS yourself. SSL is issued automatically.

Alternative (CLI, no Git integration): `npx wrangler pages deploy public --project-name email-generator`.

`public/_headers` adds a strict Content-Security-Policy (scripts and styles from the same origin only; images allowed from any `https:` host so users' own image URLs work) and other hardening headers.

## Email-client compatibility notes

The generator follows established HTML-email practice, but it has **not** been tested in real mail clients from this repository. Test your final send in your ESP's preview tool or a service like Litmus / Email on Acid.

- Layout is nested `role="presentation"` tables with inline CSS and `bgcolor` attributes; one `<style>` block holds resets and a single `@media (max-width: 620px)` rule set (clients that strip `<style>` still show a correct, fluid desktop layout).
- Outlook (Windows, Word engine): a conditional ghost table fixes the content width; buttons use the padding + `mso-padding-alt` technique so they keep their size. Rounded corners and `border-radius` on images are ignored by Outlook and degrade to square.
- Images need absolute `https://` URLs hosted somewhere reachable by recipients; many clients block images by default, so always provide alt text.
- The email is marked light-only (`color-scheme`), but some clients apply their own dark-mode colour inversion.
- Gmail clips messages over ~102 KB; the export dialog warns you.
- Starter templates use `placehold.co` placeholder images purely as sample content — replace them with your own image URLs.
- Merge tags such as `{{ first_name }}` or `*|FNAME|*` can be typed into text and link fields and are passed through unchanged. Link destinations beginning with `javascript:`, `data:` etc. are rejected.

## Data & privacy

Everything runs in the browser. Projects live in this browser's `localStorage` only (clearing site data deletes them — use *Projects → Export current as JSON* for backups). Image URLs are loaded directly from their hosts to show previews.
