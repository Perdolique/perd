// Perd — utilities: weight formatting, icons

window.PerdUtils = (function(){
  function formatWeight(grams, unit) {
    if (grams == null || isNaN(grams)) return { value: '—', unit: '' };
    switch (unit) {
      case 'g': return { value: Math.round(grams).toLocaleString('en-US'), unit: 'g' };
      case 'kg': return { value: (grams / 1000).toFixed(grams < 1000 ? 2 : grams < 10000 ? 2 : 1), unit: 'kg' };
      case 'oz': return { value: (grams / 28.3495).toFixed(1), unit: 'oz' };
      case 'lb': {
        const lb = grams / 453.592;
        return { value: lb.toFixed(2), unit: 'lb' };
      }
      default: return formatWeight(grams, 'g');
    }
  }

  function sumWeight(items) { return items.reduce((a,b) => a + (b.weight || 0), 0); }

  function groupBy(arr, key) {
    const map = new Map();
    for (const item of arr) {
      const k = typeof key === 'function' ? key(item) : item[key];
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(item);
    }
    return map;
  }

  // Category icon strokes — minimal line set. 24×24 viewBox.
  const ICONS = {
    tent:     'M3 19L12 4l9 15M8 19l4-7 4 7M12 4v15',
    moon:     'M21 12.8A8.5 8.5 0 0 1 11.2 3a8.5 8.5 0 1 0 9.8 9.8z',
    flame:    'M12 21c4 0 6-2.5 6-5.5 0-3-2-4.5-3-6.5-1.5 2-3 2.5-3 4 0-2-1-3-2-5-1 2-4 3-4 7 0 3.5 2.5 6 6 6z',
    backpack: 'M6 8V6a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v2M5 8h14v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8zM9 12h6M9 12v4h6v-4',
    shirt:    'M4 7l4-3h8l4 3-2 3-2-1v11H6V9L4 10l0-3z',
    compass:  'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15 9l-2 6-4 2 2-6 4-2z',
    drop:     'M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z',
    bulb:     'M9 18h6M10 21h4M12 3a6 6 0 0 1 4 10.5V16H8v-2.5A6 6 0 0 1 12 3z',
    shield:   'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z',
    battery:  'M3 8h15v8H3zM18 11h2v2h-2zM6 11l2 0M10 11l2 0M14 11l2 0',
    apple:    'M12 7c0-3 2-4 3-4M6 11c0-3 2-5 5-5 1.5 0 2 1 2 1s1-1 2.5-1c3 0 4.5 2 4.5 5 0 6-4 10-6 10s-2-1-3-1-1 1-3 1c-1 0-4-4-4-8s1-5 2-2',
    // UI
    search:   'M11 5a6 6 0 1 1-4.24 10.24A6 6 0 0 1 11 5zM21 21l-5.5-5.5',
    plus:     'M12 5v14M5 12h14',
    check:    'M5 13l4 4L19 7',
    arrow:    'M5 12h14M13 5l7 7-7 7',
    arrowL:   'M19 12H5M11 5l-7 7 7 7',
    close:    'M6 6l12 12M18 6l-12 12',
    home:     'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9z',
    grid:     'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    list:     'M4 6h16M4 12h16M4 18h16',
    sparkle:  'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM5 19l.8 1.7L7.5 21l-1.7.3L5 23l-.8-1.7L2.5 21l1.7-.3L5 19z',
    sun:      'M12 4v2M12 18v2M4 12H2M22 12h-2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    moonFull: 'M21 12.8A8.5 8.5 0 0 1 11.2 3a8.5 8.5 0 1 0 9.8 9.8z',
    settings: 'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM19 12l2 1.5-1 3-2.5-.3-1.7 1.7.3 2.5-3 1-1.5-2h-2l-1.5 2-3-1 .3-2.5L4.2 16.2 1.7 16.5l-1-3L3 12l-2.3-1.5 1-3 2.5.3L6 6.1l-.3-2.5 3-1 1.5 2h2l1.5-2 3 1L16.4 5l1.7 1.7 2.5-.3 1 3L19 12z',
    chevron:  'M9 6l6 6-6 6',
    chevronD: 'M6 9l6 6 6-6',
    dots:     'M5 12h.01M12 12h.01M19 12h.01',
    star:     'M12 3l2.8 6 6.2.6-4.7 4.3 1.4 6.1L12 17l-5.7 3 1.4-6.1L3 9.6 9.2 9z',
    map:      'M9 3l6 2 6-2v16l-6 2-6-2-6 2V5l6-2zM9 3v16M15 5v16',
    pin:      'M12 3a7 7 0 0 1 7 7c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 7-7zM12 10a0 0 0 1 0 0 0 0 0 0 1 0 0 0z',
    calendar: 'M5 6h14v14H5zM5 10h14M9 3v4M15 3v4',
    filter:   'M4 5h16l-6 8v6l-4-2v-4L4 5z',
    tag:      'M20 12l-8 8-8-8V4h8l8 8zM9 9a0 0 0 1 0 0 0 0 0 0 1 0 0 0z',
    bolt:     'M13 3L4 14h7l-1 7 9-11h-7l1-7z',
    heart:    'M12 20s-8-5-8-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-8 11-8 11-1 0-2 0-2 0z',
    user:     'M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4 21a8 8 0 0 1 16 0',
    bell:     'M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2zM10 21a2 2 0 0 0 4 0',
    share:    'M7 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM23 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM23 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM7 11l10-5M7 13l10 5',
    trash:    'M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13',
    download: 'M12 4v12M6 10l6 6 6-6M4 20h16',
    route:    'M6 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM18 15a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM6 9v6a3 3 0 0 0 3 3h6',
    weight:   'M5 8h14l-2 13H7L5 8zM9 8V6a3 3 0 0 1 6 0v2',
    minus:    'M5 12h14',
    clock:    'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 7v5l3 2',
  };

  function iconPath(name) { return ICONS[name] || ICONS.sparkle; }

  function stars(rating) {
    const n = Math.max(0, Math.min(5, Math.round(rating || 0)));
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }

  return { formatWeight, sumWeight, groupBy, ICONS, iconPath, stars };
})();
