// Wordclock: a round plate of capital letters trimmed to the circle. The time
// is the lit words, in five-minute steps ("IT IS TEN PAST TEN"); four dots at
// the foot count the minutes in between. Every word sits in reading order
// (IT IS, minutes, PAST or TO, hour, OCLOCK), so any phrase reads top to
// bottom. A phrase that changes cross-fades over about 400 ms.
NEON.face({
  id: 'wordclock',
  name: 'Wordclock',
  hue: 'mint',
  idea: 'A round word clock. A plate of letters trimmed to the circle; the time is the words that light in mint, in five-minute steps, with four dots for the minutes in between.',
  draw(ctx, T, N, state) {
    const ink = N.c.mint;
    const PX = 60, PY = 72, CX = 500, CY = 500;
    const FONT = '600 66px "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif';

    if (!state.ready) {
      // Every row has an odd number of cells so columns stay aligned.
      state.rows = [
        'SBHNTLE',                // 7
        'ITLISASTIME',            // 11
        'QUARTERNBKMPL',          // 13
        'TWENTYFIVEXJB',          // 13
        'TENHALFPASTTOXY',        // 15
        'ONETWOTHREEFOUR',        // 15
        'FIVESIXSEVENTEN',        // 15
        'ELEVENEIGHTKZ' ,         // 13
        'NINETWELVEHXD',          // 13
        'OCLOCKQDPRB',            // 11
      ];
      const find = (r, w) => {
        const row = state.rows[r];
        const at = w === 'TO' ? row.lastIndexOf(w) : row.indexOf(w);
        const cells = [];
        for (let i = 0; i < w.length; i++) cells.push(r * 15 + at + i);
        return cells;
      };
      state.w = {
        IT: find(1, 'IT'), IS: [...find(1, 'IS')].map((c, i) => c + 0 * i),
        QUARTER: find(2, 'QUARTER'),
        TWENTY: find(3, 'TWENTY'),
        mFIVE: find(3, 'FIVE'),
        mTEN: find(4, 'TEN'), HALF: find(4, 'HALF'), PAST: find(4, 'PAST'), TO: find(4, 'TO'),
        h: [
          null,
          find(5, 'ONE'), find(5, 'TWO'), find(5, 'THREE'), find(5, 'FOUR'),
          find(6, 'FIVE'), find(6, 'SIX'), find(6, 'SEVEN'),
          find(7, 'EIGHT'), find(8, 'NINE'), find(6, 'TEN'),
          find(7, 'ELEVEN'), find(8, 'TWELVE'),
        ],
        OCLOCK: find(9, 'OCLOCK'),
      };
      // Where each letter sits.
      state.cells = [];
      state.rows.forEach((row, r) => {
        const n = row.length;
        for (let c = 0; c < n; c++) {
          state.cells.push({ id: r * 15 + c, ch: row[c], x: CX + (c - (n - 1) / 2) * PX, y: CY + (r - 4.5) * PY });
        }
      });
      state.cur = new Set();
      state.prev = new Set();
      state.key = '';
      state.changed = -10;
      state.ready = true;
    }

    // Which words say this time.
    const five = Math.floor(T.m / 5);
    const to = five >= 7;
    const hr = ((T.h + (to ? 1 : 0)) % 12) || 12;
    const W = state.w;
    const set = new Set([...W.IT, ...W.IS]);
    const add = (cells) => cells.forEach((c) => set.add(c));
    if (five === 1) { add(W.mFIVE); add(W.PAST); }
    else if (five === 2) { add(W.mTEN); add(W.PAST); }
    else if (five === 3) { add(W.QUARTER); add(W.PAST); }
    else if (five === 4) { add(W.TWENTY); add(W.PAST); }
    else if (five === 5) { add(W.TWENTY); add(W.mFIVE); add(W.PAST); }
    else if (five === 6) { add(W.HALF); add(W.PAST); }
    else if (five === 7) { add(W.TWENTY); add(W.mFIVE); add(W.TO); }
    else if (five === 8) { add(W.TWENTY); add(W.TO); }
    else if (five === 9) { add(W.QUARTER); add(W.TO); }
    else if (five === 10) { add(W.mTEN); add(W.TO); }
    else if (five === 11) { add(W.mFIVE); add(W.TO); }
    add(W.h[hr]);
    if (five === 0) add(W.OCLOCK);

    const key = `${five}:${hr}`;
    if (key !== state.key) {
      state.prev = state.key === '' ? set : state.cur;
      state.cur = set;
      state.changed = state.key === '' ? -10 : T.t;
      state.key = key;
    }
    const e = N.ease((T.t - state.changed) / 0.4);

    ctx.save();
    ctx.font = FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // The unlit plate: every letter at a whisper.
    ctx.fillStyle = N.rgba(ink, 0.11);
    for (const cell of state.cells) ctx.fillText(cell.ch, cell.x, cell.y);

    // Lit letters, bucketed by level so a cross-fade needs few glow calls.
    const buckets = new Map();
    for (const cell of state.cells) {
      const inCur = state.cur.has(cell.id), inPrev = state.prev.has(cell.id);
      const l = inCur ? (inPrev ? 1 : e) : inPrev ? 1 - e : 0;
      if (l <= 0.01) continue;
      const q = Math.round(l * 10) / 10;
      if (!buckets.has(q)) buckets.set(q, []);
      buckets.get(q).push(cell);
    }
    for (const [l, list] of buckets) {
      N.glow(ctx, ink, 4.5, (c) => {
        for (const cell of list) c.strokeText(cell.ch, cell.x, cell.y);
      }, { intensity: l, core: false });
      ctx.fillStyle = N.rgba(N.mix(ink, '#ffffff', 0.42), l);
      for (const cell of list) ctx.fillText(cell.ch, cell.x, cell.y);
    }
    ctx.restore();

    // The four minute dots at the foot.
    const extra = T.m % 5;
    ctx.fillStyle = N.rgba(ink, 0.14);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const x = CX + (i - 1.5) * 52;
      ctx.moveTo(x + 7, 868);
      ctx.arc(x, 868, 7, 0, N.TAU);
    }
    ctx.fill();
    for (let i = 0; i < extra; i++) N.glowDot(ctx, ink, CX + (i - 1.5) * 52, 868, 8, 1);
  },
});
