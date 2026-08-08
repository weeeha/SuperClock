import { useMemo } from 'react';
import type { CalendarEvent } from '../../api/types';
import { dayKey, eventDayKeys, type WeekStart } from './calendar-utils';

interface YearViewProps {
  focusDate: Date;
  now: Date;
  events: CalendarEvent[];
  weekStart: WeekStart;
  onSelectMonth: (month: number) => void;
  onStepYear: (delta: number) => void;
}

const ORANGE = '#FF8A1E';
const GRAY = '#8A8A8A';
const C = 500;
const SECTOR = 30; // degrees per month, JAN centered at 12 o'clock, clockwise
const PAD = 3.5; // degrees trimmed from each sector edge before laying dots
const R_WEEK0 = 430; // outermost week ring
const RING_STEP = 33;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** angleDeg: 0 = 12 o'clock, increasing clockwise. */
function polar(r: number, angleDeg: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [C + r * Math.sin(a), C - r * Math.cos(a)];
}

function wedgePath(month: number, r1: number, r2: number): string {
  const a0 = month * SECTOR - SECTOR / 2;
  const a1 = month * SECTOR + SECTOR / 2;
  const [x1, y1] = polar(r2, a0);
  const [x2, y2] = polar(r2, a1);
  const [x3, y3] = polar(r1, a1);
  const [x4, y4] = polar(r1, a0);
  return `M${x1.toFixed(1)},${y1.toFixed(1)} A${r2},${r2} 0 0 1 ${x2.toFixed(1)},${y2.toFixed(1)} ` +
    `L${x3.toFixed(1)},${y3.toFixed(1)} A${r1},${r1} 0 0 0 ${x4.toFixed(1)},${y4.toFixed(1)} Z`;
}

interface DayDot {
  key: string; // local dayKey — joins against the event-day set
  x: number;
  y: number;
}

/** Every day of the year as a dot: angle within the month sector by weekday,
 *  radius by week-of-month ring. Pure geometry — one build per (year, weekStart). */
function buildDots(year: number, weekStart: WeekStart): DayDot[] {
  const dots: DayDot[] = [];
  for (let m = 0; m < 12; m++) {
    const first = new Date(year, m, 1);
    const dow = first.getDay(); // 0=Sun..6=Sat
    const offset = weekStart === 'monday' ? (dow + 6) % 7 : dow;
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const a0 = m * SECTOR - SECTOR / 2 + PAD;
    const span = SECTOR - 2 * PAD;
    for (let day = 1; day <= daysInMonth; day++) {
      const slot = offset + day - 1;
      const weekIdx = Math.floor(slot / 7);
      const dowIdx = slot % 7;
      const [x, y] = polar(R_WEEK0 - weekIdx * RING_STEP, a0 + (dowIdx / 6) * span);
      dots.push({ key: dayKey(new Date(year, m, day)), x, y });
    }
  }
  return dots;
}

/** Radial year: 12 sectors, dots-only heat-ring for days, tap a sector to zoom in. */
export default function YearView({
  focusDate, now, events, weekStart, onSelectMonth, onStepYear,
}: YearViewProps) {
  const year = focusDate.getFullYear();
  const dots = useMemo(() => buildDots(year, weekStart), [year, weekStart]);
  const eventDays = useMemo(() => eventDayKeys(events), [events]);
  const todayKey = dayKey(now);

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      <svg viewBox="0 0 1000 1000" className="w-full h-full">
        {/* Sector divider lines */}
        {MONTHS.map((_, m) => {
          const a = m * SECTOR + SECTOR / 2;
          const [x1, y1] = polar(250, a);
          const [x2, y2] = polar(447, a);
          return (
            <line key={m} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          );
        })}

        {/* Month labels */}
        {MONTHS.map((label, m) => {
          const [x, y] = polar(470, m * SECTOR);
          return (
            <text key={label} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
              fill={GRAY} fontSize="22" fontFamily="Inter, sans-serif">
              {label}
            </text>
          );
        })}

        {/* Day dots — heat-ring */}
        {dots.map((d) => {
          const has = eventDays.has(d.key);
          return (
            <circle key={d.key} cx={d.x} cy={d.y}
              r={has ? 6 : 3.5}
              fill={has ? ORANGE : 'rgba(255,255,255,0.22)'} />
          );
        })}

        {/* Today: ring outline marker */}
        {dots.filter((d) => d.key === todayKey).map((d) => (
          <circle key="today" cx={d.x} cy={d.y} r={11}
            fill="none" stroke="#fff" strokeWidth="2" />
        ))}

        {/* Center year */}
        <text x={C} y={C} textAnchor="middle" dominantBaseline="middle"
          fill={ORANGE} fontSize="96" fontWeight="700" fontFamily="Inter, sans-serif">
          {year}
        </text>

        {/* Invisible tap wedges — one per month sector */}
        {MONTHS.map((_, m) => (
          <path key={m} d={wedgePath(m, 130, 475)} fill="transparent"
            onClick={() => onSelectMonth(m)} style={{ cursor: 'pointer' }} />
        ))}
      </svg>

      {/* Rim zones: tap left/right edge to step years. */}
      <button
        aria-label="Previous year"
        onClick={() => onStepYear(-1)}
        className="absolute left-0 top-0 bottom-0 w-[15%] bg-transparent border-0"
      />
      <button
        aria-label="Next year"
        onClick={() => onStepYear(1)}
        className="absolute right-0 top-0 bottom-0 w-[15%] bg-transparent border-0"
      />
    </div>
  );
}
