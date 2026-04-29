// Perd — Screens: Inventory + Packs + Pack detail + Account
function InventoryView({ state, setState, go }) {
  const allItems = PerdData.items;
  const owned = allItems.filter(i => state.owned[i.id] ?? i.owned);
  const grouped = PerdUtils.groupBy(owned, 'category');
  const baseW = PerdUtils.sumWeight(owned.filter(i => i.kind === 'base'));
  const wornW = PerdUtils.sumWeight(owned.filter(i => i.kind === 'worn'));
  const consW = PerdUtils.sumWeight(owned.filter(i => i.kind === 'consumable'));
  const total = baseW + wornW + consW;

  return (
    <div className="view view-transition">
      <div className="page">
        <div className="section-head">
          <div>
            <div className="section-label">My gear · {owned.length} items</div>
            <h1 className="section-title">The <em>kit</em></h1>
            <p className="section-sub">Everything you own, organized by function.</p>
          </div>
          <Button variant="primary" icon="plus" onClick={() => go('/catalog')}>Add from catalog</Button>
        </div>

        <Card style={{ marginBottom: 'var(--sp-6)', position: 'relative', overflow: 'hidden' }}>
          <TopoBackdrop opacity={0.07} seed={3} />
          <div style={{ display: 'flex', gap: 'var(--sp-6)', alignItems: 'center', flexWrap: 'wrap' }}>
            <WeightRing base={baseW} worn={wornW} consumable={consW} size={148} thickness={14} unit={state.unit} />
            <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              <BreakdownRow color="var(--accent)" label="Base" items={owned.filter(i=>i.kind==='base').length} weight={baseW} total={total} unit={state.unit} />
              <BreakdownRow color="var(--support)" label="Worn" items={owned.filter(i=>i.kind==='worn').length} weight={wornW} total={total} unit={state.unit} />
              <BreakdownRow color="var(--ink-3)" label="Consumable" items={owned.filter(i=>i.kind==='consumable').length} weight={consW} total={total} unit={state.unit} />
            </div>
          </div>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
          {[...grouped.entries()].map(([catId, items]) => {
            const cat = PerdData.catById(catId);
            const gTotal = PerdUtils.sumWeight(items);
            const fw = PerdUtils.formatWeight(gTotal, state.unit);
            return (
              <div className="group" key={catId}>
                <div className="group-head">
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--r-sm)', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'grid', placeItems: 'center' }}>
                    <Icon name={cat.icon} size={18} />
                  </div>
                  <div>
                    <div className="group-title">{cat.name}</div>
                    <div className="group-count">{items.length} item{items.length === 1 ? '' : 's'}</div>
                  </div>
                  <div className="group-total mono">
                    {fw.value}<span style={{ color: 'var(--ink-mute)', marginLeft: 2, fontSize: '0.85em' }}>{fw.unit}</span>
                  </div>
                </div>
                {items.map(it => (
                  <CatalogRow key={it.id} item={it} unit={state.unit} onClick={() => go(`/catalog/${it.id}`)} />
                ))}
              </div>
            );
          })}
          {owned.length === 0 && (
            <div className="empty">
              <div className="empty-glyph"><Icon name="backpack" size={28}/></div>
              <h3>No gear yet</h3>
              <p style={{ marginBottom: 'var(--sp-4)' }}>Start by browsing the catalog and marking items you own.</p>
              <Button variant="primary" icon="plus" onClick={() => go('/catalog')}>Open catalog</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PacksView({ state, go }) {
  const { packs } = PerdData;
  return (
    <div className="view view-transition">
      <div className="page">
        <div className="section-head">
          <div>
            <div className="section-label">Trips · {packs.length} packs</div>
            <h1 className="section-title">Trips in <em>motion</em></h1>
            <p className="section-sub">One list per adventure. Compose it from your kit and leave nothing behind.</p>
          </div>
          <Button variant="primary" icon="plus">New pack</Button>
        </div>
        <div className="grid-3">
          {packs.map(p => {
            const pItems = p.items.map(id => PerdData.byId(id)).filter(Boolean);
            const totalW = PerdUtils.sumWeight(pItems);
            const baseW = PerdUtils.sumWeight(pItems.filter(i=>i.kind==='base'));
            return (
              <div className="pack-card" key={p.id} onClick={() => go(`/packs/${p.slug}`)}>
                <TopoBackdrop opacity={0.1} seed={p.id.charCodeAt(1) * 0.1} />
                <div className="pack-card-kicker"><Icon name="pin" size={10} style={{display:'inline', verticalAlign:'middle', marginRight:4}}/> {p.trip}</div>
                <div className="pack-card-name">{p.name}</div>
                <div className="pack-card-meta"><Icon name="calendar" size={14}/> <span>{p.start}</span></div>
                <div className="pack-card-stats">
                  <div>
                    <div className="pack-card-stat-label">Items</div>
                    <div className="pack-card-stat-value mono">{pItems.length}</div>
                  </div>
                  <div>
                    <div className="pack-card-stat-label">Base</div>
                    <div className="pack-card-stat-value mono">{PerdUtils.formatWeight(baseW, state.unit).value}</div>
                  </div>
                  <div>
                    <div className="pack-card-stat-label">Total</div>
                    <div className="pack-card-stat-value mono">{PerdUtils.formatWeight(totalW, state.unit).value}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PackDetailView({ state, go, slug }) {
  const pack = PerdData.packs.find(p => p.slug === slug);
  if (!pack) {
    return (
      <div className="view view-transition"><div className="page">
        <div className="empty">
          <div className="empty-glyph"><Icon name="route" size={28}/></div>
          <h3>Pack not found</h3>
          <Button variant="secondary" icon="arrowL" onClick={() => go('/packs')}>Back to packs</Button>
        </div>
      </div></div>
    );
  }
  const pItems = pack.items.map(id => PerdData.byId(id)).filter(Boolean);
  const grouped = PerdUtils.groupBy(pItems, 'category');
  const baseW = PerdUtils.sumWeight(pItems.filter(i => i.kind === 'base'));
  const wornW = PerdUtils.sumWeight(pItems.filter(i => i.kind === 'worn'));
  const consW = PerdUtils.sumWeight(pItems.filter(i => i.kind === 'consumable'));

  return (
    <div className="view view-transition">
      <div className="page">
        <div style={{ marginBottom: 'var(--sp-5)' }}>
          <Button variant="ghost" icon="arrowL" size="sm" onClick={() => go('/packs')}>Packs</Button>
        </div>

        <section className="hero" style={{ padding: 'var(--sp-8) var(--sp-6)' }}>
          <TopoBackdrop opacity={0.16} seed={2.3} />
          <span className="hero-kicker"><Icon name="calendar" size={11}/> {pack.start}</span>
          <h1 className="hero-title" style={{ fontSize: 'var(--fs-3xl)' }}>{pack.name}</h1>
          <p className="hero-sub">{pack.trip} · {pItems.length} items</p>

          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-label">Base</div>
              <div className="hero-stat-value mono">{PerdUtils.formatWeight(baseW, state.unit).value}<span className="unit">{PerdUtils.formatWeight(baseW, state.unit).unit}</span></div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-label">Worn</div>
              <div className="hero-stat-value mono">{PerdUtils.formatWeight(wornW, state.unit).value}<span className="unit">{PerdUtils.formatWeight(wornW, state.unit).unit}</span></div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-label">Consumable</div>
              <div className="hero-stat-value mono">{PerdUtils.formatWeight(consW, state.unit).value}<span className="unit">{PerdUtils.formatWeight(consW, state.unit).unit}</span></div>
            </div>
          </div>
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)', marginTop: 'var(--sp-8)' }}>
          {[...grouped.entries()].map(([catId, items]) => {
            const cat = PerdData.catById(catId);
            const gTotal = PerdUtils.sumWeight(items);
            const fw = PerdUtils.formatWeight(gTotal, state.unit);
            return (
              <div className="group" key={catId}>
                <div className="group-head">
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--r-sm)', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'grid', placeItems: 'center' }}>
                    <Icon name={cat.icon} size={18} />
                  </div>
                  <div>
                    <div className="group-title">{cat.name}</div>
                    <div className="group-count">{items.length} item{items.length === 1 ? '' : 's'}</div>
                  </div>
                  <div className="group-total mono">
                    {fw.value}<span style={{ color: 'var(--ink-mute)', marginLeft: 2, fontSize: '0.85em' }}>{fw.unit}</span>
                  </div>
                </div>
                {items.map(it => (
                  <CatalogRow key={it.id} item={it} unit={state.unit} onClick={() => go(`/catalog/${it.id}`)} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AccountView({ state }) {
  return (
    <div className="view view-transition">
      <div className="page">
        <div className="section-head">
          <div>
            <div className="section-label">Profile</div>
            <h1 className="section-title">Your <em>field log</em></h1>
          </div>
        </div>

        <div className="grid-2">
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
              <Avatar name="Ivan" size={64} />
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-2xl)', letterSpacing: '-0.01em', lineHeight: 1 }}>Ivan Khr.</div>
                <div style={{ color: 'var(--ink-3)', marginTop: 4 }}>ivan@perd.workers.dev</div>
                <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                  <Pill tone="outline">Free plan</Pill>
                  <Pill tone="accent" icon="sparkle">Contributor</Pill>
                </div>
              </div>
            </div>
            <Button variant="secondary" icon="settings">Edit profile</Button>
          </Card>
          <Card>
            <div className="section-label" style={{ marginBottom: 'var(--sp-3)' }}>Stats</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
              <Stat label="Gear owned" value={PerdData.items.filter(i => state.owned[i.id] ?? i.owned).length}/>
              <Stat label="Trips" value={PerdData.packs.length}/>
              <Stat label="Countries" value={3}/>
              <Stat label="Last trip" value="Apr 6" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="section-label" style={{ marginBottom: 0 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-2xl)', letterSpacing: '-0.02em', marginTop: 2 }}>{value}</div>
    </div>
  );
}

Object.assign(window, { InventoryView, PacksView, PackDetailView, AccountView });
