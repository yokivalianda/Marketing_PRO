// ═══════════════════════════════════════════════
// MODE OFFLINE — PropMap v4.2
// IndexedDB untuk cache data + queue operasi pending
// ═══════════════════════════════════════════════

const IDB_NAME    = 'propmap-offline';
const IDB_VER     = 1;
const STORE_KONS  = 'konsumen';
const STORE_QUEUE = 'sync_queue';

let idb      = null;
let isOnline = navigator.onLine;

// ── INIT ─────────────────────────────────────────
function initOffline() {
  openIDB().then(() => {
    updateOnlineStatus();
    window.addEventListener('online',  () => { isOnline = true;  updateOnlineStatus(); triggerSync(); });
    window.addEventListener('offline', () => { isOnline = false; updateOnlineStatus(); });

    // Terima pesan dari SW untuk sync
    navigator.serviceWorker?.addEventListener('message', e => {
      if (e.data?.type === 'DO_SYNC') syncQueue();
    });
  });
}

// ── INDEXEDDB ─────────────────────────────────────
function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VER);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_KONS)) {
        db.createObjectStore(STORE_KONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const qs = db.createObjectStore(STORE_QUEUE, { keyPath: 'qid', autoIncrement: true });
        qs.createIndex('status', 'status');
      }
    };
    req.onsuccess = e => { idb = e.target.result; resolve(idb); };
    req.onerror   = () => { console.warn('IDB open failed'); resolve(null); };
  });
}

function idbTx(store, mode) {
  if (!idb) return null;
  try { return idb.transaction(store, mode).objectStore(store); } catch { return null; }
}

// ── SIMPAN CACHE KONSUMEN ─────────────────────────
async function cacheKonsumen(data) {
  const tx = idbTx(STORE_KONS, 'readwrite');
  if (!tx) return;
  return new Promise(resolve => {
    let done = 0;
    if (!data.length) { resolve(); return; }
    data.forEach(k => {
      const r = tx.put(k);
      r.onsuccess = () => { if (++done === data.length) resolve(); };
      r.onerror   = () => { if (++done === data.length) resolve(); };
    });
  });
}

// ── BACA CACHE KONSUMEN ───────────────────────────
async function getCachedKonsumen() {
  const tx = idbTx(STORE_KONS, 'readonly');
  if (!tx) return [];
  return new Promise(resolve => {
    const req = tx.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => resolve([]);
  });
}

// ── QUEUE OPERASI PENDING ─────────────────────────
async function enqueueOp(type, payload) {
  const tx = idbTx(STORE_QUEUE, 'readwrite');
  if (!tx) return;
  return new Promise(resolve => {
    const req = tx.add({
      type,
      payload,
      status:     'pending',
      created_at: new Date().toISOString(),
    });
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => resolve(null);
  });
}

async function getPendingQueue() {
  const tx = idbTx(STORE_QUEUE, 'readonly');
  if (!tx) return [];
  return new Promise(resolve => {
    const req = tx.getAll();
    req.onsuccess = () => resolve((req.result || []).filter(r => r.status === 'pending'));
    req.onerror   = () => resolve([]);
  });
}

async function markQueueDone(qid) {
  const tx = idbTx(STORE_QUEUE, 'readwrite');
  if (!tx) return;
  return new Promise(resolve => {
    const get = tx.get(qid);
    get.onsuccess = () => {
      const item = get.result;
      if (item) { item.status = 'done'; tx.put(item); }
      resolve();
    };
    get.onerror = () => resolve();
  });
}

async function clearDoneQueue() {
  const tx = idbTx(STORE_QUEUE, 'readwrite');
  if (!tx) return;
  const all = await new Promise(resolve => {
    const r = tx.getAll();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror   = () => resolve([]);
  });
  all.filter(r => r.status === 'done').forEach(r => {
    idbTx(STORE_QUEUE, 'readwrite')?.delete(r.qid);
  });
}

// ── SYNC QUEUE KE SUPABASE ────────────────────────
async function syncQueue() {
  if (!isOnline || !sb || !me) return;
  const queue = await getPendingQueue();
  if (!queue.length) return;

  let synced = 0;
  for (const item of queue) {
    try {
      const { type, payload } = item;
      let error = null;

      if (type === 'INSERT') {
        ({ error } = await sb.from('konsumen').insert(payload));
      } else if (type === 'UPDATE') {
        const { id, ...data } = payload;
        ({ error } = await sb.from('konsumen').update(data).eq('id', id));
      } else if (type === 'DELETE') {
        ({ error } = await sb.from('konsumen').delete().eq('id', payload.id));
      } else if (type === 'BERKAS_UPDATE') {
        ({ error } = await sb.from('konsumen').update({ berkas: payload.berkas, log: payload.log }).eq('id', payload.id));
      } else if (type === 'LOG_UPDATE') {
        ({ error } = await sb.from('konsumen').update({ log: payload.log }).eq('id', payload.id));
      }

      if (!error) {
        await markQueueDone(item.qid);
        synced++;
      } else {
        console.warn('sync item failed:', type, error.message);
      }
    } catch(e) {
      console.warn('sync exception:', e.message);
    }
  }

  if (synced > 0) {
    await clearDoneQueue();
    showToast(`${synced} perubahan berhasil disinkronisasi`, '✅');
    // Reload data dari server
    await loadKons();
    renderDash(); renderKons();
    updateQueueBadge();
  }
}

function triggerSync() {
  // Coba Background Sync API, fallback ke manual
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'SYNC_NOW' });
  }
  syncQueue();
}

// ── INTERCEPT OPERASI SAAT OFFLINE ───────────────
// Wrapper untuk saveKons offline-aware
async function saveKonsOffline(obj, eid) {
  if (isOnline) return false; // Gunakan flow normal

  const k = eid ? allKons.find(k => k.id === eid) : null;
  const id = eid || crypto.randomUUID();

  if (eid) {
    // UPDATE
    const updated = { ...k, ...obj, _offline: true, _pending: true };
    const i = allKons.findIndex(x => x.id === eid);
    if (i >= 0) allKons[i] = updated;
    await cacheKonsumen([updated]);
    await enqueueOp('UPDATE', { ...obj, id: eid });
  } else {
    // INSERT
    const newK = {
      ...obj, id,
      owner_id:   me.id,
      owner_name: myProf?.full_name || me.email,
      berkas:     [],
      log:        [{ action: 'Konsumen ditambahkan (offline)', time: new Date().toISOString(), note: obj.catatan }],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _offline:   true,
      _pending:   true,
    };
    allKons.unshift(newK);
    await cacheKonsumen([newK]);
    await enqueueOp('INSERT', newK);
  }

  renderKons(); renderDash();
  updateQueueBadge();
  showToast(eid ? 'Diperbarui (tersimpan lokal, akan sync saat online)' : 'Ditambahkan (akan sync saat online)', '📥');
  return true; // sudah dihandle offline
}

// ── UPDATE BADGE ANTRIAN ──────────────────────────
async function updateQueueBadge() {
  const queue  = await getPendingQueue();
  const badge  = document.getElementById('offlineQueueBadge');
  const banner = document.getElementById('offlineBanner');
  if (!badge) return;
  if (queue.length > 0) {
    badge.textContent = queue.length;
    badge.style.display = 'flex';
    if (banner) {
      banner.textContent = `${queue.length} perubahan menunggu sinkronisasi`;
      banner.style.display = 'flex';
    }
  } else {
    badge.style.display = 'none';
    if (banner) banner.style.display = 'none';
  }
}

// ── STATUS ONLINE/OFFLINE ─────────────────────────
function updateOnlineStatus() {
  const bar    = document.getElementById('offlineBar');
  const notifP = document.getElementById('notifPip');

  if (isOnline) {
    if (bar) bar.style.display = 'none';
    document.documentElement.classList.remove('is-offline');
    // Sync saat kembali online
    syncQueue();
  } else {
    if (bar) {
      bar.style.display = 'flex';
      document.getElementById('offlineBanner').textContent = 'Tidak ada koneksi — perubahan disimpan lokal';
    }
    document.documentElement.classList.add('is-offline');
  }
  updateQueueBadge();
}

// ── LOAD DARI CACHE SAAT OFFLINE ──────────────────
async function loadKonsWithFallback() {
  if (isOnline) {
    // Online: load normal dari Supabase
    await loadKons();
    // Simpan ke cache setelah load
    if (allKons.length > 0) await cacheKonsumen(allKons);
  } else {
    // Offline: load dari IndexedDB
    const cached = await getCachedKonsumen();
    if (cached.length > 0) {
      allKons = cached;
      showToast('Mode offline — menampilkan data terakhir', '📵');
    } else {
      allKons = [];
    }
  }
  updateNotifPip();
}
