# forge-growth-partners-site

Static marketing site for Forge Growth Partners, deployed as a Netlify site. Pages are plain HTML at the repository root, with three Netlify Functions behind the forms.

## Repository layout

```
.
├── index.html              Home page
├── about.html
├── contact.html            Calls /.netlify/functions/get-booking-link and /.netlify/functions/submit-contact
├── services.html
├── resources.html
├── gym-analysis.html       Calls /.netlify/functions/get-booking-link and /.netlify/functions/submit-lead
├── privacy-policy.html
├── terms-of-service.html
├── assets/
│   ├── attribution.js
│   ├── jamal-founder.jpg
│   └── jfive-logo.png
├── netlify/
│   └── functions/
│       ├── get-booking-link.js   GET only
│       ├── submit-contact.js     POST only
│       └── submit-lead.js        POST only
├── netlify.toml
└── package.json
```

### netlify.toml

- `[build]` `publish = "."` (the repository root is the site) and `functions = "netlify/functions"`.
- `[functions]` `node_bundler = "esbuild"`.
- One redirect: `/gym-analysis` is served from `/gym-analysis.html` with status 200 (a rewrite, not a redirect).

### package.json

- Name `forge-growth-partners-site`, `private: true`.
- One dependency: `@supabase/supabase-js` (`^2.45.0`).
- No `scripts` section: there is no build script, no test script and no start script.

### Environment variables read by the functions

Names only; values are configured in the Netlify site settings and are not stored in this repository.

| Variable | Read by |
|---|---|
| `SUPABASE_URL` | get-booking-link.js, submit-contact.js, submit-lead.js |
| `SUPABASE_SERVICE_ROLE_KEY` | get-booking-link.js, submit-contact.js, submit-lead.js |
| `INTERNAL_NOTIFY_SECRET` | submit-contact.js, submit-lead.js |

## Local preview

The repository declares no scripts and no dev tooling, so it has **no supported local preview command**. Do not look for `npm run ...`; none exists.

The commands below are **assumptions**. They depend on tools that this repository does not declare, and were not run while writing this README.

- Static pages only (assumption: Python 3 installed on your machine):
  `python3 -m http.server 8000` from the repository root, then open `http://localhost:8000/`. This does not run the functions, so form submissions and the booking link will not work, and the `/gym-analysis` rewrite from `netlify.toml` will not apply (open `/gym-analysis.html` instead).
- Pages plus functions (assumption: Netlify CLI installed separately, and `npm install` run first so `@supabase/supabase-js` is available):
  `netlify dev` from the repository root. The functions need the three environment variables above to be set locally.

## Review and approval handoff

1. Changes are made on a review branch (for example `claude/eos-build-NN`), never directly on `main`.
2. Each change is opened as a draft pull request against `main`. The PR description lists what changed, the checks run with their actual results, and anything not tested.
3. The owner reviews the pull request, including from a phone.
4. Nothing is merged, published or accepted as finished without the owner's separate, explicit approval. Opening a draft PR is not approval to merge or deploy.
