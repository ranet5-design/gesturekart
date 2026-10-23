import { LEVELS, FREE_DRIVE } from '../game/levels.js';
import { getProgress, unlockedUpTo, licenceProgress, rankFor, streakOf, dailyChallenge, todayKey } from '../game/progress.js';
import { loadHistory, sameName } from '../game/history.js';
import { SKILL_NAMES } from '../game/rules.js';
import { PRACTICE_FOR, weakestSkill } from './SkillRadar.jsx';

const Stars = ({ n }) => (
  <span className="stars" aria-label={`${n} of 3 stars`}>
    {[1, 2, 3].map((i) => (
      <i key={i} className={i <= n ? 'on' : ''}>
        ★
      </i>
    ))}
  </span>
);

/** The road to the licence: 8 levels on a winding path, plus Free Drive. */
export default function LevelMap({ player, selected, onSelect }) {
  const p = getProgress(player);
  const unlocked = unlockedUpTo(p);
  const lic = licenceProgress(p);
  const rank = rankFor(p.xp);
  const streak = streakOf(p.days);
  const challenge = dailyChallenge();
  const challengeDone = !!p.challenges?.[todayKey()];
  const last = loadHistory()
    .filter((e) => sameName(e.player, player) && e.skills)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  const weak = weakestSkill(last?.skills);
  const sel = selected === 0 ? FREE_DRIVE : LEVELS.find((l) => l.id === selected) || LEVELS[0];
  const remaining = LEVELS.filter((l) => !(p.levels[l.id]?.stars > 0));

  return (
    <div className="levelmap">
      <div className="lm-top">
        <div className="lm-licence">
          <div className="lic-card" aria-hidden="true">
            <span>🪪</span>
          </div>
          <div className="lic-text">
            <b>{p.licence ? 'Licence earned! 🎉' : `Licence progress ${Math.round(lic * 100)}%`}</b>
            <div className="lic-bar">
              <i style={{ width: `${lic * 100}%` }} />
            </div>
            <small>
              {p.licence
                ? 'You cleared every level. Now chase 3 stars everywhere!'
                : `${remaining.length} level${remaining.length > 1 ? 's' : ''} left: ${remaining.map((l) => l.id).join(', ')}. Next: Level ${unlocked} · ${LEVELS[unlocked - 1].name}`}
            </small>
          </div>
        </div>
        <div className="lm-chips">
          <span className="chip">
            🏅 {rank.name} · {p.xp} XP{rank.next ? ` (${rank.toNext} to ${rank.next.name})` : ''}
          </span>
          <span className={`chip ${streak ? 'fire' : ''}`}>🔥 {streak}-day streak</span>
          <span className={`chip ${challengeDone ? 'done' : ''}`}>🎯 Today: {challenge.text}{challengeDone ? ' ✓' : ' (+120 XP)'}</span>
        </div>
      </div>

      {weak && (
        <p className="lm-weak">
          📈 Your weakest skill last time was <b>{SKILL_NAMES[weak.k]}</b> ({weak.v}/100). Practise it in{' '}
          <button className="link" onClick={() => onSelect(Math.min(PRACTICE_FOR[weak.k], unlocked))}>
            Level {Math.min(PRACTICE_FOR[weak.k], unlocked)}
          </button>
          .
        </p>
      )}

      <div className="lm-body">
        <ol className="lm-path">
          {LEVELS.map((l, i) => {
            const st = p.levels[l.id]?.stars || 0;
            const locked = l.id > unlocked;
            return (
              <li key={l.id} className={`${i % 2 ? 'r' : 'l'} ${selected === l.id ? 'on' : ''} ${locked ? 'locked' : ''} ${st ? 'cleared' : ''}`}>
                <button type="button" disabled={locked} onClick={() => onSelect(l.id)} aria-pressed={selected === l.id}>
                  <span className="node">{locked ? '🔒' : st ? '✓' : l.id}</span>
                  <span className="lm-name">
                    <b>{l.name}</b>
                    <small>{l.ur}</small>
                    <Stars n={st} />
                  </span>
                  {l.id === unlocked && !st && <em className="here">You are here</em>}
                </button>
              </li>
            );
          })}
          <li className={`free ${selected === 0 ? 'on' : ''}`}>
            <button type="button" onClick={() => onSelect(0)} aria-pressed={selected === 0}>
              <span className="node">🛣</span>
              <span className="lm-name">
                <b>Free Drive</b>
                <small>Full Canal Road, everything on · second chance included</small>
              </span>
            </button>
          </li>
        </ol>

        <aside className="lm-detail">
          <div className="eyebrow">{sel.id ? `Level ${sel.id}` : 'Free drive'}</div>
          <h3>{sel.name}</h3>
          <p className="ur">{sel.ur}</p>
          <p>{sel.goal}</p>
          <p className="lm-route">
            📍 {sel.route.name}: {sel.route.from} → {sel.route.to} · {(sel.length / 1000).toFixed(1)} km
            {sel.env.time === 'night' ? ' · 🌙 Night' : ''}
            {sel.env.weather === 'rain' ? ' · 🌧 Rain' : ''}
            {sel.env.weather === 'fog' ? ' · 🌫 Fog' : ''}
          </p>
          {sel.id > 0 && (
            <>
              <h4>To pass</h4>
              <ul className="lm-checks">
                {sel.checks.map((c) => (
                  <li key={c.id}>{c.text}</li>
                ))}
              </ul>
              <p className="lm-stars">★ pass · ★★ score 85+ · ★★★ score 95+ and fully focused</p>
              {p.levels[sel.id] && (
                <p className="muted">
                  Best {p.levels[sel.id].best} · {p.levels[sel.id].tries} attempt{p.levels[sel.id].tries > 1 ? 's' : ''}
                </p>
              )}
            </>
          )}
          {sel.examiner && <p className="exam">⚠ Examiner mode: one critical mistake ends the test.</p>}
        </aside>
      </div>
    </div>
  );
}
