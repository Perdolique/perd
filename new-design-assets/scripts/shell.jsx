// Perd — App shell (Sidebar, Topbar, Dock)
const { useState: useStateShell } = React;

const NAV = [
  { id: 'home',      label: 'Dashboard', icon: 'home',     route: '/' },
  { id: 'catalog',   label: 'Catalog',   icon: 'grid',     route: '/catalog' },
  { id: 'inventory', label: 'Gear',      icon: 'backpack', route: '/inventory' },
  { id: 'packs',     label: 'Packs',     icon: 'route',    route: '/packs' },
  { id: 'account',   label: 'Account',   icon: 'user',     route: '/account' },
];

function Sidebar({ route, go, stats }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">perd<em>.</em></span>
      </div>
      <div className="brand-mono" style={{ padding: '0 var(--sp-3)', marginTop: '-8px' }}>
        Field companion · v0.4
      </div>

      <nav className="nav-group" style={{ marginTop: 'var(--sp-5)' }}>
        <div className="nav-group-title">Workspace</div>
        {NAV.slice(0, 4).map(n => (
          <a key={n.id}
            href={`#${n.route}`}
            className="nav-item"
            data-active={route.startsWith(n.route) && (n.route !== '/' || route === '/') || undefined}
            onClick={(e) => { e.preventDefault(); go(n.route); }}
          >
            <Icon name={n.icon} size={16} />
            <span>{n.label}</span>
            {n.id === 'inventory' && <span className="badge">{stats.ownedCount}</span>}
            {n.id === 'packs' && <span className="badge">{stats.packCount}</span>}
          </a>
        ))}
      </nav>

      <nav className="nav-group">
        <div className="nav-group-title">You</div>
        <a href="#/account" className="nav-item"
           data-active={route.startsWith('/account') || undefined}
           onClick={(e) => { e.preventDefault(); go('/account'); }}>
          <Icon name="user" size={16} />
          <span>Account</span>
        </a>
      </nav>

      <div className="sidebar-foot">
        <div className="sidebar-user">
          <Avatar name="Ivan" size={36} />
          <div>
            <strong>Ivan Khr.</strong>
            <small>Free plan</small>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Topbar({ route, go, title }) {
  const current = NAV.find(n => route.startsWith(n.route) && (n.route !== '/' || route === '/')) || NAV[0];
  return (
    <div className="topbar">
      <span className="topbar-title">perd<em>.</em></span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-micro)',
        letterSpacing: '0.18em', textTransform: 'uppercase',
        color: 'var(--ink-mute)', marginLeft: 'var(--sp-3)'
      }}>
        / {title || current.label}
      </span>
      <div className="topbar-spacer" />
      <IconButton icon="search" label="Search" size="icon-sm" onClick={() => go('/catalog')} />
      <IconButton icon="bell" label="Alerts" size="icon-sm" />
    </div>
  );
}

function Dock({ route, go }) {
  return (
    <nav className="dock" aria-label="Primary">
      {NAV.map(n => (
        <button key={n.id}
          className="dock-item"
          data-active={route.startsWith(n.route) && (n.route !== '/' || route === '/') || undefined}
          onClick={() => go(n.route)}
        >
          <span className="dock-icon"><Icon name={n.icon} size={16} /></span>
          <span>{n.label}</span>
        </button>
      ))}
    </nav>
  );
}

Object.assign(window, { Sidebar, Topbar, Dock, NAV });
