/**
 * The community app engine (lib/community-apps/engine.ts, generate.ts): the free path stays one
 * answer + one repair; the max engine plans, writes drafts in parallel, checks them on the server,
 * keeps the best and refines it, all inside the route's time limit.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { hardProblems, plannedKeysOf, qualityProblems, resolveEngine, scoreApp, syntaxProblems } from '@/lib/community-apps/engine';
import { generateWith, QUALITY_BLOCK, SYSTEM_BLOCKS, type Transport } from '@/lib/community-apps/generate';

const GOOD = `<style>.empty{opacity:.7}</style><div id="root" class="app-header"></div><script>
(function () {
  var root = document.getElementById('root'); var me = null;
  function render() {
    var items = hl.list('item:');
    root.innerHTML = items.length ? items.map(function (i) { return '<p>' + hl.esc(i.value.text) + '</p>'; }).join('') : '<div class="empty">' + hl.pick('Nada', 'Nothing') + '</div>';
  }
  root.addEventListener('click', function () { hl.set('item:' + hl.uid(), { text: 'x' }); });
  hl.ready().then(function (c) { me = c.me; if (me.isAdmin) {} render(); hl.onChange(render); });
})();
</script>`;
const BROKEN_JS = `<div id="r"></div><script>hl.ready().then(function () { if (( { </script>`;
const NO_ONCHANGE = `<div id="r" class="empty"></div><script>hl.ready().then(function(){ document.getElementById('r').addEventListener('click', function(){ hl.set('a', 1); }); });</script>`;
const wrap = (html: string, title = 'Polls') => `<title>${title}</title><summary>Vote on things.</summary><app>${html}</app>`;

describe('engine configuration', () => {
  it('stays on the free path without a max key and model', () => {
    const e = resolveEngine({});
    expect(e.tier).toBe('free');
    expect(e.maxOutputTokens).toBe(8000);
    expect(e.effort).toBe('low');
    expect(resolveEngine({ COMMUNITY_APPS_EFFORT: 'high' }).effort).toBe('high');
    expect(resolveEngine({ COMMUNITY_APPS_MAX_MODEL: 'm' }).tier).toBe('free');
  });

  it('turns the max engine on with a key and a model, with bounded settings', () => {
    const e = resolveEngine({ COMMUNITY_APPS_MAX_API_KEY: 'k', COMMUNITY_APPS_MAX_MODEL: 'frontier', COMMUNITY_APPS_CANDIDATES: '9', COMMUNITY_APPS_BUDGET_MS: '999999', COMMUNITY_APPS_MAX_EFFORT: 'high' });
    expect(e.tier).toBe('max');
    expect(e.provider).toBe('openai');
    expect(e.baseUrl).toBe('https://api.openai.com/v1');
    expect(e.candidates).toBe(5);
    expect(e.budgetMs).toBe(285_000);
    expect(e.effort).toBe('high');
    expect(e.plan && e.refine).toBe(true);
    const a = resolveEngine({ COMMUNITY_APPS_MAX_API_KEY: 'k', COMMUNITY_APPS_MAX_MODEL: 'm', COMMUNITY_APPS_MAX_PROVIDER: 'Anthropic' });
    expect(a.provider).toBe('anthropic');
    expect(a.baseUrl).toBe('https://api.anthropic.com/v1');
  });
});

describe('server-side checks', () => {
  it('JavaScript that does not parse is caught, without running it', () => {
    expect(syntaxProblems(GOOD)).toEqual([]);
    expect(syntaxProblems(BROKEN_JS)[0]).toMatch(/Script 1 does not parse/);
    expect(hardProblems('<script>fetch("https://x")</script>')).toContain('Apps have no network access.');
  });

  it('quality findings: live updates, empty state, escaping, planned data', () => {
    expect(qualityProblems(GOOD, ['item:'])).toEqual([]);
    expect(qualityProblems(NO_ONCHANGE).join(' ')).toMatch(/hl\.onChange/);
    expect(qualityProblems('<button onclick="x()">a</button><script>hl.ready()</script>').join(' ')).toMatch(/inline on/);
    expect(plannedKeysOf('Data: `item:<id>` {text}, `vote` member key, rsvp:<id>')).toEqual(expect.arrayContaining(['item:', 'vote', 'rsvp:']));
  });

  it('a broken draft never outscores a working one', () => {
    expect(scoreApp(GOOD).score).toBeGreaterThan(scoreApp(NO_ONCHANGE).score);
    expect(scoreApp(BROKEN_JS).score).toBeLessThan(0);
  });
});

describe('pipeline', () => {
  const free = resolveEngine({});
  const max = { ...resolveEngine({ COMMUNITY_APPS_MAX_API_KEY: 'k', COMMUNITY_APPS_MAX_MODEL: 'm', COMMUNITY_APPS_CANDIDATES: '3' }) };

  it('free: one answer, and one repair when the first fails the checks', async () => {
    const calls: string[] = [];
    const t: Transport = async ({ user }) => { calls.push(user); return wrap(calls.length === 1 ? BROKEN_JS : GOOD); };
    const r = await generateWith({ request: 'a poll', communityName: 'LOL' }, free, t);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatch(/rejected for these reasons/);
    expect(r.html).toBe(GOOD);
  });

  it('max: plans, writes three drafts in parallel, keeps the best', async () => {
    const seen: { user: string; system: number }[] = [];
    const t: Transport = async ({ user, system }) => {
      seen.push({ user, system: system.length });
      if (/Plan the app before anyone writes code/.test(user)) return '<plan>Purpose: polls. Data: `item:<id>` {text}</plan>';
      if (/richest useful views/.test(user)) return wrap(GOOD, 'Best');
      if (/simplest interaction/.test(user)) return wrap(BROKEN_JS, 'Broken');
      return wrap(NO_ONCHANGE, 'Weak');
    };
    const r = await generateWith({ request: 'a poll for the team', communityName: 'LOL' }, max, t);
    expect(seen[0].user).toMatch(/<plan>|Plan the app/);
    expect(seen.filter((s) => /The agreed plan:/.test(s.user))).toHaveLength(3);
    expect(seen.every((s) => s.system === SYSTEM_BLOCKS.length + 1)).toBe(true);
    expect(r.title).toBe('Best');
    expect(r.html).toBe(GOOD);
  });

  it('max: refines the best draft once when a check still finds something, and keeps the better one', async () => {
    let refined = 0;
    const t: Transport = async ({ user }) => {
      if (/Plan the app/.test(user)) return '<plan>Data: `item:<id>`</plan>';
      if (/Fix the draft below/.test(user)) { refined++; return wrap(GOOD, ''); }
      return wrap(NO_ONCHANGE.replace('hl.set(\'a\', 1)', "hl.set('item:'+hl.uid(), 1)"), 'Board');
    };
    const r = await generateWith({ request: 'a board', communityName: 'LOL' }, max, t);
    expect(refined).toBe(1);
    expect(r.html).toBe(GOOD);
    expect(r.title).toBe('Board');
  });

  it('max: never returns an app that fails the hard checks', async () => {
    const t: Transport = async ({ user }) => (/Plan the app/.test(user) ? '<plan>x</plan>' : wrap(BROKEN_JS));
    await expect(generateWith({ request: 'anything at all', communityName: 'LOL' }, max, t)).rejects.toThrow(/safety checks/);
  });

  it('the quality bar is only sent on the max engine; the free prompt keeps its three blocks', () => {
    expect(SYSTEM_BLOCKS).toHaveLength(3);
    expect(QUALITY_BLOCK).toMatch(/Never leave TODOs/);
    const src = fs.readFileSync('lib/community-apps/generate.ts', 'utf8');
    expect(src).toMatch(/\[\.\.\.SYSTEM_BLOCKS, \{ type: 'text', text: QUALITY_BLOCK \}\]/);
    expect(fs.readFileSync('app/api/chat/communities/[id]/apps/generate/route.ts', 'utf8')).toMatch(/maxDuration = 300/);
  });
});
