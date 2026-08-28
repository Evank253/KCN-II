type Props = { className?: string; prefix?: string };

export function Seal({ className = "h-14 w-14 drop-shadow-[0_0_12px_rgba(212,175,55,0.45)]", prefix = "app" }: Props) {
  const g = `${prefix}-g`;
  const gold = `${prefix}-gold`;
  return (
    <svg viewBox="0 0 200 200" className={className} aria-label="KCN-II emblem">
      <defs>
        <radialGradient id={g} cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#1b2c44" />
          <stop offset="100%" stopColor="#070b12" />
        </radialGradient>
        <linearGradient id={gold} x1="0" x2="1">
          <stop offset="0%" stopColor="#8d6b16" />
          <stop offset="50%" stopColor="#f4d675" />
          <stop offset="100%" stopColor="#8d6b16" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="96" fill={`url(#${g})`} stroke={`url(#${gold})`} strokeWidth="4" />
      <circle cx="100" cy="100" r="86" fill="none" stroke="#c43b3b" strokeWidth="2" opacity=".85" />
      <circle cx="100" cy="100" r="78" fill="none" stroke={`url(#${gold})`} strokeWidth="1.4" />
      <path d="M100 28 L108 48 L130 50 L114 64 L118 86 L100 74 L82 86 L86 64 L70 50 L92 48 Z" fill={`url(#${gold})`} />
      <path d="M58 118c18-28 66-28 84 0-8 26-76 26-84 0z" fill="none" stroke="#6ee7f5" strokeWidth="2" />
      <text x="100" y="128" textAnchor="middle" fontFamily="Rajdhani,sans-serif" fontSize="34" fontWeight="700" fill="#f4d675">
        K
      </text>
      <text x="122" y="108" textAnchor="middle" fontFamily="Rajdhani,sans-serif" fontSize="11" fill="#6ee7f5">
        CN
      </text>
      <text x="78" y="146" textAnchor="middle" fontFamily="Rajdhani,sans-serif" fontSize="12" fill="#6ee7f5">
        II
      </text>
    </svg>
  );
}
