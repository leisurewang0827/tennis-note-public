# Tennis Note Public Service Export

This folder contains the public-safe Tennis Note service, commerce, legal, and support pages.

Recommended public repository:

- `leisurewang0827/tennis-note-public`

Recommended GitHub Pages URLs after publishing:

- `https://leisurewang0827.github.io/tennis-note-public/`
- `https://leisurewang0827.github.io/tennis-note-public/app/`
- `https://leisurewang0827.github.io/tennis-note-public/commerce.html`
- `https://leisurewang0827.github.io/tennis-note-public/privacy.html`
- `https://leisurewang0827.github.io/tennis-note-public/support.html`
- `https://leisurewang0827.github.io/tennis-note-public/delete-account.html`

Short service URLs:

- Member PWA: `https://tennisnote-app.pages.dev/`
- Administrator web: `https://tennisnote-admin.pages.dev/`

GitHub Pages remains the compatibility deployment for existing store, OAuth,
and policy links. The Cloudflare Pages workflow builds isolated member and
administrator artifacts so their service-worker and browser caches cannot
control each other.

Do not place private member data, payment records, API credentials, login credentials, or server-only keys here.

Files:

- `index.html`
- `commerce.html`
- `privacy.html`
- `support.html`
- `delete-account.html`
- `assets/member-app-login.png`
- `app/` (member app, role-gated coach mode, and public legal pages)
- `export_manifest.json`

The browser client configuration is generated only inside the GitHub Pages
deployment artifact from GitHub Actions secrets. It is not committed to this
repository. Server-only keys and private member data must never be added here.
