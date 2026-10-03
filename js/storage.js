// Élémento Defense : données du joueur (profil, progression, records, stats, sauvegarde) dans IndexedDB.
// Le jeu lit en synchrone dans un cache mémoire, chargé depuis IndexedDB avant les autres scripts (store.boot) ;
// chaque écriture part en arrière-plan. Chaque entrée garde sa date de modification et un drapeau « à synchroniser » :
// un compte en ligne (Supabase, connexion Google…) pourra s'y brancher par Sync.use(adaptateur), sans toucher au jeu.
// Sans IndexedDB (navigateur ancien ou bloqué), on retombe sur localStorage, comme avant.
'use strict';

const STORE_DB = 'elemento', STORE_VER = 1;
// Domaine de chaque clé : la table distante qu'elle rejoindra. Les clés absentes restent sur l'appareil ('local').
const STORE_DOMAINS = {
  'elemento.pseudo': 'profile', 'elemento.lang': 'profile', 'elemento.opts': 'profile',
  'elemento.meta': 'progress', 'elemento.best2': 'progress', 'elemento.best': 'progress',
  'elemento.yglouEgg': 'progress', 'elemento.intro': 'progress', 'elemento.trophies': 'progress', 'elemento.daily': 'progress', 'elemento.tuto': 'progress', 'elemento.guideDone': 'progress', 'elemento.seen': 'progress',
  'elemento.stats': 'stats',
  'elemento.save': 'save',
};
const idbReq = r => new Promise((ok, ko) => { r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });

const store = {
  mem: new Map(),      // clé → texte JSON (une copie neuve à chaque lecture, comme avec localStorage)
  db: null, mode: 'memory', queue: new Map(), flushing: null, timer: 0, deviceId: null,
  domain(k) { return STORE_DOMAINS[k] || 'local'; },

  get(k) { const v = this.mem.get(k); if (v == null) return null; try { return JSON.parse(v); } catch (e) { return null; } },
  set(k, v) { const txt = JSON.stringify(v); if (txt === undefined) return this.del(k); this.mem.set(k, txt); this.write({ k, v: txt, at: Date.now(), dirty: this.domain(k) === 'local' ? 0 : 1 }); },
  // Suppression gardée comme « pierre tombale » pour que la synchronisation la transmette aussi
  del(k) { if (!this.mem.has(k) && this.mode === 'idb') return; this.mem.delete(k); this.write({ k, v: null, del: 1, at: Date.now(), dirty: this.domain(k) === 'local' ? 0 : 1 }); },

  write(rec) {
    if (this.mode === 'local') { try { rec.del ? localStorage.removeItem(rec.k) : localStorage.setItem(rec.k, rec.v); } catch (e) {} return; }
    if (this.mode !== 'idb') return;
    this.queue.set(rec.k, rec);
    if (!this.timer) this.timer = setTimeout(() => this.flush(), 0);
  },
  // Écrit les changements en attente (une transaction) ; à attendre avant un rechargement de la page
  flush() {
    clearTimeout(this.timer); this.timer = 0;
    if (this.mode !== 'idb' || !this.queue.size) return this.flushing || Promise.resolve();
    const recs = [...this.queue.values()]; this.queue.clear();
    const prev = this.flushing || Promise.resolve();
    this.flushing = prev.then(() => new Promise(ok => {
      const tx = this.db.transaction('kv', 'readwrite'), os = tx.objectStore('kv');
      for (const r of recs) os.put(r);
      tx.oncomplete = tx.onerror = tx.onabort = () => ok();
    })).finally(() => { if (!this.queue.size) this.flushing = null; });
    return this.flushing;
  },

  // Toutes les entrées, telles qu'enregistrées (pour la synchronisation, une sauvegarde ou un export)
  async records() {
    await this.flush();
    if (this.mode !== 'idb') return [...this.mem].map(([k, v]) => ({ k, v, at: 0, dirty: 0 }));
    return idbReq(this.db.transaction('kv').objectStore('kv').getAll());
  },
  async sys(k, v) {
    if (this.mode !== 'idb') return null;
    const os = this.db.transaction('sys', v === undefined ? 'readonly' : 'readwrite').objectStore('sys');
    if (v === undefined) { const r = await idbReq(os.get(k)); return r ? r.v : null; }
    await idbReq(os.put({ k, v })); return v;
  },
  // Export lisible de la progression (hors préférences de l'appareil), et import du même format
  async exportAll() {
    const out = {};
    for (const r of await this.records()) if (!r.del && this.domain(r.k) !== 'local') out[r.k] = JSON.parse(r.v);
    return { app: 'elemento', v: STORE_VER, at: Date.now(), device: this.deviceId, data: out };
  },
  importAll(dump) { for (const [k, v] of Object.entries((dump && dump.data) || {})) this.set(k, v); return this.flush(); },

  async open() {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB indisponible');
    const req = indexedDB.open(STORE_DB, STORE_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      // kv : { k, v (texte JSON), at (date de modification), dirty (1 = à envoyer au compte en ligne), del (1 = supprimée) }
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'k' }).createIndex('dirty', 'dirty');
      // sys : identifiant de l'appareil, migration faite, dernière synchronisation…
      if (!db.objectStoreNames.contains('sys')) db.createObjectStore('sys', { keyPath: 'k' });
    };
    // Une autre page du jeu bloque la mise à niveau : on n'attend pas indéfiniment
    return Promise.race([idbReq(req), new Promise((ok, ko) => setTimeout(() => ko(new Error('IndexedDB bloquée')), 3000))]);
  },
  async init() {
    // Outil d'équilibrage (tools/balance.html) : données en mémoire seulement, la vraie progression n'est jamais touchée
    if (window.parent !== window && window.parent.BALANCE) { this.mode = 'memory'; return; }
    try {
      this.db = await this.open(); this.mode = 'idb';
      this.db.onversionchange = () => this.db.close();
      for (const r of await idbReq(this.db.transaction('kv').objectStore('kv').getAll())) if (!r.del && r.v != null) this.mem.set(r.k, r.v);
      // Première ouverture : on reprend les données des versions précédentes (localStorage), qu'on garde aussi en secours
      if (!(await this.sys('migrated'))) {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('elemento.') && !this.mem.has(k)) { const v = localStorage.getItem(k); this.mem.set(k, v); this.write({ k, v, at: Date.now(), dirty: this.domain(k) === 'local' ? 0 : 1 }); }
        }
        await this.flush(); await this.sys('migrated', Date.now());
      }
      this.deviceId = (await this.sys('device')) || (await this.sys('device', (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2))));
    } catch (e) {
      // Repli : localStorage, lu une fois dans le cache mémoire
      this.db = null; this.mode = 'local';
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('elemento.')) this.mem.set(k, localStorage.getItem(k)); } } catch (e2) { this.mode = 'memory'; }
    }
    // Rien ne se perd quand on quitte l'appli ou change d'onglet
    addEventListener('pagehide', () => this.flush());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.flush(); });
  },
  // Charge les données, puis les scripts du jeu dans l'ordre (ils partagent la même portée globale)
  boot(scripts) {
    return this.init().catch(() => {}).then(() => {
      for (const src of scripts) { const s = document.createElement('script'); s.src = src; s.async = false; document.body.appendChild(s); }
    });
  },
};

// ---------- Synchronisation avec un compte en ligne (à brancher plus tard) ----------
// Un adaptateur fournit : user() → { id } ou null ; pull(since) → [{ k, v, at, del }] modifiées depuis « since »
// (v : la valeur elle-même, pas du texte JSON — comme celles reçues par push) ;
// push([{ k, v, at, del, domain }]) → enregistre. Règle de fusion : la modification la plus récente gagne.
// Exemple Supabase : une table « player_data » (user_id, k, v jsonb, domain, at, del), protégée par RLS sur auth.uid().
const Sync = {
  adapter: null, busy: null,
  use(adapter) { this.adapter = adapter; return this.run(); },
  async pending() { return (await store.records()).filter(r => r.dirty); },
  run() {
    if (!this.adapter || store.mode !== 'idb') return Promise.resolve(false);
    return this.busy || (this.busy = this.sync().finally(() => { this.busy = null; }));
  },
  async sync() {
    const A = this.adapter, u = A.user && await A.user(); if (!u) return false;
    const since = (await store.sys('lastPull')) || 0, started = Date.now();
    const local = new Map((await store.records()).map(r => [r.k, r]));
    // 1. Ce qui a changé ailleurs (autre téléphone, navigateur…)
    for (const r of await A.pull(since)) {
      const mine = local.get(r.k);
      if (store.domain(r.k) === 'local' || (mine && mine.at >= r.at)) continue;
      const rec = { k: r.k, v: r.del ? null : JSON.stringify(r.v), at: r.at, dirty: 0, del: r.del ? 1 : 0 };
      if (rec.del) store.mem.delete(rec.k); else store.mem.set(rec.k, rec.v);
      store.queue.set(rec.k, rec); local.set(rec.k, rec);
    }
    await store.flush();
    // 2. Ce qui a changé ici
    const out = [...local.values()].filter(r => r.dirty);
    if (out.length) {
      await A.push(out.map(r => ({ k: r.k, v: r.del ? null : JSON.parse(r.v), at: r.at, del: r.del ? 1 : 0, domain: store.domain(r.k) })));
      // Marqués propres, sauf ceux modifiés pendant l'envoi
      await new Promise(ok => {
        const tx = store.db.transaction('kv', 'readwrite'), os = tx.objectStore('kv');
        for (const r of out) os.get(r.k).onsuccess = ev => { const cur = ev.target.result; if (cur && cur.at === r.at) { cur.dirty = 0; os.put(cur); } };
        tx.oncomplete = tx.onerror = tx.onabort = () => ok();
      });
    }
    await store.sys('lastPull', started);
    return true;
  },
};
