import { useState } from 'react';

// Portraits ship in a later task (public/agents/<id>.png); until then — and on
// any missing/corrupt file on-device — fall back to an initial-letter disc.
export default function AgentPortrait({
  name,
  src,
  size,
}: {
  name: string;
  src: string;
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className="rounded-full bg-neutral-700 text-neutral-300 flex items-center justify-center font-semibold shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.42 }}
      >
        {name.charAt(0)}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      onError={() => setFailed(true)}
      className="rounded-full object-cover shrink-0"
      style={{ width: size, height: size }}
    />
  );
}
