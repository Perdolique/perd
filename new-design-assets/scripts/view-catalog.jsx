// Perd — Screen: Catalog
function CatalogView({ state, go }) {
  const { items, categories } = PerdData;
  const [query, setQuery] = React.useState('');
  const [cat, setCat] = React.useState('all');
  const [view, setView] = React.useState('list');
  const [sort, setSort] = React.useState('weight');

  const filtered = React.useMemo(() => {
    let out = items;
    if (cat !== 'all') out = out.filter(i => i.category === cat);
    if (query) {
      const q = query.toLowerCase();
      out = out.filter(i =>
        i.name.toLowerCase().includes(q) ||
        PerdData.brandById(i.brand).name.toLowerCase().includes(q)
      );
    }
    if (sort === 'weight') out = [...out].sort((a,b) => a.weight - b.weight);
    if (sort === 'name') out = [...out].sort((a,b) => a.name.localeCompare(b.name));
    if (sort === 'rating') out = [...out].sort((a,b) => b.rating - a.rating);
    return out;
  }, [items, cat, query, sort]);

  return (
    <div className="view view-transition">
      <div className="page">
        <div className="section-head">
          <div>
            <div className="section-label">Catalog · {filtered.length} items</div>
            <h1 className="section-title">Browse the <em>kit</em></h1>
            <p className="section-sub">Everything worth carrying. Approved by the community, rated in the field.</p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <Seg
              size="sm"
              options={[
                { value: 'list', label: 'List', icon: 'list' },
                { value: 'grid', label: 'Grid', icon: 'grid' },
              ]}
              value={view}
              onChange={setView}
            />
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', marginBottom: 'var(--sp-4)', flexWrap: 'wrap' }}>
          <label className="input" style={{ minWidth: 220, flex: '1 1 260px' }}>
            <Icon name="search" size={16} />
            <input
              placeholder="Search items, brands…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {query && <button className="btn" data-variant="ghost" data-size="icon-sm" onClick={() => setQuery('')} aria-label="Clear"><Icon name="close" size={14}/></button>}
          </label>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto' }}>
            <span className="tweak-label">Sort</span>
            <Seg
              size="sm"
              value={sort}
              onChange={setSort}
              options={[
                { value: 'weight', label: 'Weight' },
                { value: 'name', label: 'Name' },
                { value: 'rating', label: 'Top' },
              ]}
            />
          </div>
        </div>

        <div className="chip-row" style={{ marginBottom: 'var(--sp-5)' }}>
          <button className="chip-btn" data-active={cat === 'all' || undefined} onClick={() => setCat('all')}>
            All <span className="mono" style={{ color: 'var(--ink-mute)', marginLeft: 4 }}>{items.length}</span>
          </button>
          {categories.map(c => {
            const count = items.filter(i => i.category === c.id).length;
            return (
              <button key={c.id} className="chip-btn" data-active={cat === c.id || undefined} onClick={() => setCat(c.id)}>
                <Icon name={c.icon} size={12} /> {c.name}
                <span className="mono" style={{ color: 'var(--ink-mute)', marginLeft: 2 }}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Results */}
        {filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-glyph"><Icon name="search" size={28}/></div>
            <h3>Nothing matches that</h3>
            <p>Try clearing the filters or searching for a brand.</p>
          </div>
        ) : view === 'list' ? (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {filtered.map(item => <CatalogRow key={item.id} item={item} unit={state.unit} onClick={() => go(`/catalog/${item.id}`)} />)}
          </Card>
        ) : (
          <div className="grid-4">
            {filtered.map(item => <CatalogGridCard key={item.id} item={item} unit={state.unit} onClick={() => go(`/catalog/${item.id}`)} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function CatalogRow({ item, unit, onClick }) {
  const brand = PerdData.brandById(item.brand);
  const cat = PerdData.catById(item.category);
  const fw = PerdUtils.formatWeight(item.weight, unit);
  return (
    <div className="row" onClick={onClick}>
      <div className="row-thumb">
        <Icon name={cat.icon} size={22} stroke={1.4} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="row-name">{item.name}</div>
        <div className="row-meta">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-micro)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>
            {brand.name}
          </span>
          <span style={{ color: 'var(--hairline)' }}>·</span>
          <span className="cat-chip"><i><Icon name={cat.icon} size={10} /></i>{cat.name}</span>
          {item.owned && <Pill tone="support" icon="check">Owned</Pill>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
        <Stars value={item.rating} />
        <div className="row-right mono" style={{ minWidth: 72, textAlign: 'right' }}>
          {fw.value}<span className="unit" style={{ marginLeft: 2 }}>{fw.unit}</span>
        </div>
        <Icon name="chevron" size={16} style={{ color: 'var(--ink-mute)' }} />
      </div>
    </div>
  );
}

function CatalogGridCard({ item, unit, onClick }) {
  const brand = PerdData.brandById(item.brand);
  const cat = PerdData.catById(item.category);
  const fw = PerdUtils.formatWeight(item.weight, unit);
  return (
    <Card interactive onClick={onClick}>
      <div style={{ aspectRatio: '4/3', borderRadius: 'var(--r-md)', background: 'var(--surface-2)', position: 'relative', overflow: 'hidden', marginBottom: 'var(--sp-3)', display: 'grid', placeItems: 'center', border: '1px solid var(--hairline-soft)' }}>
        <TopoBackdrop opacity={0.12} seed={parseInt(item.id.slice(1)) * 0.37} />
        <Icon name={cat.icon} size={48} stroke={1.2} style={{ color: 'var(--ink-2)', opacity: 0.75 }} />
        {item.owned && (
          <span style={{ position: 'absolute', top: 10, right: 10 }}>
            <Pill tone="support" icon="check">Owned</Pill>
          </span>
        )}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-micro)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>
        {brand.name}
      </div>
      <div style={{ fontWeight: 500, fontSize: 'var(--fs-body)', marginTop: 2, lineHeight: 1.2 }}>{item.name}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--sp-3)' }}>
        <Pill tone="outline">{cat.name}</Pill>
        <span className="mono" style={{ fontSize: 'var(--fs-sm)' }}>
          {fw.value}<span style={{ color: 'var(--ink-mute)', marginLeft: 2 }}>{fw.unit}</span>
        </span>
      </div>
    </Card>
  );
}

Object.assign(window, { CatalogView });
