// Global compatibility layer for settings.js

// MooTools-style $ function
window.$ = function(id) {
    var element = document.getElementById(id);
    if (element && !element.set) {
        // Add MooTools-style methods
        element.set = function(property, value) {
            if (property === 'html') {
                element.innerHTML = value;
            } else if (property === 'text') {
                element.textContent = value;
            } else if (property === 'class') {
                element.className = value;
            } else {
                element.setAttribute(property, value);
            }
            return element;
        };
        
        element.setStyle = function(property, value) {
            element.style[property] = value;
            return element;
        };
        
        element.inject = function(parent, position) {
            position = position || 'bottom';
            if (position === 'bottom') {
                parent.appendChild(element);
            } else if (position === 'top') {
                parent.insertBefore(element, parent.firstChild);
            }
            return element;
        };
        
        element.addEvent = function(event, handler) {
            element.addEventListener(event, handler);
            return element;
        };
    }
    return element;
};

// MooTools-style Element constructor
window.Element = function(tag, attributes) {
    var element = document.createElement(tag);
    
    if (attributes) {
        for (var attr in attributes) {
            if (attr === 'text') {
                element.textContent = attributes[attr];
            } else if (attr === 'html') {
                element.innerHTML = attributes[attr];
            } else {
                element.setAttribute(attr, attributes[attr]);
            }
        }
    }
    
    // Add MooTools-style methods
    element.set = function(property, value) {
        if (property === 'html') {
            element.innerHTML = value;
        } else if (property === 'text') {
            element.textContent = value;
        } else if (property === 'class') {
            element.className = value;
        } else {
            element.setAttribute(property, value);
        }
        return element;
    };
    
    element.setStyle = function(property, value) {
        element.style[property] = value;
        return element;
    };
    
    element.inject = function(parent, position) {
        position = position || 'bottom';
        if (position === 'bottom') {
            parent.appendChild(element);
        } else if (position === 'top') {
            parent.insertBefore(element, parent.firstChild);
        }
        return element;
    };
    
    element.addEvent = function(event, handler) {
        element.addEventListener(event, handler);
        return element;
    };
    
    element.dispose = function() {
        if (element.parentNode) {
            element.parentNode.removeChild(element);
        }
        return element;
    };
    
    return element;
};

// MooTools-style Class system
window.Class = function(definition) {
    function ClassConstructor() {
        if (this.initialize) {
            return this.initialize.apply(this, arguments);
        }
    }
    
    for (var key in definition) {
        ClassConstructor.prototype[key] = definition[key];
    }
    
    return ClassConstructor;
};

// MooTools-style Array.each
if (!Array.prototype.each) {
    Array.prototype.each = function(fn, bind) {
        for (var i = 0; i < this.length; i++) {
            fn.call(bind || this, this[i], i, this);
        }
        return this;
    };
}

// MooTools-style Object.each
if (!Object.each) {
    Object.each = function(obj, fn, bind) {
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                fn.call(bind || obj, obj[key], key, obj);
            }
        }
        return obj;
    };
}

// MooTools-style typeOf function
window.typeOf = function(obj) {
    if (obj == null) return 'null';
    if (obj === undefined) return 'undefined';
    
    var type = typeof obj;
    if (type === 'object') {
        if (Array.isArray(obj)) return 'array';
        if (obj.constructor === Date) return 'date';
        if (obj.constructor === RegExp) return 'regexp';
        return 'object';
    }
    return type;
};

// StoreClass alias for Store
window.StoreClass = Store;

// Global profiles object - will be initialized by settings.js
window.profiles = null;

// Global preferences functions (compatibility)
window.getPref = function(name) {
    return store.get(name);
};

window.setPref = function(name, value) {
    return store.set(name, value);
};

// Initialize profiles system when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize profiles manager
    window.profiles = new ProfileManager();
    
    // Initialize default profiles if none exist - but only after store is ready
    function initializeDefaultProfiles() {
        if (!window.sabconnectStore || !window.sabconnectStore.isReady) {
            // Store not ready yet, wait
            setTimeout(initializeDefaultProfiles, 50);
            return;
        }
        
        var existingProfiles = store.get('profiles');
        
        if (!existingProfiles || Object.keys(existingProfiles).length === 0) {
            store.set('profiles', {
                'Default': {
                    url: '',
                    api_key: '',
                    username: '',
                    password: ''
                }
            });
            setPref('active_profile', 'Default');
        }
    }
    
    // Start the initialization process
    initializeDefaultProfiles();
});