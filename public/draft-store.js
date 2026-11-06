/* Durable, on-device bulletin drafts. No network, no account, no publishing. */
(function attachDraftStore(root) {
  const DB = 'galata-bulten-drafts';
  const STORE = 'issues';
  let dbPromise = null;

  function openDb() {
    if (!root.indexedDB) return Promise.reject(new Error('IndexedDB desteklenmiyor'));
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const request = root.indexedDB.open(DB, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, {keyPath:'id'});
        };
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => db.close();
          resolve(db);
        };
        request.onerror = () => reject(request.error || new Error('Taslak veritabanı açılamadı'));
        request.onblocked = () => reject(new Error('Başka bir sekme veritabanını kilitledi'));
      }).catch(error => { dbPromise = null; throw error; });
    }
    return dbPromise;
  }

  async function transaction(mode, apply) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      let request;
      let value;
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      tx.onerror = () => reject(tx.error || new Error('Taslak depolama hatası'));
      tx.onabort = () => reject(tx.error || new Error('Taslak işlemi iptal edildi'));
      tx.oncomplete = () => resolve(value);
      try {
        request = apply(store);
        if (request) {
          request.onsuccess = () => { value = request.result; };
          request.onerror = () => reject(request.error || new Error('Taslak işlem hatası'));
        }
      } catch (err) {
        tx.abort();
        reject(err);
      }
    });
  }

  const api = {
    async get(id) {
      const rec = await transaction('readonly', store => store.get(String(id)));
      return rec?.issue || null;
    },
    async list() {
      const all = await transaction('readonly', store => store.getAll());
      return (all || []).map(record => record.issue).filter(Boolean);
    },
    async put(issue) {
      if (!issue || typeof issue.id !== 'string' || !/^\d{4}-\d{2}-[a-z0-9-]+$/.test(issue.id)) {
        throw new Error('Geçerli bir bülten kimliği gerekli');
      }
      const copy = JSON.parse(JSON.stringify(issue));
      await transaction('readwrite', store =>
        store.put({id:copy.id,issue:copy,updatedAt:new Date().toISOString()}));
      return true;
    },
    async remove(id) {
      await transaction('readwrite', store => store.delete(String(id)));
      return true;
    }
  };
  root.GalataDraftStore = Object.freeze(api);
})(globalThis);
