// Minimal MooTools compatibility layer
var Class = function(properties) {
    var klass = function(){
        return this.initialize ? this.initialize.apply(this, arguments) : this;
    };
    
    for (var key in properties) {
        klass.prototype[key] = properties[key];
    }
    
    return klass;
};

var Element = function(tag, properties) {
    var element = document.createElement(tag);
    if (properties) {
        for (var key in properties) {
            if (key === 'text') {
                element.textContent = properties[key];
            } else {
                element.setAttribute(key, properties[key]);
            }
        }
    }
    
    element.inject = function(parent) {
        parent.appendChild(this);
        return this;
    };
    
    element.set = function(property, value) {
        if (property === 'text') {
            this.textContent = value;
        } else if (property === 'html') {
            this.innerHTML = value;
        } else if (property === 'class') {
            this.className = value;
        } else {
            this.setAttribute(property, value);
        }
        return this;
    };
    
    element.dispose = function() {
        if (this.parentNode) {
            this.parentNode.removeChild(this);
        }
        return this;
    };
    
    return element;
};

// Extend Element to get by ID
var $ = function(id) {
    return document.getElementById(id);
};

// Add typeOf function
var typeOf = function(obj) {
    if (obj === null) return 'null';
    if (obj === undefined) return 'undefined';
    return typeof obj;
};