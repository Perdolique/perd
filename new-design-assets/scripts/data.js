// Perd — Mock data
// Weights stored in grams. Convert via formatWeight.

window.PerdData = (function(){
  const categories = [
    { id: 'shelter', name: 'Shelter', slug: 'shelter', icon: 'tent' },
    { id: 'sleep', name: 'Sleep',  slug: 'sleep', icon: 'moon' },
    { id: 'cook', name: 'Cook', slug: 'cook', icon: 'flame' },
    { id: 'pack', name: 'Pack', slug: 'pack', icon: 'backpack' },
    { id: 'clothing', name: 'Clothing', slug: 'clothing', icon: 'shirt' },
    { id: 'nav', name: 'Navigation', slug: 'nav', icon: 'compass' },
    { id: 'water', name: 'Water', slug: 'water', icon: 'drop' },
    { id: 'light', name: 'Light', slug: 'light', icon: 'bulb' },
    { id: 'safety', name: 'Safety', slug: 'safety', icon: 'shield' },
    { id: 'electronics', name: 'Electronics', slug: 'electronics', icon: 'battery' },
    { id: 'food', name: 'Food', slug: 'food', icon: 'apple' },
  ];

  const brands = [
    { id: 'zpacks', name: 'Zpacks' },
    { id: 'nemo', name: 'Nemo' },
    { id: 'thermarest', name: 'Therm-a-Rest' },
    { id: 'msr', name: 'MSR' },
    { id: 'osprey', name: 'Osprey' },
    { id: 'hyperlite', name: 'Hyperlite' },
    { id: 'patagonia', name: 'Patagonia' },
    { id: 'arcteryx', name: 'Arc\u2019teryx' },
    { id: 'petzl', name: 'Petzl' },
    { id: 'garmin', name: 'Garmin' },
    { id: 'sawyer', name: 'Sawyer' },
    { id: 'bd', name: 'Black Diamond' },
  ];

  // kind: base | worn | consumable
  const items = [
    { id: 'i01', name: 'Plex Solo Tent', brand: 'zpacks', category: 'shelter', weight: 397, kind: 'base', rating: 5, owned: true, specs: { material: 'DCF', season: '3-season', capacity: 1 } },
    { id: 'i02', name: 'Dragonfly OSMO 2P', brand: 'nemo', category: 'shelter', weight: 1360, kind: 'base', rating: 5, owned: false, specs: { material: 'OSMO', season: '3-season', capacity: 2 } },
    { id: 'i03', name: 'Hubba Hubba 2', brand: 'msr', category: 'shelter', weight: 1540, kind: 'base', rating: 4, owned: false },
    { id: 'i04', name: 'NeoAir XLite NXT', brand: 'thermarest', category: 'sleep', weight: 370, kind: 'base', rating: 5, owned: true, specs: { rValue: 4.5, length: 'Regular' } },
    { id: 'i05', name: 'Tensor Trail', brand: 'nemo', category: 'sleep', weight: 470, kind: 'base', rating: 4, owned: false },
    { id: 'i06', name: 'Disco 15 Down Bag', brand: 'nemo', category: 'sleep', weight: 1020, kind: 'base', rating: 4, owned: true, specs: { fill: '650 fp down', rating: '15°F' } },
    { id: 'i07', name: 'PocketRocket 2', brand: 'msr', category: 'cook', weight: 73, kind: 'base', rating: 5, owned: true },
    { id: 'i08', name: 'Titan Kettle', brand: 'msr', category: 'cook', weight: 132, kind: 'base', rating: 4, owned: true },
    { id: 'i09', name: 'IsoPro 227g Fuel', brand: 'msr', category: 'cook', weight: 360, kind: 'consumable', rating: 4, owned: true },
    { id: 'i10', name: 'Exos Pro 55', brand: 'osprey', category: 'pack', weight: 978, kind: 'base', rating: 5, owned: true, specs: { capacity: '55L', frame: 'AirSpeed' } },
    { id: 'i11', name: 'Southwest 55', brand: 'hyperlite', category: 'pack', weight: 910, kind: 'base', rating: 5, owned: false },
    { id: 'i12', name: 'Houdini Jacket', brand: 'patagonia', category: 'clothing', weight: 105, kind: 'worn', rating: 5, owned: true },
    { id: 'i13', name: 'Cerium LT Hoody', brand: 'arcteryx', category: 'clothing', weight: 295, kind: 'base', rating: 5, owned: true },
    { id: 'i14', name: 'Capilene Cool Daily', brand: 'patagonia', category: 'clothing', weight: 142, kind: 'worn', rating: 4, owned: true },
    { id: 'i15', name: 'eTrex SE', brand: 'garmin', category: 'nav', weight: 150, kind: 'base', rating: 4, owned: false },
    { id: 'i16', name: 'Mini Compass', brand: 'bd', category: 'nav', weight: 28, kind: 'base', rating: 4, owned: true },
    { id: 'i17', name: 'Squeeze Filter', brand: 'sawyer', category: 'water', weight: 84, kind: 'base', rating: 5, owned: true },
    { id: 'i18', name: 'CNOC Vecto 2L', brand: 'sawyer', category: 'water', weight: 80, kind: 'base', rating: 5, owned: true },
    { id: 'i19', name: 'Spot Core', brand: 'bd', category: 'light', weight: 76, kind: 'base', rating: 4, owned: true },
    { id: 'i20', name: 'Actik Core', brand: 'petzl', category: 'light', weight: 75, kind: 'base', rating: 5, owned: false },
    { id: 'i21', name: 'First Aid Ultralight .7', brand: 'bd', category: 'safety', weight: 220, kind: 'base', rating: 4, owned: true },
    { id: 'i22', name: 'InReach Mini 2', brand: 'garmin', category: 'safety', weight: 100, kind: 'base', rating: 5, owned: true },
    { id: 'i23', name: 'Anker Nano 10k', brand: 'bd', category: 'electronics', weight: 194, kind: 'base', rating: 4, owned: true },
    { id: 'i24', name: 'Trail Mix 500g', brand: 'zpacks', category: 'food', weight: 500, kind: 'consumable', rating: 4, owned: true },
    { id: 'i25', name: 'Freeze-Dried Dinner', brand: 'msr', category: 'food', weight: 180, kind: 'consumable', rating: 4, owned: true },
    { id: 'i26', name: 'Ridge Rest SOLite', brand: 'thermarest', category: 'sleep', weight: 400, kind: 'base', rating: 4, owned: false },
    { id: 'i27', name: 'Gossamer Gear Kumo', brand: 'hyperlite', category: 'pack', weight: 600, kind: 'base', rating: 4, owned: false },
    { id: 'i28', name: 'Nano Puff Hoody', brand: 'patagonia', category: 'clothing', weight: 330, kind: 'base', rating: 4, owned: false },
    { id: 'i29', name: 'Atom LT Jacket', brand: 'arcteryx', category: 'clothing', weight: 375, kind: 'base', rating: 5, owned: false },
    { id: 'i30', name: 'Tikka Core', brand: 'petzl', category: 'light', weight: 82, kind: 'base', rating: 4, owned: false },
  ];

  const packs = [
    {
      id: 'p1', name: 'Presidential Traverse', slug: 'presidentials',
      trip: 'New Hampshire · 3 days', start: 'Aug 14', accent: 'granite',
      items: ['i01','i04','i06','i07','i08','i09','i10','i12','i13','i16','i17','i18','i19','i22','i23','i24','i25'],
    },
    {
      id: 'p2', name: 'Wind River High Route', slug: 'winds',
      trip: 'Wyoming · 7 days', start: 'Sep 02', accent: 'alpine',
      items: ['i02','i05','i06','i07','i08','i09','i11','i13','i14','i17','i18','i20','i21','i22','i23','i24','i25','i28'],
    },
    {
      id: 'p3', name: 'Weekend Overnight', slug: 'weekend',
      trip: 'Local · 2 days', start: 'Any weekend', accent: 'forest',
      items: ['i04','i06','i07','i08','i09','i10','i12','i17','i19','i21','i24'],
    },
  ];

  function byId(id) { return items.find(i => i.id === id); }
  function catById(id) { return categories.find(c => c.id === id); }
  function brandById(id) { return brands.find(b => b.id === id); }

  return { categories, brands, items, packs, byId, catById, brandById };
})();
