// The nine weather condition marks, drawn.
//
// These replace the colour emoji the conditions ring used to render. That was
// a deliberate choice once — colour emoji ignore SVG `fill`, so the ring drew
// them untinted — but it cost more than it bought: stock system glyphs on an
// otherwise flat monochrome dial, at a different visual weight from everything
// around them, unable to dim at night with the rest of the ring, and rendered
// differently on every platform the admin is opened from.
//
// Drawn marks take the ring's colour through `currentColor`, so the dial's
// existing `colorOf` and its night dimming reach them like any other value.
//
// House rules for the set: one visual weight, filled forms rather than thin
// outlines (the panel is ~216 DPI and read from across a room), each mark
// inside a 48-unit box centred on the origin so the ring can place it with a
// plain translate. No mark uses more than one colour.

export type ConditionMarkId =
  | 'sun'
  | 'moon'
  | 'partly'
  | 'cloud'
  | 'fog'
  | 'rain'
  | 'snow'
  | 'snow-shower'
  | 'storm';

const RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/** Sun: a disc and eight rays. `r` shrinks it for the partly-cloudy pairing. */
function Sun({ cx = 0, cy = 0, r = 8 }: { cx?: number; cy?: number; r?: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="currentColor" />
      {RAY_ANGLES.map((a) => {
        const rad = (a * Math.PI) / 180;
        const x1 = cx + Math.cos(rad) * (r + 4.5);
        const y1 = cy + Math.sin(rad) * (r + 4.5);
        const x2 = cx + Math.cos(rad) * (r + 10);
        const y2 = cy + Math.sin(rad) * (r + 10);
        return (
          <line
            key={a}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeWidth={3.4}
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
}

// Overlapping discs plus a base, all one fill, read as a single cloud without
// a hand-authored path that would need re-tuning at every size.
function Cloud({ cx = 0, cy = 0, s = 1 }: { cx?: number; cy?: number; s?: number }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${s})`} fill="currentColor">
      <circle cx={-10} cy={2} r={8} />
      <circle cx={1} cy={-5} r={11} />
      <circle cx={12} cy={3} r={7} />
      <rect x={-10} y={2} width={22} height={8} rx={4} />
    </g>
  );
}

function Drops({ y, dx = 0 }: { y: number; dx?: number }) {
  return (
    <g stroke="currentColor" strokeWidth={3.4} strokeLinecap="round">
      {[-9, 0, 9].map((x) => (
        <line key={x} x1={x + dx} y1={y} x2={x + dx - 3} y2={y + 8} />
      ))}
    </g>
  );
}

function Flakes({ y }: { y: number }) {
  return (
    <g fill="currentColor">
      {[-9, 0, 9].map((x) => (
        <circle key={x} cx={x} cy={y + 4} r={2.6} />
      ))}
    </g>
  );
}

/**
 * One condition mark, centred on the origin in a 48-unit box.
 *
 * Colour comes from `currentColor`, so the caller sets it once on a parent and
 * every mark follows — including the ring's night dimming.
 */
export default function ConditionMark({ id }: { id: ConditionMarkId }) {
  switch (id) {
    case 'sun':
      return <Sun />;

    // One closed path, not a disc masked by a second disc: the ring draws a
    // mark per night hour, and a mask would need an id that is unique per
    // instance or the duplicates collide in the document.
    //
    // Two arcs between the same pair of points: the outer edge sweeps the long
    // way round (large-arc 1), the terminator comes back the SHORT way
    // (large-arc 0). Setting large-arc on the return makes it bulge the same
    // direction as the outer edge and the crescent collapses to a hairline —
    // which is exactly what it did on first draw. The return x-radius then
    // sets the body: 7 holds its weight beside the filled sun and cloud marks
    // and survives the ring dimming night hours to 55%.
    case 'moon':
      return <path d="M 5 -12.5 A 13 13 0 1 0 5 12.5 A 7 13 0 0 1 5 -12.5 Z" fill="currentColor" />;

    case 'partly':
      return (
        <g>
          <Sun cx={-6} cy={-9} r={6} />
          <Cloud cx={3} cy={5} s={0.86} />
        </g>
      );

    case 'cloud':
      return <Cloud />;

    case 'fog':
      return (
        <g>
          <Cloud cy={-5} s={0.86} />
          <g stroke="currentColor" strokeWidth={3.4} strokeLinecap="round">
            <line x1={-13} y1={11} x2={13} y2={11} />
            <line x1={-9} y1={18} x2={16} y2={18} />
          </g>
        </g>
      );

    case 'rain':
      return (
        <g>
          <Cloud cy={-6} s={0.86} />
          <Drops y={9} />
        </g>
      );

    // A six-arm star, not a naturalistic flake: three crossed strokes stay
    // legible when the ring dims to 55% at night.
    case 'snow':
      return (
        <g stroke="currentColor" strokeWidth={3.4} strokeLinecap="round">
          {[0, 60, 120].map((a) => {
            const rad = (a * Math.PI) / 180;
            return (
              <line
                key={a}
                x1={-Math.cos(rad) * 13}
                y1={-Math.sin(rad) * 13}
                x2={Math.cos(rad) * 13}
                y2={Math.sin(rad) * 13}
              />
            );
          })}
        </g>
      );

    case 'snow-shower':
      return (
        <g>
          <Cloud cy={-6} s={0.86} />
          <Flakes y={9} />
        </g>
      );

    case 'storm':
      return (
        <g>
          <Cloud cy={-7} s={0.86} />
          <path d="M 2 4 L -7 4 L -1 20 L 3 12 L 10 12 L 3 -1 Z" fill="currentColor" />
        </g>
      );
  }
}
