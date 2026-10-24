// Pager dots for a multi-page app, drawn where the Fields skin draws its own
// (src/core/fields.tsx: centre y 968 of 1080, r 6, pitch 22). Before this
// widget five Classic apps each drew 6 px dots at the disc's bottom edge,
// inside the bezel shadow on the round panels. One size, one position.
//
// Colour comes from the parent's text colour (`bg-current`), so an app on
// the palette passes `text-(--face-ink)` and an always-dark app `text-white`.

export default function PageDots({ count, index }: { count: number; index: number }) {
  if (count < 2) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute bottom-[9.8%] left-1/2 flex -translate-x-1/2 gap-[0.93vmin]"
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          data-dot
          data-current={i === index ? 'true' : 'false'}
          className={`h-[1.1vmin] w-[1.1vmin] rounded-full bg-current transition-opacity ${
            i === index ? 'opacity-100' : 'opacity-35'
          }`}
        />
      ))}
    </div>
  );
}
