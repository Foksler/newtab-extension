const Storage = {
  async load() {
    const data = await chrome.storage.local.get('settings');
    return data.settings || null;
  },

  async save(settings) {
    await chrome.storage.local.set({ settings });
  },
};
