# Connected & community apps — principles

Decisions from the 2026-08-08 TRMNL plugin-ecosystem review (21 plugin settings
pages, the recipes surface, and the private-plugin documentation), applied to
SuperClock's admin redesign. Board artifacts: **Admin Panel** page — "Template
v2 — connected + community" section (`124:949`), all-apps config (`115:937`),
inventory table (`97:719`). Companion planning docs: [foundation.md](foundation.md)
(v1, largely as-built), the fleet-first redesign wireframes (board only, so far).

## Why this doc

Our 13 bundled apps exercise a narrow settings vocabulary (strings, enums,
numbers, booleans, arrays). The moment an app talks to an external account
(Now Playing), takes user credentials (any API-key service), or is authored by
someone who isn't us (community screens), the schema-form needs a wider
vocabulary and the platform needs rules about where secrets live. TRMNL's
ecosystem — 86 plugin guides, community recipes with fork counts in the
thousands — is the reference model for what that vocabulary must cover.

The core observation: **TRMNL's private-plugin `settings.yml` form builder is
architecturally identical to our zod schema-form.** Declarative field spec →
generated settings UI. We are not adopting a new architecture for connected and
community apps; we are extending the field vocabulary of the one we have.

## Auth stance (ordered preference)

1. **Public-URL integrations first.** If a provider exposes public shareable
   URLs (iCloud shared albums, published ICS, RSS/status pages), use them —
   zero credentials, zero expiry handling. This is TRMNL's Apple Photos trick
   and already our Calendar model.
2. **Token-paste second.** A user-supplied API key / PAT in a masked field.
   Matches our existing server-proxy pattern (`GITHUB_TOKEN` → `/api/github`),
   generalized to per-instance secrets.
3. **OAuth last.** Only where the provider permits a LAN/localhost redirect
   URI (`http://fastclock.local:3000/...`). The connect flow runs against the
   device server, which stores and refreshes the token; the browser only ever
   sees link-state.

## Secrets rule (hard)

Secrets never enter `fleet.json` or any `/api/device/config` payload —
fleet.json is synced, pushed, cached in localStorage on kiosks, and generally
treated as non-sensitive. Per-instance secrets live in a server-side store on
the admin host (sibling of `config/admin.json`; same file-permissions posture),
keyed by instance id. Instance config carries only a reference
(`secretRef: '<ulid>'`). The admin UI renders a masked `set · rotate` state and
never round-trips the value. `VITE_`-prefix rules from CLAUDE.md continue to
apply — nothing secret is ever bundled.

## Widget kit v2 (additions to schema-form)

Existing (v1, shipped or on branch `claude/kind-sinoussi-3202f5`): text /
url / time / color, number, enum (segmented ≤3, select >3), boolean, `showIf`,
list editor, ordered multi-select. Planned-trivial: date (Countdown).

New, in priority order:

| Widget | Trigger | Notes |
|---|---|---|
| textarea | multi-line content fields (Notes-style content, prompts) | optional markdown flag + preview |
| secret | any token-paste integration | masked, write-only, `set · rotate`, server-side store |
| connect-account | OAuth integrations | two states: connect CTA / linked-as + disconnect; row, not page |
| dynamic-select | options depend on a connection (device list, calendar list) | disabled + hint until linked; options served by device server |
| tabbed groups | forms > ~8 fields | group names from field meta; flat groups remain the default |
| danger toggle | any validation/safety bypass | yellow framing + explicit consequence copy |
| docs row | every app with a guide | link from app metadata |
| code/JSON | advanced escape hatch (filters, templates) | inline validation, `{{var}}` template hints; always paired with a simple-mode alternative |
| advanced-mode toggle | expert field replaces simple field | Notion "use JSON sorts" pattern |
| save-then-configure | provider needs a persisted instance before dependent config | banner state on the dependent field |

Rendering rule carried over from v1: unimplemented options render **disabled
with their schema-meta note**, never hidden, never silently broken.

## Custom Screen — the community on-ramp

The private-plugin analog, as a single built-in app (`custom-screen`):

- **Data**: poll URL (device server fetches, honest test-fetch tell: last
  status/size/age) or webhook push (`/api/custom/<instance>`); last-good cache
  with an amber stale chip on failure — the honest-offline rule, unchanged.
- **Template**: declarative layout JSON (rows/labels/big-numbers/rings binding
  `{{data}}` paths) rendered by one generic kiosk component — deliberately the
  same spec family as the planned LVGL face-spec, so a community screen can
  eventually reach `superclock-slow` too. A visual layout picker is the
  simple mode; raw JSON is the advanced mode.
- **Settings**: ordinary `app.custom-screen` schema — the whole admin surface
  comes free from the template.
- **Not in scope**: arbitrary community React code in the kiosk bundle. A
  community screen is data + declarative layout, not code execution.

## The recipe seam

Before any marketplace: **export/import instance config as JSON** from the
Screen Config footer. A shared Custom Screen config file *is* a recipe
(TRMNL's most-forked community plugin has 2,618 forks — sharing, not a store,
is the mechanism). Provenance badges — `built-in` / `community` / `3rd-party`
— appear in the catalog and the config header.

## Explicitly not copied from TRMNL

- Cloud-side PNG rendering and per-device pixel validation — our kiosks run
  live React at 60fps; there is no render farm and no reason for one.
- Refresh-rate economics (battery e-ink constraints don't apply to mains-powered
  Pis).
- A hosted marketplace — revisit only if config-file sharing proves insufficient.
