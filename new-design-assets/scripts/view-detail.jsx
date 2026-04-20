// Perd — Screen: Item detail
function ItemDetailView({ state, setState, go, itemId }) {
  const item = PerdData.byId(itemId);
  if (!item) {
    return (
      <div className="view view-transition"><div className="page">
        <div className="empty">
          <div className="empty-glyph"><Icon name="close" size={28}/></div>
          <h3>Item not found</h3>
          <p style={{ marginBottom: 'var(--sp-4)' }}>This gear doesn't exist in the catalog.</p>
          <Button variant="secondary" icon="arrowL" onClick={() => go('/catalog')}>Back to catalog</Button>
        </div>
      </div></div>
    );
  }
  const brand = PerdData.brandById(item.brand);
  const cat = PerdData.catById(item.category);
  const owned = state.owned[item.id] ?? item.owned;
  const fw = PerdUtils.formatWeight(item.weight, state.unit);

  const toggleOwned = () => {
    setState(s => ({ ...s, owned: { ...s.owned, [item.id]: !owned } }));
  };

  const specs = item.specs || {};
  const specEntries = [
    { k: 'Category', v: cat.name },
    { k: 'Kind', v: item.kind[0].toUpperCase() + item.kind.slice(1) },
    ...Object.entries(specs).map(([k, v]) => ({
      k: k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
      v: String(v)
    })),
  ];

  return (
    <div className="view view-transition">
      <div className="page">
        <div style={{ marginBottom: 'var(--sp-5)' }}>
          <Button variant="ghost" icon="arrowL" size="sm" onClick={() => go('/catalog')}>Catalog</Button>
        </div>

        <div className="detail-grid">
          <div>
            <div className="detail-media">
              <TopoBackdrop opacity={0.25} seed={parseInt(item.id.slice(1)) * 0.3} />
              <Icon name={cat.icon} size={160} stroke={1} className="glyph" />
              <span style={{ position: 'absolute', top: 16, left: 16 }}>
                <Pill tone="outline" icon={cat.icon}>{cat.name}</Pill>
              </span>
              {owned && <span style={{ position: 'absolute', top: 16, right: 16 }}>
                <Pill tone="support" icon="check">In your kit</Pill>
              </span>}
            </div>
          </div>

          <div>
            <div className="detail-brand">{brand.name}</div>
            <h1 className="detail-title">{item.name}</h1>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-4)', marginTop: 'var(--sp-4)' }}>
              <div>
                <div className="section-label" style={{ marginBottom: 0 }}>Weight</div>
                <div className="display mono" style={{ fontSize: 'var(--fs-3xl)' }}>
                  {fw.value}<span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.4em', color: 'var(--ink-3)', marginLeft: 4 }}>{fw.unit}</span>
                </div>
              </div>
              <div style={{ borderLeft: '1px solid var(--hairline-soft)', paddingLeft: 'var(--sp-4)' }}>
                <div className="section-label" style={{ marginBottom: 0 }}>Rating</div>
                <div style={{ marginTop: 4 }}><Stars value={item.rating} /></div>
              </div>
            </div>

            <p className="detail-lede">
              {cat.name.toLowerCase()} essential from {brand.name}. Tested in variable conditions across three seasons; holds up to dawn frost and afternoon squalls alike.
            </p>

            <div className="spec-grid">
              {specEntries.map(s => (
                <div className="spec-item" key={s.k}>
                  <div className="spec-key">{s.k}</div>
                  <div className="spec-val">{s.v}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-6)', flexWrap: 'wrap' }}>
              {owned ? (
                <Button variant="danger" icon="minus" size="lg" onClick={toggleOwned}>Remove from my kit</Button>
              ) : (
                <Button variant="primary" icon="plus" size="lg" onClick={toggleOwned}>I have this</Button>
              )}
              <Button variant="secondary" icon="route" size="lg">Add to pack</Button>
              <IconButton icon="share" label="Share" size="icon" variant="secondary" />
              <IconButton icon="heart" label="Wishlist" size="icon" variant="secondary" />
            </div>
          </div>
        </div>

        {/* Compare strip */}
        <section style={{ marginTop: 'var(--sp-12)' }}>
          <div className="section-head">
            <div>
              <div className="section-label">Similar kit</div>
              <h2 className="section-title">Lighter <em>alternatives</em></h2>
            </div>
          </div>
          <div className="grid-3">
            {PerdData.items
              .filter(i => i.category === item.category && i.id !== item.id)
              .slice(0, 3)
              .map(i => {
                const dFw = PerdUtils.formatWeight(i.weight, state.unit);
                const diff = i.weight - item.weight;
                const sign = diff < 0 ? '−' : '+';
                const tone = diff < 0 ? 'support' : 'warn';
                return (
                  <Card key={i.id} interactive onClick={() => go(`/catalog/${i.id}`)}>
                    <div className="detail-brand">{PerdData.brandById(i.brand).name}</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-xl)', letterSpacing: '-0.01em', lineHeight: 1.1, marginTop: 2 }}>{i.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 'var(--sp-3)' }}>
                      <span className="mono">{dFw.value}<span style={{ color: 'var(--ink-mute)', marginLeft: 2 }}>{dFw.unit}</span></span>
                      <Pill tone={tone}>{sign}{PerdUtils.formatWeight(Math.abs(diff), state.unit).value}{PerdUtils.formatWeight(Math.abs(diff), state.unit).unit}</Pill>
                    </div>
                  </Card>
                );
              })
            }
          </div>
        </section>
      </div>
    </div>
  );
}

Object.assign(window, { ItemDetailView });
