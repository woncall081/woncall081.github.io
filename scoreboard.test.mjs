import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildSchedule, gameDecision, getRecords, splitGames } from './scoreboard.js';

const teams = ['Show Me Your TDs', 'Winning Will & Bryan', 'Belt to Ass', 'Management'];

test('buildSchedule creates every weekday matchup through October 19', () => {
  const games = buildSchedule(teams, '2026-09-22', '2026-10-19');
  assert.equal(games.length, 40);
  assert.deepEqual(games.filter((game) => game.date === '2026-09-22').map(({ home, away }) => [home, away]), [
    ['Show Me Your TDs', 'Winning Will & Bryan'], ['Belt to Ass', 'Management'],
  ]);
  assert.equal(games.at(-1).date, '2026-10-19');
});

test('gameDecision uses premium as the first tiebreaker', () => {
  const decision = gameDecision({ final: true, home: teams[0], away: teams[1], homeScore: 0, awayScore: 0, homePremiumCents: 0, awayPremiumCents: 370500, homeFollowupPct: 53.3, awayFollowupPct: 85.7, homeRicochetCalls: 303, awayRicochetCalls: 348 });
  assert.deepEqual(decision, { winner: teams[1], loser: teams[0], tiebreaker: 'premium' });
});

test('gameDecision uses follow-up percentage when premium is tied', () => {
  const decision = gameDecision({ final: true, home: teams[0], away: teams[1], homeScore: 3, awayScore: 3, homePremiumCents: 125000, awayPremiumCents: 125000, homeFollowupPct: 80, awayFollowupPct: 70, homeRicochetCalls: 300, awayRicochetCalls: 500 });
  assert.equal(decision.winner, teams[0]);
  assert.equal(decision.tiebreaker, 'followup');
});

test('gameDecision uses Ricochet calls when premium and follow-up are tied', () => {
  const decision = gameDecision({ final: true, home: teams[0], away: teams[1], homeScore: 7, awayScore: 7, homePremiumCents: 250000, awayPremiumCents: 250000, homeFollowupPct: 80, awayFollowupPct: 80, homeRicochetCalls: 350, awayRicochetCalls: 400 });
  assert.equal(decision.winner, teams[1]);
  assert.equal(decision.tiebreaker, 'ricochet');
});

test('a fully tied game remains unresolved instead of recording a tie', () => {
  const game = { final: true, home: teams[0], away: teams[1], homeScore: 0, awayScore: 0, homePremiumCents: 0, awayPremiumCents: 0, homeFollowupPct: null, awayFollowupPct: null, homeRicochetCalls: 0, awayRicochetCalls: 0 };
  assert.equal(gameDecision(game), null);
  assert.deepEqual(getRecords(teams, [game]).map(({ record }) => record), ['0-0', '0-0', '0-0', '0-0']);
});

test('getRecords awards tied-score finals to the tiebreak winner', () => {
  const games = [{ final: true, home: teams[0], away: teams[1], homeScore: 0, awayScore: 0, homePremiumCents: 0, awayPremiumCents: 370500, homeFollowupPct: 53.3, awayFollowupPct: 85.7, homeRicochetCalls: 303, awayRicochetCalls: 348 }];
  const records = Object.fromEntries(getRecords(teams, games).map((row) => [row.team, row.record]));
  assert.equal(records[teams[0]], '0-1');
  assert.equal(records[teams[1]], '1-0');
  assert.ok(Object.values(records).every((record) => record.split('-').length === 2));
});

test('splitGames separates final results from the remaining schedule', () => {
  const games = buildSchedule(teams, '2026-09-22', '2026-09-25');
  games[0] = { ...games[0], final: true, homeScore: 3, awayScore: 0 };
  games[1] = { ...games[1], final: true, homeScore: 0, awayScore: 0 };
  const { results, upcoming } = splitGames(games, '2026-09-22');
  assert.equal(results.length, 1);
  assert.equal(upcoming.length, 6);
});

test('published data gives every final game a winner', async () => {
  const data = JSON.parse(await readFile(new URL('./data.json', import.meta.url), 'utf8'));
  assert.ok(data.games.filter((game) => game.final).map(gameDecision).every(Boolean));
  assert.deepEqual(Object.fromEntries(getRecords(data.teams.map((team) => team.name), data.games).map((row) => [row.team, row.record])), {
    'Show Me Your TDs': '0-1', 'Winning Will & Bryan': '1-0', 'Belt to Ass': '1-0', 'Management': '0-1',
  });
});
