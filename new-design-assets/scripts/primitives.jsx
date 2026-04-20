// Perd — Shared primitives (React)
// Exports: Icon, IconButton, Button, Pill, Card, Meter, Avatar, TopoBackdrop, Seg, Tabs, Sheet, Tooltip

const { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } = React;

function cls(...xs) { return xs.filter(Boolean).join(' '); }

function Icon({ name, size = 20, stroke = 1.75, className, style }) {
  const d = PerdUtils.iconPath(name);
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style} aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

function Button({ variant = 'secondary', size, icon, iconRight, children, ...rest }) {
  return (
    <button className="btn" data-variant={variant} data-size={size} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 14 : 16} />}
    </button>
  );
}

function IconButton({ icon, label, size = 'icon', variant = 'ghost', ...rest }) {
  return (
    <button
      className="btn" data-variant={variant} data-size={size}
      aria-label={label} title={label} {...rest}
    >
      <Icon name={icon} size={size === 'icon-sm' ? 16 : 18} />
    </button>
  );
}

function Pill({ tone, icon, children, as = 'span', ...rest }) {
  const El = as;
  return (
    <El className="pill" data-tone={tone} {...rest}>
      {icon && <Icon name={icon} size={11} />}
      {children}
    </El>
  );
}

function Card({ interactive, as = 'div', className, children, ...rest }) {
  const El = as;
  return (
    <El className={cls('card', className)} data-interactive={interactive ? 'true' : undefined} {...rest}>
      {children}
    </El>
  );
}

// Horizontal meter / bar
function Meter({ value, max = 100, tone = 'accent', height = 6, label, sublabel }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="meter-wrap">
      {(label || sublabel) && (
        <div className="meter-head">
          <span>{label}</span>
          <span className="mono">{sublabel}</span>
        </div>
      )}
      <div className="meter-track" style={{ height }}>
        <div
          className="meter-fill"
          data-tone={tone}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// Avatar — first-letter circle with topo fill
function Avatar({ name = 'Perd', size = 36 }) {
  const letter = (name || '?')[0].toUpperCase();
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      <span>{letter}</span>
    </div>
  );
}

// Segmented control
function Seg({ options, value, onChange, size = 'md' }) {
  return (
    <div className="seg" data-size={size}>
      {options.map(o => (
        <button
          key={o.value}
          className="seg-opt"
          data-active={value === o.value || undefined}
          onClick={() => onChange(o.value)}
        >
          {o.icon && <Icon name={o.icon} size={14} />}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

// Topographic SVG backdrop — used as decoration on hero areas
function TopoBackdrop({ style, seed = 0, opacity = 0.14 }) {
  // deterministic contour lines using sine fields
  const lines = [];
  const W = 800, H = 320;
  for (let i = 0; i < 14; i++) {
    const amp = 10 + (i * 3);
    const phase = i * 0.4 + seed;
    const y = 20 + i * 22;
    let d = `M 0 ${y}`;
    for (let x = 0; x <= W; x += 16) {
      const yy = y + Math.sin(x * 0.012 + phase) * amp + Math.sin(x * 0.003 + phase * 0.7) * (amp * 0.6);
      d += ` L ${x} ${yy.toFixed(1)}`;
    }
    lines.push(d);
  }
  return (
    <svg
      className="topo-bg"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      style={{ opacity, ...style }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="topoFade" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.9"/>
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.1"/>
        </linearGradient>
      </defs>
      {lines.map((d, i) => (
        <path
          key={i} d={d}
          fill="none"
          stroke="url(#topoFade)"
          strokeWidth={i % 3 === 0 ? 1.4 : 0.6}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

// Weight breakdown ring — SVG donut with 3 kinds
function WeightRing({ base = 0, worn = 0, consumable = 0, size = 160, thickness = 14, unit }) {
  const total = base + worn + consumable;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const frac = (v) => total ? (v / total) * c : 0;

  const segments = [
    { key: 'base', v: frac(base), color: 'var(--accent)' },
    { key: 'worn', v: frac(worn), color: 'var(--support)' },
    { key: 'consumable', v: frac(consumable), color: 'var(--ink-3)' },
  ];

  let offset = 0;
  const fw = PerdUtils.formatWeight(total, unit);

  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke="var(--surface-2)" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const el = (
            <circle
              key={s.key}
              cx={size/2} cy={size/2} r={r}
              fill="none" stroke={s.color} strokeWidth={thickness}
              strokeDasharray={`${s.v} ${c - s.v}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${size/2} ${size/2})`}
              style={{ transition: 'stroke-dasharray 400ms var(--ease-out)' }}
            />
          );
          offset += s.v;
          return el;
        })}
      </svg>
      <div className="ring-label">
        <span className="ring-total mono">{fw.value}</span>
        <span className="ring-unit">{fw.unit} total</span>
      </div>
    </div>
  );
}

// Star rating as glyphs
function Stars({ value = 0 }) {
  return <span className="stars" aria-label={`${value} out of 5`}>
    {Array.from({ length: 5 }).map((_, i) => (
      <span key={i} data-on={i < Math.round(value) || undefined}>★</span>
    ))}
  </span>;
}

// Export
Object.assign(window, {
  cls, Icon, Button, IconButton, Pill, Card, Meter, Avatar, Seg, TopoBackdrop, WeightRing, Stars
});
