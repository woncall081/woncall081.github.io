export const labels = {
  'Show Me Your TDs': "Show Me Your TD's",
  'Winning Will & Bryan': "WWB's",
  'Belt to Ass': "BTA's",
  'Management': 'Management',
};

const rotations = [
  [[0, 1], [2, 3]],
  [[0, 2], [1, 3]],
  [[0, 3], [1, 2]],
];

function utcDate(value) {
  return new Date(`${value}T12:00:00Z`);
}

export function buildSchedule(teams, startDate, endDate) {
  const games = [];
  const date = utcDate(startDate);
  const end = utcDate(endDate);
  let weekdayIndex = 0;

  while (date <= end) {
    if (![0, 6].includes(date.getUTCDay())) {
      const gameDate = date.toISOString().slice(0, 10);
      for (const [home, away] of rotations[weekdayIndex % rotations.length]) {
        games.push({ date: gameDate, home: teams[home], away: teams[away], homeScore: null, awayScore: null, final: false });
      }
      weekdayIndex += 1;
    }
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return games;
}

function result(game, winner, tiebreaker = null) {
  return { winner, loser: winner === game.home ? game.away : game.home, tiebreaker };
}

export function gameDecision(game) {
  if (game.final !== true || !Number.isFinite(game.homeScore) || !Number.isFinite(game.awayScore)) return null;
  if (game.homeScore !== game.awayScore) return result(game, game.homeScore > game.awayScore ? game.home : game.away);

  const tiebreakers = [
    ['premium', game.homePremiumCents, game.awayPremiumCents],
    ['followup', Number.isFinite(game.homeFollowupPct) ? game.homeFollowupPct : -1, Number.isFinite(game.awayFollowupPct) ? game.awayFollowupPct : -1],
    ['ricochet', game.homeRicochetCalls, game.awayRicochetCalls],
  ];
  for (const [name, homeValue, awayValue] of tiebreakers) {
    if (Number.isFinite(homeValue) && Number.isFinite(awayValue) && homeValue !== awayValue) {
      return result(game, homeValue > awayValue ? game.home : game.away, name);
    }
  }
  return null;
}

export function getRecords(teams, games) {
  const records = new Map(teams.map((team) => [team, { team, w: 0, l: 0 }]));
  for (const game of games) {
    const decision = gameDecision(game);
    if (!decision) continue;
    records.get(decision.winner).w += 1;
    records.get(decision.loser).l += 1;
  }
  return [...records.values()].map((row) => ({ ...row, record: `${row.w}-${row.l}` }));
}

export function splitGames(games, today) {
  return {
    results: games.filter((game) => game.final === true && gameDecision(game)).sort((a, b) => b.date.localeCompare(a.date)),
    upcoming: games.filter((game) => game.date > today && game.final !== true),
  };
}
