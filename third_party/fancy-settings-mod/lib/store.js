// Store implementation compatible with fancy-settings
// Uses chrome.storage.sync for Manifest V3 compatibility

function Store(name, defaults, storage, callback) {
    this.name = name;
    this.defaults = defaults || {};
    this.storage = storage;
    this.data = {};
    this.isReady = false;
    this.readyCallbacks = [];
    
    if (callback) {
        this.readyCallbacks.push(callback);
    }
    
    this.init();
}

Store.prototype.init = function() {
    var self = this;
    chrome.storage.local.get(null, function(result) {
        self.data = Object.assign({}, self.defaults, result);
        if (result.profiles) {
        }
        self.isReady = true;
        self.readyCallbacks.forEach(function(callback) {
            callback();
        });
        self.readyCallbacks = [];
    });
};

Store.prototype.get = function(key) {
    var value = this.data[key];
    if (key === 'profiles') {
    }
    return value;
};

Store.prototype.set = function(key, value) {
    if (key === 'profiles') {
    }
    this.data[key] = value;
    var obj = {};
    obj[key] = value;
    chrome.storage.local.set(obj, function() {
        if (chrome.runtime.lastError) {
            console.error('Error saving to storage:', chrome.runtime.lastError);
        } else {
            if (key === 'profiles') {
            }
        }
    });
};

Store.prototype.fromObject = function(obj) {
    this.data = Object.assign({}, obj);
    chrome.storage.local.set(obj);
};

Store.prototype.toObject = function(callback) {
    if (callback) {
        callback(this.data);
    }
    return this.data;
};

Store.prototype.clear = function() {
    this.data = {};
    chrome.storage.sync.clear();
};

// Sync version that uses chrome.storage.sync
function StoreSync(name, defaults, storage, callback) {
    return new Store(name, defaults, storage, callback);
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Store: Store, StoreSync: StoreSync };
} else {
    window.Store = Store;
    window.StoreSync = StoreSync;
}