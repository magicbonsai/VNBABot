/**
 * dbHelper — the DB-era replacement for the bot's Google Sheets access.
 *
 * The bot used to open one Google Spreadsheet per season (via GOOGLE_SHEETS_KEY)
 * and read/write tabs. The data now lives in Supabase Postgres, accessed through
 * the SHARED `@vnba/db` package (the same Drizzle schema + node-postgres client
 * the web app uses). This module centralizes:
 *
 *   1. the shared client      (getDb)
 *   2. the new "current season" concept the bot never had (getCurrentSeasonId)
 *   3. the common reads        (getPlayerSeasons, getValidTeams, getTeamDictionary)
 *   4. the un-normalized rows   (getMiscRows / getSeasonFlag) that still live as
 *      raw JSONB in `misc_sheet_rows` (Globals, Team Assets, Available Coaches, …)
 *
 * Every query is scoped by season_id — resolve it once per job with
 * getCurrentSeasonId() and thread it through. Sheets were one-doc-per-season;
 * Postgres is one DB for all 34, so season scoping is mandatory.
 */

const { db, schema } = require("@vnba/db");
const { eq, and, inArray, desc } = require("drizzle-orm");

const {
  seasons,
  teams,
  players,
  playerSeasons,
  miscSheetRows,
  seasonFlags,
  teamSeasons,
} = schema;

// The misc_sheet_rows.sheet values are the original spreadsheet TAB TITLES, not
// the sheetHelper gid-keys. Map the logical name the bot uses -> the DB string.
const MISC_SHEETS = {
  globals: "Globals",
  teamAssets: "Team Assets",
  retiredPlayers: "Retired Players",
  availableCoaches: "Available Coaches",
  offseasonTraining: "Offseason Training",
  tradeBlock: "Trade Block",
};

/** Lenient truthiness for the stringly-typed sheet values ("TRUE"/"true"/"1"). */
function parseBool(v) {
  if (v === true) return true;
  if (v === false || v === null || v === undefined) return false;
  return ["true", "1", "yes", "y"].includes(String(v).trim().toLowerCase());
}

/** The shared { db, schema } client. */
function getDb() {
  return { db, schema };
}

// ---- current season -------------------------------------------------------
let _seasonCache = { id: null, at: 0 };
const SEASON_TTL_MS = 5 * 60 * 1000;

/**
 * Resolve the current season's surrogate id (seasons.is_current = true).
 * Cached for SEASON_TTL_MS so a burst of cron/command queries doesn't re-hit it;
 * pass { force: true } right after a season rollover.
 */
async function getCurrentSeasonId({ force = false } = {}) {
  const now = Date.now();
  if (!force && _seasonCache.id && now - _seasonCache.at < SEASON_TTL_MS) {
    return _seasonCache.id;
  }
  const rows = await db
    .select({ id: seasons.id })
    .from(seasons)
    .where(eq(seasons.isCurrent, true))
    .limit(1);
  if (!rows.length) {
    throw new Error("dbHelper: no current season (seasons.is_current = true)");
  }
  _seasonCache = { id: rows[0].id, at: now };
  return rows[0].id;
}

// ---- un-normalized JSONB rows (misc_sheet_rows) ---------------------------

/**
 * Raw rows for an un-normalized sheet, ordered by original row index.
 * @param sheet logical key (see MISC_SHEETS) or the raw DB sheet title.
 * @returns array of the original row objects (the `raw` JSONB).
 */
async function getMiscRows(sheet, { seasonId } = {}) {
  const sid = seasonId || (await getCurrentSeasonId());
  const sheetName = MISC_SHEETS[sheet] || sheet;
  const rows = await db
    .select({ raw: miscSheetRows.raw })
    .from(miscSheetRows)
    .where(
      and(eq(miscSheetRows.seasonId, sid), eq(miscSheetRows.sheet, sheetName))
    )
    .orderBy(miscSheetRows.rowIndex);
  return rows.map((r) => r.raw);
}

/**
 * Read a feature flag as a real boolean from the typed `season_flags` table
 * (normalized out of the old Globals tab).
 * @returns true/false for boolean flags, null when the flag carries a
 *          non-boolean value OR doesn't exist for the season. Callers that need
 *          to distinguish "off" from "absent" should query the row directly.
 */
async function getSeasonFlag(name, { seasonId } = {}) {
  const sid = seasonId || (await getCurrentSeasonId());
  const rows = await db
    .select({ value: seasonFlags.value })
    .from(seasonFlags)
    .where(and(eq(seasonFlags.seasonId, sid), eq(seasonFlags.name, name)))
    .limit(1);
  if (!rows.length) return null;
  return rows[0].value;
}

// ---- teams ----------------------------------------------------------------

/**
 * Per-season team lookup maps, resolving the name<->id mismatch in one place.
 * @returns { byName: Map(lowerName->id), byId: Map(id->name), bySlug: Map }
 */
async function getTeamDictionary() {
  const rows = await db
    .select({ id: teams.id, name: teams.name, slug: teams.slug, isReal: teams.isReal })
    .from(teams);
  const byName = new Map();
  const byId = new Map();
  const bySlug = new Map();
  for (const t of rows) {
    byName.set(t.name.toLowerCase(), t.id);
    byId.set(t.id, t.name);
    if (t.slug) bySlug.set(t.slug, t.id);
  }
  return { byName, byId, bySlug, rows };
}

/**
 * The non-frozen, real teams for the season — the bot's "valid teams" filter
 * (was: Team Assets rows where Real==='TRUE' && Frozen!=='TRUE'). Now a typed
 * join: teams.is_real (cross-season identity) + team_seasons.is_frozen + cash.
 * Verified to return the same set as the old Sheets filter.
 */
async function getValidTeams({ seasonId } = {}) {
  const sid = seasonId || (await getCurrentSeasonId());
  const rows = await db
    .select({
      teamId: teams.id,
      name: teams.name,
      slug: teams.slug,
      cash: teamSeasons.cash,
      cashNextSeason: teamSeasons.cashNextSeason,
      isFrozen: teamSeasons.isFrozen,
      primaryColor: teams.primaryColor,
      logo: teams.logoUrl,
    })
    .from(teamSeasons)
    .innerJoin(teams, eq(teams.id, teamSeasons.teamId))
    .where(
      and(
        eq(teamSeasons.seasonId, sid),
        eq(teamSeasons.isFrozen, false),
        eq(teams.isReal, true),
      ),
    );
  return rows.map((r) => ({
    ...r,
    cash: r.cash != null ? Number(r.cash) : null,
    cashNextSeason: r.cashNextSeason != null ? Number(r.cashNextSeason) : null,
  }));
}

// ---- players --------------------------------------------------------------

/**
 * Current-season roster query (player_seasons -> players -> teams), the hot path
 * that replaces every players.getRows(). Filters are optional and AND-ed.
 *
 * @param opts.seasonId       defaults to current season
 * @param opts.teamStatuses   e.g. ['ROSTERED'] — filter player_seasons.team_status
 * @param opts.teamIds        restrict to these team ids
 * @param opts.minAge         age >= n
 */
async function getPlayerSeasons(opts = {}) {
  const sid = opts.seasonId || (await getCurrentSeasonId());
  const conds = [eq(playerSeasons.seasonId, sid)];
  if (opts.teamStatuses && opts.teamStatuses.length) {
    conds.push(inArray(playerSeasons.teamStatus, opts.teamStatuses));
  }
  if (opts.teamIds && opts.teamIds.length) {
    conds.push(inArray(playerSeasons.teamId, opts.teamIds));
  }

  const rows = await db
    .select({
      playerSeasonId: playerSeasons.id,
      playerId: players.id,
      fullName: players.fullName,
      displayInitial: players.displayInitial,
      imageUrl: players.imageUrl,
      teamId: playerSeasons.teamId,
      teamName: teams.name,
      teamStatus: playerSeasons.teamStatus,
      status: playerSeasons.status,
      overall: playerSeasons.overall,
      position: playerSeasons.position,
      age: playerSeasons.age,
      salary: playerSeasons.salary,
      tendency: playerSeasons.tendency,
    })
    .from(playerSeasons)
    .innerJoin(players, eq(players.id, playerSeasons.playerId))
    .leftJoin(teams, eq(teams.id, playerSeasons.teamId))
    .where(and(...conds));

  const minAge = opts.minAge;
  return minAge != null ? rows.filter((r) => r.age != null && r.age >= minAge) : rows;
}

module.exports = {
  getDb,
  getCurrentSeasonId,
  getMiscRows,
  getSeasonFlag,
  getTeamDictionary,
  getValidTeams,
  getPlayerSeasons,
  parseBool,
  MISC_SHEETS,
};
