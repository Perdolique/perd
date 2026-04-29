// Perd — App root (router + state + tweaks wiring)
const { useEffect: useEffectApp, useState: useStateApp } = React;

const LS_KEY = 'perd.state.v2';
const HASH_KEY = 'perd.hash.v1';

const DEFAULT_STATE = {
  theme: 'light',
  accent: null,
  accentColor: null,
  density: 'balanced',
  unit: 'g',
  owned: {}, // itemId -> boolean override
};

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch { return DEFAULT_STATE; }
}

function loadRoute() {
  const h = location.hash.replace(/^#/, '');
  if (h) return h;
  try { return localStorage.getItem(HASH_KEY) || '/'; } catch { return '/'; }
}

function App() {
  const [state, setState] = useStateApp(loadState);
  const [route, setRoute] = useStateApp(loadRoute);
  const [tweaksOpen, setTweaksOpen] = useStateApp(false);

  // Persist state + theme tokens
  useEffectApp(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
    const root = document.documentElement;
    root.dataset.theme = state.theme;
    root.dataset.density = state.density;
    if (state.accentColor) {
      root.style.setProperty('--accent', state.accentColor);
    } else {
      root.style.removeProperty('--accent');
    }
  }, [state]);

  // Route + persist
  useEffectApp(() => {
    const onHash = () => setRoute(location.hash.replace(/^#/, '') || '/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffectApp(() => {
    try { localStorage.setItem(HASH_KEY, route); } catch {}
    if (location.hash.replace(/^#/, '') !== route) {
      history.replaceState(null, '', '#' + route);
    }
    // scroll to top of main on route change (except to keep scroll on same page)
    const main = document.querySelector('.main');
    if (main) main.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [route]);

  // Edit mode ↔ tweaks (host toolbar integration)
  useEffectApp(() => {
    function onMessage(e) {
      const d = e.data || {};
      if (d.type === '__activate_edit_mode') setTweaksOpen(true);
      if (d.type === '__deactivate_edit_mode') setTweaksOpen(false);
    }
    window.addEventListener('message', onMessage);
    // announce AFTER listener is live
    try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch {}
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const go = (r) => { setRoute(r); location.hash = r; };

  const ownedCount = PerdData.items.filter(i => state.owned[i.id] ?? i.owned).length;
  const stats = { ownedCount, packCount: PerdData.packs.length };

  let view;
  if (route === '/' || route === '/home') view = <DashboardView state={state} go={go} />;
  else if (route === '/catalog') view = <CatalogView state={state} go={go} />;
  else if (route.startsWith('/catalog/')) view = <ItemDetailView state={state} setState={setState} go={go} itemId={route.split('/')[2]} />;
  else if (route === '/inventory') view = <InventoryView state={state} setState={setState} go={go} />;
  else if (route === '/packs') view = <PacksView state={state} go={go} />;
  else if (route.startsWith('/packs/')) view = <PackDetailView state={state} go={go} slug={route.split('/')[2]} />;
  else if (route === '/account') view = <AccountView state={state} />;
  else view = <DashboardView state={state} go={go} />;

  return (
    <div className="app grain">
      <Sidebar route={route} go={go} stats={stats} />
      <div className="main">
        <Topbar route={route} go={go} />
        {view}
      </div>
      <Dock route={route} go={go} />

      <button className="tweaks-toggle" aria-label="Open tweaks" onClick={() => setTweaksOpen(v => !v)}>
        <Icon name="settings" size={20} />
      </button>
      <TweaksPanel state={state} setState={setState} visible={tweaksOpen} onClose={() => setTweaksOpen(false)} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
