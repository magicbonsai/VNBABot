/**
 * dbHelper — the DB-era replacement for the bot's Google Sheets access.
 *
 * The bot used to open one Google Spreadsheet per season (via GOOGLE_SHEETS_KEY)
 * and read/write tabs. The data now lives in Supabase Postgres, accessed through
 * the SHARED `@youmkim/vnba-db` package (the same Drizzle schema + node-postgres client
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

const { db, schema } = require("@youmkim/vnba-db");
const { eq, and, inArray, desc, sql } = require("drizzle-orm");

const {
  seasons,
  teams,
  players,
  playerSeasons,
  playerAttributes,
  attributeDefinitions,
  miscSheetRows,
  seasonFlags,
  teamSeasons,
  injuries,
  games,
  playerAdvancedStats,
  draftPicks,
} = schema;

// The bot's rich-data tabs map to different DB stores: ATTRIBUTES is the
// normalized player_attributes table; the rest are JSONB columns on player_seasons.
const JSONB_TAB_COLUMN = {
  BADGES: "badges",
  HOTZONE: "hotzones",
  TENDENCIES: "tendencies",
  VITALS: "vitals",
};

// The misc_sheet_rows.sheet values are the original spreadsheet TAB TITLES, not
// the sheetHelper gid-keys. Map the logical name the bot uses -> the DB string.
const MISC_SHEETS = {
  globals: "Globals",
  teamAssets: "Team Assets",
  retiredPlayers: "Retired Players",
  availableCoaches: "Available Coaches",
  offseasonTraining: "Offseason Training",
  tradeBlock: "Trade Block",
  // Append-only / streamer-sync sheets — kept as raw JSONB for now (not yet
  // backfilled; the bot writes to them, the streamer workflow is likely dead).
  news: "News",
  updates: "Roj Updates",
  requestQueue: "Request Queue",
  reportArchive: "Report Archive",
  generatedPlayers: "Generated Players", // rookie-generation staging buffer
};

/** "Leah James" -> "L. James" (display initial for new identities). */
function nameToInitial(name) {
  if (!name) return null;
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}

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

/** Like getMiscRows but keeps each row's id/rowIndex (for update/delete). */
async function getMiscRowsWithMeta(sheet, { seasonId } = {}) {
  const sid = seasonId || (await getCurrentSeasonId());
  const sheetName = MISC_SHEETS[sheet] || sheet;
  return db
    .select({ id: miscSheetRows.id, rowIndex: miscSheetRows.rowIndex, raw: miscSheetRows.raw })
    .from(miscSheetRows)
    .where(and(eq(miscSheetRows.seasonId, sid), eq(miscSheetRows.sheet, sheetName)))
    .orderBy(miscSheetRows.rowIndex);
}

/** Delete a misc_sheet_rows row by id (e.g. a consumed staging row). */
async function deleteMiscRowById(id, { exec = db } = {}) {
  await exec.delete(miscSheetRows).where(eq(miscSheetRows.id, id));
}

/**
 * Read a feature flag as a real boolean from the typed `season_flags` table
 * (normalized out of the old Globals tab).
 * @returns true/false for boolean flags, null when the flag carries a
 *          non-boolean value OR doesn't exist for the season. Callers that need
 *          to distinguish "off" from "absent" should query the row directly.
 */
async function getSeasonFlag(name, { seasonId, exec = db } = {}) {
  const sid = seasonId || (await getCurrentSeasonId());
  const rows = await exec
    .select({ value: seasonFlags.value })
    .from(seasonFlags)
    .where(and(eq(seasonFlags.seasonId, sid), eq(seasonFlags.name, name)))
    .limit(1);
  if (!rows.length) return null;
  return rows[0].value;
}

/**
 * Upsert a typed season flag (keyed on the unique (season_id, name) index).
 * Boolean flags go in `value`; a non-boolean keeps its string in `raw_value`.
 * Used to record once-per-season events like `retirementProcessed`. Accepts an
 * optional executor (tx) so a caller can set it inside the same transaction.
 */
async function setSeasonFlag(name, value, { seasonId, rawValue, exec = db } = {}) {
  const sid = seasonId || (await getCurrentSeasonId());
  const isBool = typeof value === "boolean";
  const row = {
    value: isBool ? value : null,
    rawValue: rawValue ?? (isBool ? null : String(value)),
    updatedAt: new Date(),
  };
  await exec
    .insert(seasonFlags)
    .values({ seasonId: sid, name, ...row })
    .onConflictDoUpdate({
      target: [seasonFlags.seasonId, seasonFlags.name],
      set: row,
    });
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

// ---- player rich-data: load/save adapter -----------------------------------
// The bot's event logic operates on the old Player List "Data" blob — a
// [{ module, tab, data }] array. These helpers reconstruct that shape from the
// normalized DB (so the intricate event/clamp logic ports unchanged) and write
// single key mutations back to the correct store.

/** Build the old Data-blob array from a player's normalized fields. */
function buildDataBlob({ attributes, badges, hotzones, tendencies, vitals }) {
  return [
    { module: "PLAYER", tab: "VITALS", data: vitals || {} },
    { module: "PLAYER", tab: "ATTRIBUTES", data: attributes || {} },
    { module: "PLAYER", tab: "BADGES", data: badges || {} },
    { module: "PLAYER", tab: "HOTZONE", data: hotzones || {} },
    { module: "PLAYER", tab: "TENDENCIES", data: tendencies || {} },
  ];
}

/**
 * Load players for a season as old-style rows the report/event logic understands:
 * { Name, Team, Age, playerSeasonId, teamId, teamStatus, Data: blob }.
 * Team is the team name for rostered players, "FA"/"Rookie" otherwise.
 */
async function loadPlayersWithData({ seasonId, teamStatuses } = {}) {
  const sid = seasonId || (await getCurrentSeasonId());
  const conds = [eq(playerSeasons.seasonId, sid)];
  if (teamStatuses && teamStatuses.length) {
    conds.push(inArray(playerSeasons.teamStatus, teamStatuses));
  }
  const rows = await db
    .select({
      playerSeasonId: playerSeasons.id,
      playerId: players.id,
      name: players.fullName,
      teamId: playerSeasons.teamId,
      teamName: teams.name,
      teamStatus: playerSeasons.teamStatus,
      age: playerSeasons.age,
      contractLength: playerSeasons.contractLength,
      retiring: playerSeasons.retiring,
      badges: playerSeasons.badges,
      hotzones: playerSeasons.hotzones,
      tendencies: playerSeasons.tendencies,
      vitals: playerSeasons.vitals,
    })
    .from(playerSeasons)
    .innerJoin(players, eq(players.id, playerSeasons.playerId))
    .leftJoin(teams, eq(teams.id, playerSeasons.teamId))
    .where(and(...conds));

  const ids = rows.map((r) => r.playerSeasonId);
  const attrRows = ids.length
    ? await db
        .select({
          psId: playerAttributes.playerSeasonId,
          code: playerAttributes.attrCode,
          value: playerAttributes.value,
        })
        .from(playerAttributes)
        .where(inArray(playerAttributes.playerSeasonId, ids))
    : [];
  const attrByPs = new Map();
  for (const a of attrRows) {
    if (!attrByPs.has(a.psId)) attrByPs.set(a.psId, {});
    attrByPs.get(a.psId)[a.code] = a.value;
  }

  return rows.map((r) => ({
    Name: r.name,
    Team:
      r.teamStatus === "FA"
        ? "FA"
        : r.teamStatus === "ROOKIE"
        ? "Rookie"
        : r.teamName,
    Age: r.age,
    ContractLength: r.contractLength,
    Retiring: r.retiring,
    playerSeasonId: r.playerSeasonId,
    playerId: r.playerId,
    teamId: r.teamId,
    teamStatus: r.teamStatus,
    Data: buildDataBlob({
      attributes: attrByPs.get(r.playerSeasonId) || {},
      badges: r.badges,
      hotzones: r.hotzones,
      tendencies: r.tendencies,
      vitals: r.vitals,
    }),
  }));
}

/**
 * Write a single rich-data key for one player to the correct store.
 * ATTRIBUTES -> player_attributes (upsert; ensures the attribute_definitions FK
 * exists). BADGES/HOTZONE/TENDENCIES -> jsonb_set on the matching JSONB column.
 * `value` is the already-clamped numeric value. Accepts an optional drizzle
 * executor (tx) so callers can batch in a transaction.
 */
async function savePlayerKey(playerSeasonId, tab, key, value, exec = db) {
  if (tab === "ATTRIBUTES") {
    await exec
      .insert(attributeDefinitions)
      .values({ code: key, displayName: key, isCurated: false })
      .onConflictDoNothing();
    await exec
      .insert(playerAttributes)
      .values({ playerSeasonId, attrCode: key, value })
      .onConflictDoUpdate({
        target: [playerAttributes.playerSeasonId, playerAttributes.attrCode],
        set: { value },
      });
    return;
  }
  const col = JSONB_TAB_COLUMN[tab];
  if (!col || col === "vitals") {
    throw new Error(`savePlayerKey: unsupported tab "${tab}"`);
  }
  await exec
    .update(playerSeasons)
    .set({
      [col]: sql`jsonb_set(coalesce(${playerSeasons[col]}, '{}'::jsonb), ${sql`ARRAY[${key}]`}::text[], to_jsonb(${value}::numeric), true)`,
      updatedAt: new Date(),
    })
    .where(eq(playerSeasons.id, playerSeasonId));
}

// ---- free agency -----------------------------------------------------------

/** Current-season free agents that carry a contract_offer JSONB. */
async function getFreeAgentsWithOffers({ seasonId } = {}) {
  const sid = seasonId || (await getCurrentSeasonId());
  return db
    .select({
      playerSeasonId: playerSeasons.id,
      playerId: players.id,
      fullName: players.fullName,
      contractOffer: playerSeasons.contractOffer,
    })
    .from(playerSeasons)
    .innerJoin(players, eq(players.id, playerSeasons.playerId))
    .where(
      and(
        eq(playerSeasons.seasonId, sid),
        eq(playerSeasons.teamStatus, "FA"),
        sql`${playerSeasons.contractOffer} is not null`
      )
    );
}

/**
 * Sign a free agent atomically: move the player to the team + apply the contract,
 * and debit the team's cash, in one transaction (was a non-transactional
 * player.save() + Team Assets cell edit that could half-fail).
 */
async function signFreeAgent(
  playerSeasonId,
  { teamId, salary, contractLength, loyalty, contractOffer, seasonId, exec } = {}
) {
  const sid = seasonId || (await getCurrentSeasonId());
  const run = async (tx) => {
    await tx
      .update(playerSeasons)
      .set({
        teamId,
        teamStatus: "ROSTERED",
        salary: salary != null ? String(salary) : null,
        contractLength: contractLength ?? null,
        loyalty: loyalty ?? null,
        contractOffer: contractOffer ?? null,
        signed: true,
        updatedAt: new Date(),
      })
      .where(eq(playerSeasons.id, playerSeasonId));
    await addTeamCash(teamId, -Number(salary || 0), { seasonId: sid, exec: tx });
  };
  // Use the caller's transaction if given (tests roll back); else our own.
  return exec ? run(exec) : db.transaction(run);
}

// ---- rookie promotion ------------------------------------------------------

/**
 * Promote one generated/staged rookie into real rows: players (new identity) +
 * player_seasons (ROOKIE, age 0) + player_attributes/JSONB (via savePlayerBlob),
 * all in one transaction. Deduped by name within the season so re-running won't
 * create duplicate identities. `staged` is a Generated Players staging row; its
 * Values field is the standard {module,tab,data}[] blob.
 */
async function createRookie(staged, { seasonId, exec } = {}) {
  const sid = seasonId || (await getCurrentSeasonId());
  const name = staged.Name;
  const blob =
    typeof staged.Values === "string" ? JSON.parse(staged.Values) : staged.Values;
  const vitals = (blob.find((t) => t.tab === "VITALS") || {}).data || {};

  const run = async (tx) => {
    const existing = await tx
      .select({ id: playerSeasons.id })
      .from(playerSeasons)
      .innerJoin(players, eq(players.id, playerSeasons.playerId))
      .where(
        and(
          eq(playerSeasons.seasonId, sid),
          sql`lower(${players.fullName}) = lower(${name})`
        )
      )
      .limit(1);
    if (existing.length) return { skipped: true, name };

    const [p] = await tx
      .insert(players)
      .values({ fullName: name, displayInitial: nameToInitial(name) })
      .returning({ id: players.id });
    const [ps] = await tx
      .insert(playerSeasons)
      .values({
        seasonId: sid,
        playerId: p.id,
        teamStatus: "ROOKIE",
        age: 0,
        position: vitals.POSITION ?? null,
        secondaryPosition: vitals.SECONDARY_POSITION ?? null,
      })
      .returning({ id: playerSeasons.id });
    await savePlayerBlob(ps.id, blob, { exec: tx });
    return { skipped: false, name, playerId: p.id, playerSeasonId: ps.id };
  };
  return exec ? run(exec) : db.transaction(run);
}

// ---- injuries --------------------------------------------------------------

/** Record an injury (injuries table) and mark the player_season's status. */
async function addInjury(playerSeasonId, injury, { exec = db } = {}) {
  const { injuryName, durationGames, dnp, affectedLow, affectedHigh, startedDate, raw } = injury;
  await exec.insert(injuries).values({
    playerSeasonId,
    injuryName,
    durationGames,
    dnp: !!dnp,
    affectedLow: affectedLow ?? null,
    affectedHigh: affectedHigh ?? null,
    startedDate: startedDate || null,
    active: true,
    raw: raw || null,
  });
  await exec
    .update(playerSeasons)
    .set({ status: injuryName, updatedAt: new Date() })
    .where(eq(playerSeasons.id, playerSeasonId));
}

/** Active injuries for the season, joined to player/team. */
async function getActiveInjuries({ seasonId } = {}) {
  const sid = seasonId || (await getCurrentSeasonId());
  return db
    .select({
      injuryId: injuries.id,
      playerSeasonId: injuries.playerSeasonId,
      injuryName: injuries.injuryName,
      durationGames: injuries.durationGames,
      startedDate: injuries.startedDate,
      playerName: players.fullName,
      teamId: playerSeasons.teamId,
      teamName: teams.name,
    })
    .from(injuries)
    .innerJoin(playerSeasons, eq(playerSeasons.id, injuries.playerSeasonId))
    .innerJoin(players, eq(players.id, playerSeasons.playerId))
    .leftJoin(teams, eq(teams.id, playerSeasons.teamId))
    .where(and(eq(injuries.active, true), eq(playerSeasons.seasonId, sid)));
}

/** Mark an injury resolved and set the player back to HEALTHY. */
async function clearInjury(injuryId, playerSeasonId, { exec = db } = {}) {
  await exec.update(injuries).set({ active: false }).where(eq(injuries.id, injuryId));
  await exec
    .update(playerSeasons)
    .set({ status: "HEALTHY", updatedAt: new Date() })
    .where(eq(playerSeasons.id, playerSeasonId));
}

/** Count a team's games on/after `sinceDate` (ISO string) — replaces the old
 *  Schedule-sheet date counting for injury expiry. */
async function countTeamGamesSince(teamId, sinceDate, { seasonId } = {}) {
  if (teamId == null) return 0;
  const sid = seasonId || (await getCurrentSeasonId());
  const conds = [
    eq(games.seasonId, sid),
    sql`(${games.homeTeamId} = ${teamId} or ${games.awayTeamId} = ${teamId})`,
  ];
  if (sinceDate) conds.push(sql`${games.gameDate} >= ${sinceDate}`);
  const rows = await db.select({ n: sql`count(*)` }).from(games).where(and(...conds));
  return Number(rows[0].n);
}

/**
 * Append a raw row to an un-normalized sheet (Roj Updates, Request Queue,
 * Report Archive). Allocates the next row_index for (season, sheet). Not
 * concurrency-safe, which is fine for the single-process, low-volume bot.
 */
async function appendMiscRow(sheet, raw, { seasonId } = {}) {
  const sid = seasonId || (await getCurrentSeasonId());
  const sheetName = MISC_SHEETS[sheet] || sheet;
  const max = await db
    .select({ m: sql`coalesce(max(${miscSheetRows.rowIndex}), -1)` })
    .from(miscSheetRows)
    .where(and(eq(miscSheetRows.seasonId, sid), eq(miscSheetRows.sheet, sheetName)));
  const nextIdx = Number(max[0].m) + 1;
  await db
    .insert(miscSheetRows)
    .values({ seasonId: sid, sheet: sheetName, rowIndex: nextIdx, raw });
}

/**
 * Persist a whole mutated Data blob (all tabs) for one player — used by the
 * offseason batch (multi-key boosts/declines). ATTRIBUTES upsert into
 * player_attributes; BADGES/HOTZONE/TENDENCIES/VITALS replace the JSONB column.
 */
async function savePlayerBlob(playerSeasonId, blob, { exec = db } = {}) {
  for (const tab of blob) {
    if (!tab || !tab.data) continue;
    if (tab.tab === "ATTRIBUTES") {
      for (const [code, value] of Object.entries(tab.data)) {
        const v = parseInt(value);
        if (Number.isNaN(v)) continue;
        await savePlayerKey(playerSeasonId, "ATTRIBUTES", code, v, exec);
      }
    } else if (JSONB_TAB_COLUMN[tab.tab]) {
      // Drop any "NaN" entries (a delta applied to a key the player lacks) so we
      // never poison the JSONB column.
      const clean = {};
      for (const [k, v] of Object.entries(tab.data)) {
        if (v === "NaN" || (typeof v === "number" && Number.isNaN(v))) continue;
        clean[k] = v;
      }
      await exec
        .update(playerSeasons)
        .set({ [JSONB_TAB_COLUMN[tab.tab]]: clean, updatedAt: new Date() })
        .where(eq(playerSeasons.id, playerSeasonId));
    }
  }
}

/**
 * Retire players: set team_status='RETIRED', move their current team into
 * prior_team_id, and clear team_id (they leave their roster). Postgres evaluates
 * all SET expressions against the OLD row, so `prior_team_id = team_id, team_id =
 * NULL` captures the team correctly in one statement. Row-level idempotent —
 * re-retiring an already-RETIRED (team_id NULL) player is a harmless no-op.
 * Accepts an optional executor (tx) so the caller can batch + roll back.
 */
async function retirePlayers(playerSeasonIds, { exec = db } = {}) {
  if (!playerSeasonIds || !playerSeasonIds.length) return;
  await exec
    .update(playerSeasons)
    .set({
      teamStatus: "RETIRED",
      priorTeamId: sql`${playerSeasons.teamId}`,
      teamId: null,
      updatedAt: new Date(),
    })
    .where(inArray(playerSeasons.id, playerSeasonIds));
}

/** Set arbitrary player_seasons columns (e.g. offseason age/contract rollover). */
async function updatePlayerSeasonFields(playerSeasonId, fields, { exec = db } = {}) {
  await exec
    .update(playerSeasons)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(playerSeasons.id, playerSeasonId));
}

/**
 * Write a player's TriKov valuation: the blended value to player_seasons.
 * trikov_value and the component model values + KNN neighbors to trikov_detail
 * (was Player List cols 23 + 27-30). Keyed by player_season.
 */
async function saveTrikov(playerSeasonId, { value, detail }, { exec = db } = {}) {
  await exec
    .update(playerSeasons)
    .set({
      trikovValue: value != null ? String(value) : null,
      trikovDetail: detail ?? null,
      updatedAt: new Date(),
    })
    .where(eq(playerSeasons.id, playerSeasonId));
}

/**
 * Assemble the input the TriKov R pipeline (ex-sync.R) needs, FROM the DB instead
 * of Google Sheets: playerList + League Leaders stats for the current + 2 prior
 * seasons (reconstructed from player_advanced_stats.extra, which preserves the
 * original sheet columns) + teamAssets. Pass this to R via r-script `.data()`.
 * Column names match the old sheets so the R's transforms apply unchanged.
 */
async function assembleTrikovInput({ seasonId } = {}) {
  const sid = seasonId || (await getCurrentSeasonId());
  const seasonRows = await db
    .select({ id: seasons.id, num: seasons.seasonNumber })
    .from(seasons);
  const byNum = new Map(seasonRows.map((s) => [s.num, s.id]));
  const cur = seasonRows.find((s) => s.id === sid);
  const curNum = cur ? cur.num : null;
  const toInches = (cm) => (cm == null ? null : Math.round(Number(cm) / 2.54));
  const num = (v) => (v == null || v === "" ? null : Number(v));

  // playerList — current-season roster (incl FA/Rookie), shaped like Player List.
  const plRows = await db
    .select({
      fullName: players.fullName,
      displayInitial: players.displayInitial,
      teamName: teams.name,
      teamStatus: playerSeasons.teamStatus,
      overall: playerSeasons.overall,
      position: playerSeasons.position,
      heightCm: playerSeasons.heightCm,
      weightLbs: playerSeasons.weightLbs,
      contractLength: playerSeasons.contractLength,
      age: playerSeasons.age,
      salary: playerSeasons.salary,
      playerType: playerSeasons.playerType,
      draftPosition: playerSeasons.draftPosition,
    })
    .from(playerSeasons)
    .innerJoin(players, eq(players.id, playerSeasons.playerId))
    .leftJoin(teams, eq(teams.id, playerSeasons.teamId))
    .where(eq(playerSeasons.seasonId, sid));
  const playerList = plRows.map((r) => ({
    Player: r.displayInitial,
    Name: r.fullName,
    Team: r.teamStatus === "FA" ? "FA" : r.teamStatus === "ROOKIE" ? "Rookie" : r.teamName,
    Overall: r.overall,
    Position: r.position,
    Height: toInches(r.heightCm),
    Weight: num(r.weightLbs),
    Contract_Length: r.contractLength,
    Age: r.age,
    Salary: num(r.salary),
    Type: r.playerType,
    Draft_Position: r.draftPosition,
  }));

  // League Leaders per season, reconstructed from the typed cols + extra JSONB.
  const statsForNum = async (n) => {
    const ssid = byNum.get(n);
    if (!ssid) return [];
    const rows = await db
      .select({
        displayInitial: players.displayInitial,
        teamName: teams.name,
        minutes: playerAdvancedStats.minutes,
        gamesPlayed: playerAdvancedStats.gamesPlayed,
        extra: playerAdvancedStats.extra,
      })
      .from(playerAdvancedStats)
      .innerJoin(players, eq(players.id, playerAdvancedStats.playerId))
      .leftJoin(teams, eq(teams.id, playerAdvancedStats.teamId))
      .where(eq(playerAdvancedStats.seasonId, ssid));
    return rows.map((r) => ({
      Player: r.displayInitial,
      Team: r.teamName,
      Minutes: num(r.minutes),
      Games_Played: r.gamesPlayed,
      ...(r.extra || {}),
    }));
  };
  const playerStats = await statsForNum(curNum);
  const playerStatsOld = await statsForNum(curNum - 1);
  const playerStatsOld2 = await statsForNum(curNum - 2);

  // teamAssets — Team/Frozen/Cash/Cash_Next_Season/Draft_Picks/Record/Real.
  const taRows = await db
    .select({
      teamId: teams.id,
      name: teams.name,
      isReal: teams.isReal,
      isFrozen: teamSeasons.isFrozen,
      cash: teamSeasons.cash,
      cashNextSeason: teamSeasons.cashNextSeason,
      wins: teamSeasons.wins,
      losses: teamSeasons.losses,
    })
    .from(teamSeasons)
    .innerJoin(teams, eq(teams.id, teamSeasons.teamId))
    .where(eq(teamSeasons.seasonId, sid));
  const picks = await db
    .select({ ownerTeamId: draftPicks.ownerTeamId, label: draftPicks.label })
    .from(draftPicks)
    .where(and(eq(draftPicks.seasonId, sid), eq(draftPicks.isMisc, false)));
  const picksByTeam = new Map();
  for (const p of picks) {
    if (p.ownerTeamId == null || !p.label) continue;
    if (!picksByTeam.has(p.ownerTeamId)) picksByTeam.set(p.ownerTeamId, []);
    picksByTeam.get(p.ownerTeamId).push(p.label);
  }
  const teamAssets = taRows.map((t) => ({
    Team: t.name,
    Frozen: !!t.isFrozen,
    Cash: num(t.cash),
    Cash_Next_Season: num(t.cashNextSeason),
    Draft_Picks: (picksByTeam.get(t.teamId) || []).join(", "),
    Record: `${t.wins || 0} - ${t.losses || 0}`,
    Real: !!t.isReal,
  }));

  // playerAttributes — pivoted attributes + badges + vitals, REPLACING the R's
  // getPlayerAttributes (which read the Data blob by positional index, which our
  // normalized reconstruction can't match). Same key-exclusion filters as the R.
  const ATTR_EXCLUDE = /DURABILITY|POTENTIAL|EMOTION|PICK_AND_ROLL|SHOT_CONTEST/;
  const BADGE_EXCLUDE = /RESERVED|FRIENDLY|WORK_ETHIC|KEEP_IT_REAL|PAT_MY_BACK|EXPRESSIVE|UNPREDICTAVLE|LAID_BACK|RINGMASTER|WARM_WEATHER|FINANCE|CAREER_GYM|ON_COURT_COACH/;
  const paBase = await db
    .select({
      playerSeasonId: playerSeasons.id,
      name: players.fullName,
      teamName: teams.name,
      teamStatus: playerSeasons.teamStatus,
      playerType: playerSeasons.playerType,
      position: playerSeasons.position,
      overall: playerSeasons.overall,
      vitals: playerSeasons.vitals,
      badges: playerSeasons.badges,
    })
    .from(playerSeasons)
    .innerJoin(players, eq(players.id, playerSeasons.playerId))
    .leftJoin(teams, eq(teams.id, playerSeasons.teamId))
    .where(eq(playerSeasons.seasonId, sid));
  const psIds = paBase.map((r) => r.playerSeasonId);
  const attrRows = psIds.length
    ? await db
        .select({
          psId: playerAttributes.playerSeasonId,
          code: playerAttributes.attrCode,
          value: playerAttributes.value,
        })
        .from(playerAttributes)
        .where(inArray(playerAttributes.playerSeasonId, psIds))
    : [];
  const attrByPs2 = new Map();
  for (const a of attrRows) {
    if (ATTR_EXCLUDE.test(a.code)) continue;
    if (!attrByPs2.has(a.psId)) attrByPs2.set(a.psId, {});
    attrByPs2.get(a.psId)[a.code] = a.value;
  }
  const playerAttributesOut = paBase.map((r) => {
    const v = r.vitals || {};
    const badges = {};
    for (const [k, val] of Object.entries(r.badges || {})) {
      if (!BADGE_EXCLUDE.test(k)) badges[k] = val;
    }
    return {
      Name: r.name,
      Team: r.teamStatus === "FA" ? "FA" : r.teamStatus === "ROOKIE" ? "Rookie" : r.teamName,
      Type: r.playerType,
      Position: r.position,
      Overall: r.overall,
      HEIGHT_CM: num(v.HEIGHT_CM),
      WEIGHT_LBS: num(v.WEIGHT_LBS),
      WINGSPAN_CM: num(v.WINGSPAN_CM),
      ...(attrByPs2.get(r.playerSeasonId) || {}),
      ...badges,
    };
  });

  return {
    playerList,
    playerStats,
    playerStatsOld,
    playerStatsOld2,
    teamAssets,
    playerAttributes: playerAttributesOut,
  };
}

/** Atomic team-cash delta for the season (was: Team Assets Cash cell math). */
async function addTeamCash(teamId, delta, { seasonId, exec = db } = {}) {
  const sid = seasonId || (await getCurrentSeasonId());
  await exec
    .update(teamSeasons)
    .set({ cash: sql`coalesce(${teamSeasons.cash}, 0) + ${delta}` })
    .where(and(eq(teamSeasons.seasonId, sid), eq(teamSeasons.teamId, teamId)));
}

module.exports = {
  getDb,
  getCurrentSeasonId,
  getMiscRows,
  getSeasonFlag,
  setSeasonFlag,
  getTeamDictionary,
  getValidTeams,
  getPlayerSeasons,
  loadPlayersWithData,
  buildDataBlob,
  savePlayerKey,
  savePlayerBlob,
  updatePlayerSeasonFields,
  retirePlayers,
  saveTrikov,
  assembleTrikovInput,
  addTeamCash,
  appendMiscRow,
  addInjury,
  getActiveInjuries,
  clearInjury,
  countTeamGamesSince,
  getFreeAgentsWithOffers,
  signFreeAgent,
  getMiscRowsWithMeta,
  deleteMiscRowById,
  createRookie,
  nameToInitial,
  parseBool,
  MISC_SHEETS,
};
