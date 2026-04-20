// Perd — Screen: Dashboard (compact, practical)
function DashboardView({ state, go }) {
  const { items, packs } = PerdData;
  const owned = items.filter(i => i.owned);
  const ownedBase = owned.filter(i => i.kind === 'base');
  const ownedWorn = owned.filter(i => i.kind === 'worn');
  const ownedCons = owned.filter(i => i.kind === 'consumable');
  const baseW = PerdUtils.sumWeight(ownedBase);
  const wornW = PerdUtils.sumWeight(ownedWorn);
  const consW = PerdUtils.sumWeight(ownedCons);
  const total = baseW + wornW + consW;

  const recent = [...owned].slice(-6).reverse();
  const nextPack = packs[0];
  const nextPackItems = nextPack.items.map(id => PerdData.byId(id)).filter(Boolean);
  const nextPackTotal = PerdUtils.sumWeight(nextPackItems);
  const nextPackBase = PerdUtils.sumWeight(nextPackItems.filter(i => i.kind === 'base'));

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  const fmt = (g) => PerdUtils.formatWeight(g, state.unit);

  return (
    <div className="view view-transition">
      <div className="page">

        {/* ————— HEADER STRIP ————— */}
        <section className="dash-head rise">
          <div>
            <div className="section-label" style={{ marginBottom: 2 }}>
              <Icon name="pin" size={11} style={{ marginRight: 4, verticalAlign: '-1px' }} />
              Base camp · {today}
            </div>
            <h1 className="dash-hello">Good morning, Kira.</h1>
          </div>
          <div className="dash-head-actions">
            <Button variant="secondary" size="md" icon="plus" onClick={() => go('/catalog')}>Add gear</Button>
            <Button variant="primary" size="md" icon="route" onClick={() => go(`/packs/${nextPack.slug}`)}>Open next trip</Button>
          </div>
        </section>

        {/* ————— KPI RIBBON ————— */}
        <section className="kpi-ribbon">
          <Kpi label="Base weight" value={fmt(baseW).value} unit={fmt(baseW).unit} />
          <Kpi label="Owned items" value={owned.length} />
          <Kpi label="Packs" value={packs.length} />
          <Kpi label="Consumables" value={fmt(consW).value} unit={fmt(consW).unit} muted />
        </section>

        {/* ————— MAIN GRID ————— */}
        <section className="dash-grid">
          {/* Next trip — wide card */}
          <Card as="button"
            interactive
            onClick={() => go(`/packs/${nextPack.slug}`)}
            className="dash-trip-card"
            style={{ textAlign: 'left', position: 'relative', overflow: 'hidden' }}>
            <TopoBackdrop opacity={0.07} seed={1.2} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--sp-4)', position: 'relative' }}>
              <div>
                <div className="section-label" style={{ marginBottom: 4 }}>Next trip</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-3xl)', lineHeight: 1.02, letterSpacing: '-0.02em', paddingBottom: '0.06em' }}>
                  {nextPack.name}
                </div>
                <div style={{ color: 'var(--ink-3)', marginTop: 'var(--sp-2)', fontSize: 'var(--fs-sm)' }}>
                  {nextPack.trip} · departs {nextPack.start}
                </div>
              </div>
              <Pill tone="accent">{nextPackItems.length} items</Pill>
            </div>
            <div className="dash-trip-stats">
              <div>
                <div className="section-label" style={{ marginBottom: 2 }}>Total</div>
                <div className="mono dash-stat-num">{fmt(nextPackTotal).value}<span className="u">{fmt(nextPackTotal).unit}</span></div>
              </div>
              <div>
                <div className="section-label" style={{ marginBottom: 2 }}>Base</div>
                <div className="mono dash-stat-num">{fmt(nextPackBase).value}<span className="u">{fmt(nextPackBase).unit}</span></div>
              </div>
              <div>
                <div className="section-label" style={{ marginBottom: 2 }}>Owned</div>
                <div className="mono dash-stat-num">
                  {nextPackItems.filter(i => i.owned).length}<span className="u">/{nextPackItems.length}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Weight breakdown — tall card */}
          <Card className="dash-weight-card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div className="section-label">Weight breakdown</div>
              <span className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-mute)' }}>All owned gear</span>
            </div>

            <div style={{ display: 'flex', gap: 'var(--sp-5)', alignItems: 'center' }}>
              <WeightRing base={baseW} worn={wornW} consumable={consW} size={132} thickness={14} unit={state.unit} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                <BreakdownRow color="var(--accent)"   label="Base"       items={ownedBase.length} weight={baseW} total={total} unit={state.unit} />
                <BreakdownRow color="var(--support)"  label="Worn"       items={ownedWorn.length} weight={wornW} total={total} unit={state.unit} />
                <BreakdownRow color="var(--ink-3)"    label="Consumable" items={ownedCons.length} weight={consW} total={total} unit={state.unit} />
              </div>
            </div>
          </Card>
        </section>

        {/* ————— OTHER PACKS ————— */}
        {packs.length > 1 && (
          <section style={{ marginTop: 'var(--sp-7)' }}>
            <div className="section-head">
              <div>
                <div className="section-label">Other trips</div>
                <h2 className="section-title-sm">Your lineup</h2>
              </div>
              <Button variant="ghost" iconRight="arrow" onClick={() => go('/packs')}>All packs</Button>
            </div>
            <div className="pack-strip">
              {packs.slice(1, 5).map(p => {
                const its = p.items.map(id => PerdData.byId(id)).filter(Boolean);
                const t = PerdUtils.sumWeight(its);
                return (
                  <Card key={p.id} as="button" interactive
                    onClick={() => go(`/packs/${p.slug}`)}
                    className="pack-strip-card"
                    style={{ textAlign: 'left' }}>
                    <div className="section-label">{p.trip}</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-xl)', lineHeight: 1.1, marginTop: 2, letterSpacing: '-0.015em' }}>{p.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 'var(--sp-4)' }}>
                      <span style={{ color: 'var(--ink-mute)', fontSize: 'var(--fs-xs)' }}>{its.length} items</span>
                      <span className="mono" style={{ fontSize: 'var(--fs-sm)' }}>
                        {fmt(t).value}<span style={{ color: 'var(--ink-mute)', marginLeft: 2, fontSize: '0.85em' }}>{fmt(t).unit}</span>
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* ————— RECENT ————— */}
        <section style={{ marginTop: 'var(--sp-7)' }}>
          <div className="section-head">
            <div>
              <div className="section-label">Latest additions</div>
              <h2 className="section-title-sm">Recent gear</h2>
            </div>
            <Button variant="ghost" iconRight="arrow" onClick={() => go('/inventory')}>Open inventory</Button>
          </div>
          <div className="grid-4">
            {recent.map(item => (
              <Card key={item.id} interactive onClick={() => go(`/catalog/${item.id}`)} style={{ padding: 'var(--sp-4)' }}>
                <div style={{ aspectRatio: '5/4', borderRadius: 'var(--r-md)', background: 'var(--surface-2)', marginBottom: 'var(--sp-3)', position: 'relative', overflow: 'hidden', display: 'grid', placeItems: 'center', border: '1px solid var(--hairline-soft)' }}>
                  <TopoBackdrop opacity={0.1} seed={parseInt(item.id.slice(1)) * 0.3} />
                  <Icon name={PerdData.catById(item.category).icon} size={36} stroke={1.2} style={{ color: 'var(--ink-2)', opacity: 0.7 }} />
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-micro)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>
                  {PerdData.brandById(item.brand).name}
                </div>
                <div style={{ fontWeight: 500, fontSize: 'var(--fs-sm)', marginTop: 2, lineHeight: 1.2, letterSpacing: '-0.005em' }}>
                  {item.name}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--sp-3)' }}>
                  <Pill tone="outline">{PerdData.catById(item.category).name}</Pill>
                  <span className="mono" style={{ fontSize: 'var(--fs-xs)' }}>
                    {fmt(item.weight).value}
                    <span style={{ color: 'var(--ink-mute)', marginLeft: 2 }}>{fmt(item.weight).unit}</span>
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}

function Kpi({ label, value, unit, muted }) {
  return (
    <div className="kpi" data-muted={muted || undefined}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value mono">
        {value}
        {unit && <span className="kpi-unit">{unit}</span>}
      </div>
    </div>
  );
}

function BreakdownRow({ color, label, items, weight, total, unit }) {
  const pct = total ? Math.round((weight / total) * 100) : 0;
  const fw = PerdUtils.formatWeight(weight, unit);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-sm)', fontWeight: 500 }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: color }} />
          {label}
          <span style={{ color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-micro)' }}>{items}</span>
        </span>
        <span className="mono" style={{ fontSize: 'var(--fs-sm)' }}>{fw.value}<span style={{ color: 'var(--ink-mute)', marginLeft: 2 }}>{fw.unit}</span></span>
      </div>
      <div className="meter-track" style={{ height: 4 }}>
        <div className="meter-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

Object.assign(window, { DashboardView, Kpi });
