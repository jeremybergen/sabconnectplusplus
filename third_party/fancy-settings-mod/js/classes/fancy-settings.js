// FancySettings implementation for SABconnect++
var FancySettings = {
    tabs: {},
    manifest: {},
    
    initWithManifest: function(callback) {
        console.log('FancySettings.initWithManifest called', callback);
        var self = this;
        
        // Set basic elements
        document.getElementById('title').textContent = manifest.name || 'SABconnect++ Settings';
        document.getElementById('settings-label').textContent = 'Settings';
        document.getElementById('search-label').textContent = 'Search Results';
        document.getElementById('search').placeholder = 'Search settings...';
        
        // Set icon
        var iconElement = document.getElementById('icon');
        if (iconElement && manifest.icon) {
            iconElement.src = chrome.runtime.getURL(manifest.icon);
        }
        
        var faviconElement = document.getElementById('favicon');
        if (faviconElement) {
            faviconElement.href = chrome.runtime.getURL('images/content_icon.png');
        }
        
        // Parse manifest and create settings
        this.parseManifest();
        
        // Initialize callback if provided
        if (callback) {
            callback(this);
        }
    },
    
    parseManifest: function() {
        var self = this;
        var tabContainer = document.getElementById('tab-container');
        var contentContainer = document.getElementById('content');
        
        // Group settings by tab
        var tabGroups = {};
        manifest.settings.forEach(function(setting) {
            if (!tabGroups[setting.tab]) {
                tabGroups[setting.tab] = {};
            }
            if (!tabGroups[setting.tab][setting.group]) {
                tabGroups[setting.tab][setting.group] = [];
            }
            tabGroups[setting.tab][setting.group].push(setting);
        });
        
        // Create tabs and content
        Object.keys(tabGroups).forEach(function(tabName, index) {
            // Create tab
            var tabDiv = document.createElement('div');
            tabDiv.className = 'tab';
            tabDiv.textContent = tabName;
            tabDiv.onclick = function() { self.showTab(tabName); };
            tabContainer.appendChild(tabDiv);
            self.tabs[tabName] = tabDiv;
            
            // Create content container
            var tabContent = document.createElement('div');
            tabContent.id = 'tab-' + tabName;
            tabContent.className = 'tab-content';
            tabContent.style.display = index === 0 ? 'block' : 'none';
            
            // Create groups
            Object.keys(tabGroups[tabName]).forEach(function(groupName) {
                var groupDiv = document.createElement('div');
                groupDiv.className = 'settings-group';
                
                var groupTitle = document.createElement('h2');
                groupTitle.textContent = groupName;
                groupDiv.appendChild(groupTitle);
                
                // Create settings
                tabGroups[tabName][groupName].forEach(function(setting) {
                    var settingElement = self.createSetting(setting);
                    if (settingElement) {
                        groupDiv.appendChild(settingElement);
                    }
                });
                
                tabContent.appendChild(groupDiv);
            });
            
            contentContainer.appendChild(tabContent);
        });
        
        // Show first tab
        var firstTab = Object.keys(self.tabs)[0];
        if (firstTab) {
            self.showTab(firstTab);
        }
    },
    
    showTab: function(tabName) {
        // Hide all tabs
        Object.keys(this.tabs).forEach(function(name) {
            var tabContent = document.getElementById('tab-' + name);
            if (tabContent) {
                tabContent.style.display = 'none';
            }
            if (this.tabs[name]) {
                this.tabs[name].classList.remove('active');
            }
        }, this);
        
        // Show selected tab
        var selectedContent = document.getElementById('tab-' + tabName);
        if (selectedContent) {
            selectedContent.style.display = 'block';
        }
        if (this.tabs[tabName]) {
            this.tabs[tabName].classList.add('active');
        }
    },
    
    createSetting: function(setting) {
        var self = this;
        var container = document.createElement('div');
        container.className = 'setting';
        container.style.padding = '15px 20px';
        container.style.borderBottom = '1px solid #e9ecef';
        
        // Add Element polyfill methods to container
        this.addElementMethods(container);
        
        // Create the setting based on type
        switch(setting.type) {
            case 'text':
                this.createTextSetting(container, setting);
                break;
            case 'button':
                this.createButtonSetting(container, setting);
                break;
            case 'checkbox':
                this.createCheckboxSetting(container, setting);
                break;
            case 'popupButton':
            case 'listBox':
                this.createSelectSetting(container, setting);
                break;
            case 'slider':
                this.createSliderSetting(container, setting);
                break;
            case 'description':
                this.createDescriptionSetting(container, setting);
                break;
        }
        
        // Store reference in manifest with additional properties expected by settings.js
        setting.container = container;
        setting.bundle = container; // Some settings.js code expects .bundle property
        setting.params = { name: setting.name, type: setting.type }; // Expected by settings.js
        
        // Ensure all settings have addEvent method (for settings that don't have it)
        if (!setting.addEvent) {
            setting.addEvent = function(event, handler) {
                // For settings without specific event handling, just store the handler
                console.log('addEvent called on', setting.name, 'for event', event);
            };
        }
        
        this.manifest[setting.name] = setting;
        
        return container;
    },
    
    addElementMethods: function(element) {
        // Add MooTools-style methods that settings.js expects
        if (!element.inject) {
            element.inject = function(parent, position) {
                position = position || 'bottom';
                if (position === 'bottom') {
                    parent.appendChild(element);
                } else if (position === 'top') {
                    parent.insertBefore(element, parent.firstChild);
                }
                return element;
            };
        }
        
        if (!element.setStyle) {
            element.setStyle = function(property, value) {
                element.style[property] = value;
                return element;
            };
        }
        
        if (!element.set) {
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
        }
        
        if (!element.addEvent) {
            element.addEvent = function(event, handler) {
                element.addEventListener(event, handler);
                return element;
            };
        }
        
        if (!element.dispose) {
            element.dispose = function() {
                if (element.parentNode) {
                    element.parentNode.removeChild(element);
                }
                return element;
            };
        }
    },
    
    createTextSetting: function(container, setting) {
        if (setting.label) {
            var label = document.createElement('label');
            label.textContent = setting.label;
            container.appendChild(label);
        }
        
        var input = document.createElement('input');
        input.type = setting.masked ? 'password' : 'text';
        input.id = setting.name;
        input.value = store.get(setting.name) || setting.default || '';
        
        // Add event listeners
        input.addEventListener('change', function() {
            store.set(setting.name, input.value);
            if (setting.onChange) setting.onChange(input.value);
        });
        
        container.appendChild(input);
        
        // Add Element methods to input
        this.addElementMethods(input);
        
        // Add methods to setting object
        setting.element = input;
        setting.get = function() { return input.value; };
        setting.set = function(value, silent) { 
            input.value = value; 
            if (!silent) store.set(setting.name, value);
        };
        setting.addEvent = function(event, handler) {
            if (event === 'action') {
                input.addEventListener('change', function() {
                    handler(input.value);
                });
            }
        };
    },
    
    createButtonSetting: function(container, setting) {
        var button = document.createElement('button');
        button.textContent = setting.text || 'Button';
        button.id = setting.name;
        
        container.appendChild(button);
        
        // Add Element methods to button
        this.addElementMethods(button);
        
        // Add methods to setting object
        setting.element = button;
        setting.addEvent = function(event, handler) {
            if (event === 'action') {
                button.addEventListener('click', handler);
            }
        };
    },
    
    createCheckboxSetting: function(container, setting) {
        var wrapper = document.createElement('label');
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        
        var checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = setting.name;
        checkbox.checked = store.get(setting.name) !== undefined ? 
            store.get(setting.name) : (setting.default || false);
        
        checkbox.addEventListener('change', function() {
            store.set(setting.name, checkbox.checked);
            if (setting.onChange) setting.onChange(checkbox.checked);
        });
        
        var labelText = document.createElement('span');
        labelText.innerHTML = setting.label || '';
        labelText.style.marginLeft = '8px';
        
        wrapper.appendChild(checkbox);
        wrapper.appendChild(labelText);
        container.appendChild(wrapper);
        
        // Add Element methods to checkbox
        this.addElementMethods(checkbox);
        
        // Add methods to setting object
        setting.element = checkbox;
        setting.get = function() { return checkbox.checked; };
        setting.set = function(value, silent) { 
            checkbox.checked = value; 
            if (!silent) store.set(setting.name, value);
        };
        setting.addEvent = function(event, handler) {
            if (event === 'action') {
                checkbox.addEventListener('change', function() {
                    handler(checkbox.checked);
                });
            }
        };
    },
    
    createSelectSetting: function(container, setting) {
        if (setting.label) {
            var label = document.createElement('label');
            label.textContent = setting.label;
            container.appendChild(label);
        }
        
        var select = document.createElement('select');
        select.id = setting.name;
        
        // Add options if provided
        if (setting.options) {
            setting.options.forEach(function(option) {
                var opt = document.createElement('option');
                if (Array.isArray(option)) {
                    opt.value = option[0];
                    opt.textContent = option[1];
                } else {
                    opt.value = option.value || option;
                    opt.textContent = option.text || option;
                }
                select.appendChild(opt);
            });
        }
        
        // Set initial value
        var currentValue = store.get(setting.name);
        if (currentValue !== undefined) {
            select.value = currentValue;
        }
        
        select.addEventListener('change', function() {
            store.set(setting.name, select.value);
            if (setting.onChange) setting.onChange(select.value);
        });
        
        container.appendChild(select);
        
        // Add Element methods to select
        this.addElementMethods(select);
        
        // Add methods to setting object
        setting.element = select;
        setting.get = function() { return select.value; };
        setting.set = function(value, silent) { 
            select.value = value; 
            if (!silent) store.set(setting.name, value);
        };
        setting.addEvent = function(event, handler) {
            if (event === 'action') {
                select.addEventListener('change', function() {
                    handler(select.value);
                });
            }
        };
    },
    
    createSliderSetting: function(container, setting) {
        if (setting.label) {
            var label = document.createElement('label');
            label.textContent = setting.label;
            container.appendChild(label);
        }
        
        var sliderWrapper = document.createElement('div');
        sliderWrapper.style.display = 'flex';
        sliderWrapper.style.alignItems = 'center';
        
        var slider = document.createElement('input');
        slider.type = 'range';
        slider.id = setting.name;
        slider.min = setting.min || 0;
        slider.max = setting.max || 100;
        slider.value = store.get(setting.name) || setting.default || 0;
        
        var display = document.createElement('span');
        display.style.marginLeft = '10px';
        display.textContent = slider.value + (setting.display ? ' ' + setting.display : '');
        
        slider.addEventListener('input', function() {
            display.textContent = slider.value + (setting.display ? ' ' + setting.display : '');
            store.set(setting.name, parseInt(slider.value));
            if (setting.onChange) setting.onChange(parseInt(slider.value));
        });
        
        sliderWrapper.appendChild(slider);
        sliderWrapper.appendChild(display);
        container.appendChild(sliderWrapper);
        
        // Add methods to setting object
        setting.element = slider;
        setting.get = function() { return parseInt(slider.value); };
        setting.set = function(value, silent) { 
            slider.value = value;
            display.textContent = value + (setting.display ? ' ' + setting.display : '');
            if (!silent) store.set(setting.name, value);
        };
        setting.addEvent = function(event, handler) {
            if (event === 'action') {
                slider.addEventListener('input', function() {
                    handler(parseInt(slider.value));
                });
            }
        };
    },
    
    createDescriptionSetting: function(container, setting) {
        var desc = document.createElement('div');
        desc.className = 'description';
        desc.innerHTML = setting.text || '';
        desc.style.padding = '10px 0';
        desc.style.color = '#666';
        desc.style.lineHeight = '1.4';
        container.appendChild(desc);
        
        setting.element = desc;
    }
};