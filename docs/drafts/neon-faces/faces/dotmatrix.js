// Dotmatrix: a round LED display. A 26-unit lattice of dark LEDs fills the
// disc (one dashed path, so it costs a handful of calls), HH:MM burns in a
// 5 by 7 font, the date scrolls under it, and an outer ring of 60 LEDs counts
// the seconds. Lit LEDs are drawn as dashed lines with round caps: one
// subpath per run of neighbours instead of one shape per LED.
NEON.face({
  id: 'dotmatrix',
  name: 'Dotmatrix',
  hue: 'mint',
  idea: 'A round LED matrix. HH:MM in a chunky 5 by 7 font, the date scrolling right to left beneath it, and 60 ring LEDs filling with the seconds. The dark LEDs stay visible as a faint lattice.',
  draw(ctx, T, N, state) {
    const CX = 500, CY = 500, P = 26;     // lattice pitch
    const ink = N.c.mint;
    const FIELD = 436;                    // lattice reaches this radius
    const RING = 462;                     // second LEDs

    // 5 by 7 font, one string per row, '#' lit. Only what the clock can say.
    const F = {
      '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
      '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
      '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
      '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
      '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
      '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
      '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
      '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
      '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
      '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
      ':': ['.', '.', '#', '.', '#', '.', '.'],
      A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
      B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
      C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
      D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
      E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
      F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
      G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
      H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
      I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
      J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
      L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
      M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
      N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
      O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
      P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
      R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
      S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
      T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
      U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
      V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
      W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
      Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
      ' ': ['..', '..', '..', '..', '..', '..', '..'],
    };
    // A string as columns of 7 bits (bit r = row r, top first), one blank
    // column between characters.
    const toCols = (str) => {
      const cols = [];
      for (const ch of str) {
        const g = F[ch] || F[' '];
        for (let x = 0; x < g[0].length; x++) {
          let bits = 0;
          for (let r = 0; r < 7; r++) if (g[r][x] === '#') bits |= 1 << r;
          cols.push(bits);
        }
        cols.push(0);
      }
      return cols;
    };

    // Dash [0, P] with round caps turns a straight line into a row of dots.
    const DOTS = [0, P];
    const lattice = (c) => {
      c.setLineDash(DOTS);
      for (let k = -17; k <= 17; k++) {
        const dy = k * P;
        const hw = Math.floor(Math.sqrt(Math.max(0, FIELD * FIELD - dy * dy)) / P);
        if (hw < 0) continue;
        c.moveTo(CX - hw * P, CY + dy);
        c.lineTo(CX + hw * P + 1, CY + dy);
      }
    };
    // Runs of lit LEDs. `cols` maps lattice column j -> 7 bits; rows are placed
    // at lattice row r0 + bit. Runs are returned as [xStart, xEnd, y].
    const runsOf = (cols, j0, j1, r0, accept) => {
      const runs = [];
      for (let r = 0; r < 7; r++) {
        let start = null;
        for (let j = j0; j <= j1 + 1; j++) {
          const on = j <= j1 && accept(j) && (cols(j) >> r) & 1;
          if (on && start === null) start = j;
          if (!on && start !== null) {
            runs.push([CX + start * P, CX + (j - 1) * P, CY + (r0 + r) * P]);
            start = null;
          }
        }
      }
      return runs;
    };
    const drawRuns = (runs, width, intensity, halo) => {
      if (!runs.length) return;
      N.glow(ctx, ink, width, (c) => {
        c.setLineDash(DOTS);
        for (const [x0, x1, y] of runs) {
          c.moveTo(x0, y);
          c.lineTo(x1 + 0.01, y);
        }
      }, { intensity, halo });
    };

    // The dark lattice: every LED, one stroke.
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = 11;
    ctx.strokeStyle = N.rgba(ink, 0.085);
    ctx.beginPath();
    lattice(ctx);
    ctx.stroke();
    // Dark ring LEDs, 60 of them.
    const pitch = (N.TAU * RING) / 60;
    ctx.lineWidth = 11;
    ctx.setLineDash([0, pitch]);
    ctx.beginPath();
    ctx.arc(CX, CY, RING, -Math.PI / 2, -Math.PI / 2 + N.TAU - 0.01);
    ctx.stroke();
    ctx.restore();

    // HH:MM: 25 lattice columns wide, 7 rows tall, rows -7 to -1.
    const timeCols = toCols(T.hh + ':' + T.mm).slice(0, -1);
    const colonOn = T.sf % 1 < 0.5;
    const TJ0 = -Math.floor(timeCols.length / 2);
    // Pull the colon column out of the main set so it can blink alone.
    const colonIdx = 12;                      // 5 + 1 + 5 + 1 characters in
    const timeAt = (j) => timeCols[j - TJ0] || 0;
    const timeRuns = runsOf(timeAt, TJ0, TJ0 + timeCols.length - 1, -7, (j) => j - TJ0 !== colonIdx);
    drawRuns(timeRuns, 21, 1, 0.9);
    if (colonOn) drawRuns(runsOf(timeAt, TJ0, TJ0 + timeCols.length - 1, -7, (j) => j - TJ0 === colonIdx), 21, 1, 0.9);

    // Date, scrolling right to left under the time, dimmer so the time leads.
    const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const d = T.date;
    const text = DOW[d.getDay()] + ' ' + String(d.getDate()).padStart(2, '0') + ' ' + MON[d.getMonth()];
    if (state.text !== text) { state.text = text; state.cols = toCols(text); }
    const loop = state.cols.length + 12;
    const off = Math.floor(T.t * 7) % loop;
    const HALF = 14;
    const dateAt = (j) => state.cols[(((off + j + HALF) % loop) + loop) % loop] || 0;
    drawRuns(runsOf(dateAt, -HALF, HALF, 2, (j) => Math.abs(j) <= 12), 15, 0.6, 0.7);
    drawRuns(runsOf(dateAt, -HALF, HALF, 2, (j) => Math.abs(j) > 12), 11, 0.22, 0.4);

    // Seconds ring: LEDs 0..s lit, the newest brightest.
    if (T.s > 0) {
      N.glow(ctx, ink, 13, (c) => {
        c.setLineDash([0, pitch]);
        c.arc(CX, CY, RING, -Math.PI / 2, -Math.PI / 2 + ((T.s - 0.5) / 60) * N.TAU);
      }, { intensity: 0.55, halo: 0.7 });
    }
    const [hx, hy] = N.polar(CX, CY, RING, T.s * 6);
    N.glowDot(ctx, ink, hx, hy, 8, 1);
  },
});
