// Perd — Tweaks panel
const ACCENT_PRESETS = [
  { id: 'moss',    color: 'oklch(46% 0.09 145)',  name: 'Moss' },
  { id: 'fern',    color: 'oklch(54% 0.12 150)',  name: 'Fern' },
  { id: 'pine',    color: 'oklch(36% 0.06 155)',  name: 'Pine' },
  { id: 'ink',     color: 'oklch(25% 0.015 165)', name: 'Ink' },
];

function TweaksPanel({ state, setState, visible, onClose }) {
  if (!visible) return null;
  const presets = ACCENT_PRESETS;

  return (
    <div className="tweaks">
      <div className="tweaks-head">
        <Icon name="settings" size={18} />
        <span className="tweaks-title">Tweaks</span>
        <div style={{ flex: 1 }} />
        <IconButton icon="close" label="Close" size="icon-sm" onClick={onClose} />
      </div>
      <div className="tweaks-body">

        <div className="tweak-row">
          <div className="tweak-label">Theme</div>
          <Seg
            size="sm"
            value={state.theme}
            onChange={v => setState(s => ({ ...s, theme: v }))}
            options={[
              { value: 'light', label: 'Light', icon: 'sun' },
              { value: 'dark', label: 'Dark', icon: 'moon' },
            ]}
          />
        </div>

        <div className="tweak-row">
          <div className="tweak-label">Accent</div>
          <div className="accent-chips">
            {presets.map(p => (
              <button key={p.id}
                className="accent-chip"
                style={{ '--c': p.color }}
                data-active={(state.accent || presets[0].id) === p.id || undefined}
                onClick={() => setState(s => ({ ...s, accent: p.id, accentColor: p.color }))}
                aria-label={p.name}
                title={p.name}
              />
            ))}
          </div>
        </div>

        <div className="tweak-row">
          <div className="tweak-label">Density</div>
          <Seg
            size="sm"
            value={state.density}
            onChange={v => setState(s => ({ ...s, density: v }))}
            options={[
              { value: 'airy', label: 'Airy' },
              { value: 'balanced', label: 'Balanced' },
              { value: 'dense', label: 'Dense' },
            ]}
          />
        </div>

        <div className="tweak-row">
          <div className="tweak-label">Weight unit</div>
          <Seg
            size="sm"
            value={state.unit}
            onChange={v => setState(s => ({ ...s, unit: v }))}
            options={[
              { value: 'g', label: 'g' },
              { value: 'kg', label: 'kg' },
              { value: 'oz', label: 'oz' },
              { value: 'lb', label: 'lb' },
            ]}
          />
        </div>

        <button className="btn" data-variant="ghost" data-size="sm"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => setState(s => ({ ...s, theme: 'light', accent: null, accentColor: null, density: 'balanced', unit: 'g' }))}
        >
          <Icon name="sparkle" size={13}/> Reset to defaults
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { TweaksPanel, ACCENT_PRESETS });
