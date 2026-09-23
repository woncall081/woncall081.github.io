import { buildSchedule, gameDecision, getRecords, labels, splitGames } from './scoreboard.js';

const denverDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
})[character]);
const teamLabel = (team) => labels[team] ?? team;
const pct = (value) => Number.isFinite(value) ? `${value.toFixed(1)}%` : '—';
const money = (cents) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2,
}).format((cents ?? 0) / 100);
const fullDate = (date, withYear = false) => new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}),
}).format(new Date(`${date}T12:00:00Z`));

function tiebreakDetail(game, decision) {
  if (!decision?.tiebreaker) return '';
  const winnerIsHome = decision.winner === game.home;
  const first = (home, away) => winnerIsHome ? home : away;
  const second = (home, away) => winnerIsHome ? away : home;
  return {
    premium: `Premium tiebreaker · ${money(first(game.homePremiumCents, game.awayPremiumCents))} to ${money(second(game.homePremiumCents, game.awayPremiumCents))}`,
    followup: `Follow-up tiebreaker · ${pct(first(game.homeFollowupPct, game.awayFollowupPct))} to ${pct(second(game.homeFollowupPct, game.awayFollowupPct))}`,
    ricochet: `Ricochet tiebreaker · ${first(game.homeRicochetCalls, game.awayRicochetCalls) ?? 0} to ${second(game.homeRicochetCalls, game.awayRicochetCalls) ?? 0}`,
  }[decision.tiebreaker];
}

function teamLine(name, score, followup, ricochet) {
  return `<div class="team"><h3>${escapeHtml(teamLabel(name))}</h3><div class="stats"><span class="stat">Follow-up <b>${pct(followup)}</b></span><span class="stat">Ricochet <b>${ricochet ?? 0}</b></span></div><div class="score">${score ?? 0}</div></div>`;
}

function card(game) {
  const pending = game.homeScore === null || game.awayScore === null;
  const decision = gameDecision(game);
  const status = game.final ? (decision ? 'Final' : 'Final review') : pending ? 'Awaiting update' : 'Live score';
  const banner = game.final && decision
    ? `<div class="decision">${escapeHtml(teamLabel(decision.winner))} wins${decision.tiebreaker ? ` · ${escapeHtml(tiebreakDetail(game, decision))}` : ''}</div>`
    : '';
  return `<article class="card"><p class="status"><i></i>${status}</p>${teamLine(game.home, game.homeScore, game.homeFollowupPct, game.homeRicochetCalls)}<div class="vs"><span></span><b>VS</b><span></span></div>${teamLine(game.away, game.awayScore, game.awayFollowupPct, game.awayRicochetCalls)}${banner}</article>`;
}

function resultRow(game) {
  const decision = gameDecision(game);
  const detail = tiebreakDetail(game, decision);
  return `<tr><td class="schedule-date">${fullDate(game.date, true)}</td><td><span class="matchup">${escapeHtml(teamLabel(game.home))} vs ${escapeHtml(teamLabel(game.away))}</span><span class="detail">${game.homeScore}–${game.awayScore}</span></td><td><span class="winner">${escapeHtml(teamLabel(decision.winner))} won</span>${detail ? `<span class="detail">${escapeHtml(detail)}</span>` : ''}</td></tr>`;
}

function scheduleRow(game, index, games) {
  const showDate = index === 0 || games[index - 1].date !== game.date;
  return `<tr><td class="schedule-date">${showDate ? fullDate(game.date, true) : ''}</td><td><span class="matchup">${escapeHtml(teamLabel(game.home))} vs ${escapeHtml(teamLabel(game.away))}</span></td></tr>`;
}

async function load() {
  const response = await fetch(`data.json?v=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Scoreboard data request failed: ${response.status}`);
  const data = await response.json();
  const teams = data.teams.map((team) => team.name);
  const teamInfo = new Map(data.teams.map((team) => [team.name, team]));
  const startDate = data.competition?.startDate ?? '2026-09-22';
  const endDate = data.competition?.endDate ?? '2026-10-19';
  const overrides = new Map(data.games.map((game) => [`${game.date}|${game.home}|${game.away}`, game]));
  const games = buildSchedule(teams, startDate, endDate).map((game) => ({ ...game, ...overrides.get(`${game.date}|${game.home}|${game.away}`) }));
  const today = denverDate();
  const todayGames = games.filter((game) => game.date === today);
  const standings = getRecords(teams, games).sort((a, b) => b.w - a.w || a.l - b.l || a.team.localeCompare(b.team));
  const { results, upcoming } = splitGames(games, today);

  document.querySelector('#date').textContent = fullDate(today, true);
  document.querySelector('#games').innerHTML = todayGames.length ? todayGames.map(card).join('') : '<div class="empty">No games scheduled today.</div>';
  document.querySelector('#records').innerHTML = standings.map((row, index) => `<tr><td><span class="rank">${index + 1}</span></td><td><strong class="team-name">${escapeHtml(teamLabel(row.team))}</strong><span class="players">${escapeHtml(teamInfo.get(row.team)?.players ?? '')}</span></td><td><span class="record">${row.record}</span></td></tr>`).join('');
  document.querySelector('#results-body').innerHTML = results.length ? results.map(resultRow).join('') : '<tr><td colspan="3">No final results yet.</td></tr>';
  document.querySelector('#schedule-body').innerHTML = upcoming.length ? upcoming.map(scheduleRow).join('') : '<tr><td colspan="2">The regular-season schedule is complete.</td></tr>';
  document.querySelector('#updated').textContent = data.updatedAt ? `Updated ${new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', hour: 'numeric', minute: '2-digit' }).format(new Date(data.updatedAt))}` : 'Pre-game';
}

load().catch((error) => {
  console.error(error);
  document.querySelector('#games').innerHTML = '<div class="empty">Scoreboard temporarily unavailable.</div>';
});
setInterval(load, 60000);
