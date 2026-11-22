# ASIA MAI – single-source full-stack prototype

This project starts from `ASIA_MAI_PLZ_Time_regex_fixed(1).zip` and adds a Node.js API and SQLite database. One repository, one `index.html`, one backend.

## Run locally

Requires Node.js 22.13+.

```bash
export ADMIN_KEY="$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")"
npm start
```

Open `http://localhost:3000`. Use the same `ADMIN_KEY` when opening **Management**. Orders are saved in `data/orders.sqlite`. Open the same URL from another device on the same network (using the computer's IP address) to test cross-device orders. Server must be reachable from the device.

## Deploy

**Recommended:** push all source files to the GitHub repository's `main` branch and deploy the same repository to a Node hosting provider with **persistent disk storage**. Set environment variables `ADMIN_KEY` (random >=24 chars), `DB_PATH` (path on persistent disk), and optionally `PORT`. GitHub remains the single source of truth; hosting builds directly from it.

**GitHub Pages alone cannot run Node.js or SQLite.** If retaining GitHub Pages as the frontend, deploy the API separately, set `window.ASIA_API_BASE` in `config.js` to the API's HTTPS URL, and set backend `FRONTEND_ORIGIN` to the exact GitHub Pages origin (e.g. `https://username.github.io`). Both deployments can use the same repository.

## Current scope and critical production gaps

- SQLite persistence, order creation, private tracking status, password-protected management API, and 5-second management polling are implemented.
- PayPal remains disabled. No live payment capture.
- **Do not accept real public orders yet.** Product prices and delivery fees are still sent by the browser and are NOT validated against a server-controlled menu; opening hours, PLZ eligibility, and delivery distance are not authoritatively enforced on the backend. Before launch, implement server-controlled catalog/pricing, exact PLZ allowlist and opening-hours validation (including timezone/DST), HTTPS, stronger admin authentication, rate limiting, backups, and privacy/retention policy.
- Existing localStorage UI remains for backward compatibility, but API orders are authoritative for shared ordering. Old demo orders are not migrated.
- SQLite data must reside on a persistent volume. Without one, orders may be lost on redeploy.
