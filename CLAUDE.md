# CLAUDE.md — VNBABot

Working context for AI sessions. The bot was migrated from Google Sheets to Supabase
Postgres (branch `db-migration`, remote `magicbonsai/VNBABot`).

## Architecture

- **DB access via the shared `@youmkim/vnba-db` package** (Drizzle schema + node-postgres
  client; source of truth lives in `../vnba-app/server/db`). A schema change there must be
  republished (`npm publish` from that dir) and pulled here (`npm update @youmkim/vnba-db`).
- **`app/helpers/dbHelper.js`** is the DB-era replacement for the old `sheetHelper.js` —
  the bot's central data layer. Key helpers: `getCurrentSeasonId`, `getSeasonFlag`
  (typed `season_flags`), `getValidTeams` (`team_seasons ⋈ teams`), `getPlayerSeasons`,
  `loadPlayersWithData` (rebuilds the old "Data" blob), and the WRITE primitives:
  `savePlayerKey`/`savePlayerBlob` (ATTRIBUTES → `player_attributes`, BADGES/HOTZONE/
  TENDENCIES/VITALS → JSONB), `addTeamCash`, `signFreeAgent`, injuries, `createRookie`,
  `saveTrikov`, `assembleTrikovInput`, `appendMiscRow`.
- Every query is scoped by `season_id` (the bot had no season concept on Sheets).
- `DATABASE_URL` lives in `.env` (gitignored). Discord/Twitter creds via env too.

## Migration state

- **All commands/crons/endpoints are on the DB** except: `boxScraper`/`$scrape`
  (intentionally obsolete — the 2kUpdater owns stat capture; kept, not decommissioned),
  and the TriKov R compute (`ex-sync.R`, see below).
- Writes go to the DB; the league's Google Sheets stay authoritative until the offseason
  cutover (then flip + rotate the Google key). Bot writes are part of that transition.
- **triKov**: the bot assembles the R input from the DB (`assembleTrikovInput`) and writes
  results to `player_seasons.trikov_value`/`trikov_detail`. `ex-sync.R` was rewritten to
  consume the passed `.data()` payload but is **UNVERIFIED** (no R runtime in dev) — when
  verifying, reconcile the `"guard/wing/big"` (backfilled `player_type`) vs the R's KNN
  factor levels `c("G","W","B")`.

## Run / test — GOTCHAS

- Default `node` here is 16; `node:test` lacks `test.skip` on 16, and `@youmkim/vnba-db`/
  drizzle want Node 18+ for tooling. Node 20 is at `C:\nvm\v20.20.2\node.exe`.
- Tests: `node --test app/helpers/__tests__/ app/bots/__tests__/`. They include DB
  integration tests gated on `DATABASE_URL`, and **write paths are verified via
  transaction-ROLLBACK** (mutate inside a `db.transaction` that throws → prod untouched).
- The bot has heavy native deps (canvas/sharp/tesseract/ffmpeg). For DB-layer work you can
  `npm install --ignore-scripts` to skip native builds.

## Gotchas learned

- Globals flags are stored lowercase (`"true"/"false"`) in the DB — parse case-insensitively
  (`dbHelper.parseBool`), not `== "FALSE"`.
- `tendencies` JSONB column exists but isn't backfilled (null) → TENDENCIES mutations are
  safe no-ops until an ETL fills it; generated rookies do get tendencies.
- News event weights aren't in the DB → rojBot uses sensible defaults.
