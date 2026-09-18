/**
 * Debug Utility for Roam Extension Testing
 * 
 * Add this to popup.html in dev mode:
 * <script src="../lib/debug.ts"></script>
 * 
 * Then in popup DevTools console, access: window.DEBUG.*
 */

export const DEBUG = {
  /**
   * Get current queue state
   */
  async getQueueState() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['url_queue'], (result) => {
        const q = result.url_queue;
        if (!q) {
          console.log('❌ Queue not initialized');
          resolve(null);
          return;
        }
        console.log(`📊 Queue State:`);
        console.log(`   Hot: ${q.hot.length}/3`);
        console.log(`   Warming: ${q.warming.length}/5`);
        console.table(q.hot.map((u: any) => ({
          id: u.id.slice(0, 8),
          url: u.url.slice(0, 40) + '...',
          status: u.status,
          retry: u.retry_count,
        })));
        console.log('Warming URLs:');
        console.table(q.warming.map((u: any) => ({
          id: u.id.slice(0, 8),
          url: u.url.slice(0, 40) + '...',
          status: u.status,
          retry: u.retry_count,
        })));
        resolve(q);
      });
    });
  },

  /**
   * Get authentication state
   */
  async getAuthState() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_STATE' }, (res: any) => {
        if (res.ok && res.data.signedIn) {
          console.log(`✅ Signed in as: ${res.data.email}`);
          console.log(`   User ID: ${res.data.userId}`);
        } else {
          console.log('❌ Not signed in');
        }
        resolve(res.data);
      });
    });
  },

  /**
   * Get saved URLs
   */
  async getSavedUrls() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['saved_urls'], (result) => {
        const saved = result.saved_urls || [];
        console.log(`📌 Saved URLs (${saved.length}):`);
        saved.forEach((url: string, i: number) => {
          console.log(`   ${i + 1}. ${url}`);
        });
        resolve(saved);
      });
    });
  },

  /**
   * Get paywall preference
   */
  async getPaywallPref() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['skip_paywalled'], (result) => {
        const skip = result.skip_paywalled ?? false;
        console.log(`🔒 Skip paywalled: ${skip ? '✅ ON' : '❌ OFF'}`);
        resolve(skip);
      });
    });
  },

  /**
   * Send a message to background and log
   */
  async send(req: any) {
    console.log(`📤 Sending:`, req);
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(req, (res: any) => {
        if (res.ok) {
          console.log(`✅ Response:`, res.data);
        } else {
          console.error(`❌ Error:`, res.error);
        }
        resolve(res);
      });
    });
  },

  /**
   * Clear all storage (for testing)
   */
  async clearStorage() {
    chrome.storage.local.clear(() => {
      console.log('🗑️  Storage cleared');
    });
  },

  /**
   * Get all storage
   */
  async getAllStorage() {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (result) => {
        console.log('📦 All Storage:');
        Object.entries(result).forEach(([key, value]: [string, any]) => {
          if (typeof value === 'object') {
            console.log(`   ${key}:`, value);
          } else {
            console.log(`   ${key}: ${value}`);
          }
        });
        resolve(result);
      });
    });
  },

  /**
   * Test a single roam call
   */
  async testRoam() {
    console.log('🎯 Testing Roam...');
    const res = await this.send({ type: 'ROAM' });
    if (res.ok) {
      console.log(`✅ Got URL: ${res.data.url}`);
    }
    return res;
  },

  /**
   * Test get collections
   */
  async testGetCollections() {
    console.log('📚 Testing Get Collections...');
    const res = await this.send({ type: 'GET_COLLECTIONS' });
    if (res.ok) {
      console.log(`✅ Collections (${res.data.length}):`);
      res.data.forEach((c: any) => {
        console.log(`   - ${c.name} (${c.item_count} items)`);
      });
    }
    return res;
  },

  /**
   * Test create collection
   */
  async testCreateCollection(name: string) {
    console.log(`📝 Testing Create Collection: "${name}"...`);
    const res = await this.send({ type: 'CREATE_COLLECTION', name });
    if (res.ok) {
      console.log(`✅ Created: ${res.data.name} (ID: ${res.data.id.slice(0, 8)}...)`);
    }
    return res;
  },

  /**
   * Test check URL
   */
  async testCheckUrl(url: string) {
    console.log(`🔍 Testing Check URL: ${url}...`);
    const res = await this.send({ type: 'CHECK_URL', url });
    if (res.ok) {
      console.log(`✅ Known: ${res.data.known}, Category: ${res.data.category_id}`);
    }
    return res;
  },

  /**
   * Test save later
   */
  async testSaveLater(url: string) {
    console.log(`💾 Testing Save Later: ${url}...`);
    const res = await this.send({ type: 'SAVE_LATER', url });
    if (res.ok) {
      console.log(`✅ Saved`);
    }
    return res;
  },

  /**
   * Print help
   */
  help() {
    console.log(`
🔧 Roam Extension Debug Tools

Queue & Storage:
  DEBUG.getQueueState()      - Show queue status (hot/warming)
  DEBUG.getSavedUrls()       - Show saved URLs
  DEBUG.getPaywallPref()     - Show paywall preference
  DEBUG.getAllStorage()      - Show all chrome.storage.local
  DEBUG.clearStorage()       - Clear all storage

Auth:
  DEBUG.getAuthState()       - Show sign-in status

Messages:
  DEBUG.send(req)            - Send message to background

Tests:
  DEBUG.testRoam()           - Test Roam button
  DEBUG.testGetCollections() - Test get collections
  DEBUG.testCreateCollection(name) - Test create collection
  DEBUG.testCheckUrl(url)    - Test check URL
  DEBUG.testSaveLater(url)   - Test save for later

Usage:
  await DEBUG.getQueueState()
  await DEBUG.testRoam()
    `);
  },
};

// Expose to window in dev mode
if (process.env.NODE_ENV === 'development') {
  (window as any).DEBUG = DEBUG;
}

// Also log help on load
console.log('🚀 Debug tools loaded! Type: DEBUG.help()');
