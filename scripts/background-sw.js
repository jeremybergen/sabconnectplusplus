// Background Service Worker for SABconnect++
// Manifest V3 compatible

// Simplified store implementation for service worker
class ServiceWorkerStore {
    constructor(name, defaults) {
        this.name = name;
        this.defaults = defaults || {};
        this.data = {};
        this.isReady = false;
        this.readyCallbacks = [];
    }

    init(callback) {
        chrome.storage.local.get(null, (result) => {
            this.data = { ...this.defaults, ...result };
            this.isReady = true;
            if (callback) callback();
            this.readyCallbacks.forEach(cb => cb());
            this.readyCallbacks = [];
        });
    }

    get(key) {
        return this.data[key];
    }

    set(key, value) {
        this.data[key] = value;
        chrome.storage.local.set({ [key]: value });
    }

    fromObject(obj) {
        this.data = { ...obj };
        chrome.storage.local.set(obj);
    }

    ready(callback) {
        if (this.isReady) {
            callback();
        } else {
            this.readyCallbacks.push(callback);
        }
    }
}

// Simple ProfileManager implementation
class SimpleProfileManager {
    constructor() {
        this.store = store;
    }

    getActiveProfile() {
        const profiles = this.store.get('profiles') || {};
        const activeProfileName = this.store.get('activeProfile') || 'Default';
        return {
            name: activeProfileName,
            values: profiles[activeProfileName] || {
                url: this.store.get('sabnzbd_url'),
                api_key: this.store.get('sabnzbd_api_key'),
                username: this.store.get('sabnzbd_username'),
                password: this.store.get('sabnzbd_password')
            }
        };
    }

    setActiveProfile(name) {
        this.store.set('activeProfile', name);
    }

    getFirstProfile() {
        const profiles = this.store.get('profiles') || {};
        const firstKey = Object.keys(profiles)[0];
        return firstKey ? { name: firstKey, values: profiles[firstKey] } : null;
    }

    add(name, values) {
        const profiles = this.store.get('profiles') || {};
        if (profiles[name]) {
            throw 'already_exists';
        }
        profiles[name] = values;
        this.store.set('profiles', profiles);
    }
}

// Default settings
var defaultSettings = {
    sabnzbd_url: 'http://localhost:8080/',
    sabnzbd_api_key: '',
    sabnzbd_username: '',
    provider_binsearch: true,
    provider_bintube: true,
    provider_dognzb: true,
    provider_fanzub: true,
    provider_animezb: true,
    provider_animenzb: true,
    provider_nzbclub: true,
    provider_nzbindex: true,
    provider_yubse: true,
    provider_omgwtfnzbs: true,
    provider_nzbrss: true,
    provider_newznab: 'your_newznab.com, some_other_newznab.com',
    provider_usenet4ever: true,
    use_name_binsearch: true,
    use_name_nzbindex: true,
    use_name_yubse: true,
    config_refresh_rate: 15,
    config_enable_graph: true,
    config_enable_context_menu: true,
    config_enable_notifications: true,
    config_notification_timeout: 10,
    config_ignore_categories: false,
    config_use_user_categories: false,
    config_use_category_header: false,
    config_hard_coded_category: '',
    config_default_category: '',
    config_enable_automatic_authentication: true,
    config_enable_automatic_detection: true,
    profiles: {},
    first_profile_initialized: false,
    active_category: '*',
    settings_synced: false,
    // Custom notification rules
    notification_rules: {
        completion_enabled: true,
        completion_categories: [], // Empty = all categories
        failure_enabled: true,
        low_disk_space_enabled: true,
        low_disk_space_threshold: 1024, // MB
        speed_threshold_enabled: false,
        speed_threshold_value: 100 // KB/s
    },
    // Download statistics
    download_statistics: {
        enabled: true,
        daily: {},
        weekly: {},
        monthly: {},
        all_time: {
            total_downloads: 0,
            total_size_bytes: 0,
            total_failed: 0,
            average_speed: 0,
            first_download: null
        }
    },
    // Auto-pause scheduling
    auto_pause_schedule: {
        enabled: false,
        pause_time: '02:00',
        resume_time: '08:00',
        days: [1, 2, 3, 4, 5], // Monday to Friday (0=Sunday, 6=Saturday)
        last_action: null,
        next_pause: null,
        next_resume: null
    }
};

// Initialize store and profiles
var store = new ServiceWorkerStore('settings', defaultSettings);
var profiles = new SimpleProfileManager();

// Utility functions
function activeProfile() {
    try {
        var profile = profiles.getActiveProfile();
        if (!profile || !profile.values) {
            console.error('activeProfile: No active profile found');
            return null;
        }
        return profile.values;
    } catch (e) {
        console.error('activeProfile error:', e);
        return null;
    }
}

function checkEndSlash(input) {
    if (input.charAt(input.length-1) == '/') {
        return input;
    } else {
        return input + '/';
    }
}

function constructApiUrl(profileValues) {
    var profile = profileValues || activeProfile();
    if (!profile || !profile.url) {
        console.error('constructApiUrl: No valid profile or URL found');
        return null;
    }
    return checkEndSlash(profile.url) + 'api';
}

function constructApiPost(profileValues) {
    var profile = profileValues || activeProfile();
    var data = {};
    
    var apikey = profile.api_key;
    if (apikey) {
        data.apikey = apikey;
    }

    var username = profile.username;
    if (username) {
        data.ma_username = username;
    }

    var password = profile.password;
    if (password) {
        data.ma_password = password;
    }
    
    return data;
}

function getRefreshRate() {
    return parseInt(store.get('config_refresh_rate')) * 1000;
}

// Main functionality
function fileSizes(value, decimals) {
    if(decimals == null) decimals = 2;
    var kb = value / 1024;
    var mb = value / 1048576;
    var gb = value / 1073741824;
    var tb = value / 1099511627776; // 1024^4
    
    if (tb >= 1) {
        return tb.toFixed(decimals) + "TB";
    } else if (gb >= 1) {
        return gb.toFixed(decimals) + "GB";
    } else if (mb >= 1) {
        return mb.toFixed(decimals) + "MB";
    } else {
        return kb.toFixed(decimals) + "KB";
    }
}

function updateBadge(data) {
    if (data) {
        var slots = data.queue.noofslots;
        var badge = {};
        if (!slots) {
            badge.text = '';
        } else {
            badge.text = slots.toString();
        }
        chrome.action.setBadgeText(badge);
    }
}

function isDownloading(kbpersec) {
    return kbpersec && parseFloat(kbpersec) > 1;
}

function updateBackground(data) {
    if (data) {
        var badgeColor = {}
        if (isDownloading(data.queue.kbpersec)) {
            badgeColor.color = [0, 213, 7, 100];
        } else {
            badgeColor.color = [255, 0, 0, 100];
        }
        chrome.action.setBadgeBackgroundColor(badgeColor)
    }
}

function updateSpeedLog(data) {
    chrome.storage.local.get(['speedlog'], function(result) {
        var speedlog = [];
        
        if (result.speedlog) {
            speedlog = JSON.parse(result.speedlog);
            while (speedlog.length >= 10) {
                speedlog.shift();
            }
        }
        
        speedlog.push(data ? parseFloat(data.queue.kbpersec) : 0);
        chrome.storage.local.set({ speedlog: JSON.stringify(speedlog) });
    });
}

function fetchInfoSuccess(data, quickUpdate, callback) {
    if (!data || data.error) {
        chrome.storage.local.set({ 
            error: data ? data.error : 'Success with no data?'
        });
        
        if (callback) callback();
        return;
    }
    
    chrome.storage.local.set({ 
        error: '',
        timeleft: data ? data.queue.timeleft : '0',
        speed: data ? data.queue.speed + 'B/s' : '-',
        sizeleft: '',
        queue: data ? JSON.stringify(data.queue.slots) : '',
        queue_info: data ? JSON.stringify(data.queue) : '',  // Store full queue info for disk space
        status: data ? data.queue.status : '',
        paused: data ? data.queue.paused === true : false
    });
    
    if (data && data.queue.paused) {
        chrome.storage.local.set({ pause_int: data.queue.pause_int });
    }
    
    if (!quickUpdate) {
        updateSpeedLog(data);
    }

    var queueSize = '';
    if (data && data.queue.mbleft > 0) {
        var bytesInMegabyte = 1048576;
        var bytesLeft = data.queue.mbleft * bytesInMegabyte;
        queueSize = fileSizes(bytesLeft);
    }
    chrome.storage.local.set({ sizeleft: queueSize });
    
    updateBadge(data);
    updateBackground(data);

    if (callback) callback();
}

function fetchInfoError(error, callback) {
    chrome.storage.local.set({ 
        error: 'Could not connect to SABnzbd - Check it is running, the details in this plugin\'s settings are correct and that you are running at least SABnzbd version 0.5!'
    });
    
    if (callback) callback();
}

function sendSabRequest(params, success_callback, error_callback, profileValues) {
    var profile = profileValues || activeProfile();
    
    if (!profile) {
        console.error('sendSabRequest: No profile available');
        if (error_callback) error_callback(new Error('No profile configured'));
        return;
    }
    
    var sabApiUrl = constructApiUrl(profile);
    if (!sabApiUrl) {
        console.error('sendSabRequest: Could not construct API URL');
        if (error_callback) error_callback(new Error('Invalid SABnzbd URL'));
        return;
    }
    
    var data = constructApiPost(profile);
    data.output = 'json';
    
    for (var key in params) {
        data[key] = params[key];
    }
    
    
    var url = new URL(sabApiUrl);
    Object.keys(data).forEach(key => url.searchParams.append(key, data[key]));
    
    var headers = {};
    if (profile.username && profile.password) {
        headers['Authorization'] = 'Basic ' + btoa(profile.username + ':' + profile.password);
    }
    
    
    fetch(url, {
        method: 'GET',
        headers: headers
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('HTTP ' + response.status + ': ' + response.statusText);
        }
        return response.json();
    })
    .then(data => {
        if (success_callback) success_callback(data);
    })
    .catch(error => {
        console.error('sendSabRequest: Error:', error);
        if (error_callback) error_callback(error);
    });
}

function fetchInfo(quickUpdate, callback, profileValues) {
    var params = {
        mode: 'queue',
        limit: '5'
    };
    
    sendSabRequest(
        params,
        function(data) { fetchInfoSuccess(data, quickUpdate, callback); },
        function(error) { fetchInfoError(error, callback); },
        profileValues
    );
}

function testConnection(profileValues, callback) {
    fetchInfo(true, callback, profileValues);
}

function setMaxSpeed(speed, success_callback, error_callback) {
    
    // Validate input
    if (!speed && speed !== '0') {
        console.error('setMaxSpeed: Invalid speed value:', speed);
        if (error_callback) error_callback('Invalid speed value');
        return;
    }
    
    var params = {
        mode: 'config',
        name: 'speedlimit',
        value: speed
    };
    
    
    sendSabRequest(params, 
        function(data) {
            if (success_callback) success_callback(data);
        }, 
        function(error) {
            if (error_callback) error_callback(error);
        }
    );
}

function getMaxSpeed(success_callback, error_callback) {
    
    // Use queue mode to get speedlimit since get_speedlimit is not implemented
    var params = {
        mode: 'queue',
        limit: '0'  // Don't need queue items, just the queue info
    };
    
    
    sendSabRequest(params, 
        function(data) {
            if (success_callback) success_callback(data);
        },
        function(error) {
            if (error_callback) error_callback(error);
        }
    );
}

function refresh(quick, callback) {
    if (!callback) {
        callback = function() {
            chrome.runtime.sendMessage({ action: 'refresh_popup' });
        };
    }
    
    fetchInfo(quick, function() {
        // Check custom notification rules after refreshing data
        if (!quick) {
            checkNotificationRules();
            // Check auto-pause schedule
            updateScheduleStatus();
        }
        if (callback) callback();
    });
    
    if (!quick && store.get('config_enable_notifications') === true) {
        var params = {
            mode: 'history',
            limit: '10'
        };
        sendSabRequest(params, function(data) {
            // Handle completion/failure notifications
            checkCompletionNotifications(data);
        });
    }
}

function checkNotificationRules() {
    chrome.storage.local.get(['queue_info'], function(result) {
        if (!result.queue_info) return;
        
        try {
            var queueData = JSON.parse(result.queue_info);
            var rules = store.get('notification_rules') || {};
            
            // Check low disk space
            if (rules.low_disk_space_enabled && queueData.diskspace1) {
                var availableGB = parseFloat(queueData.diskspace1);
                var thresholdGB = rules.low_disk_space_threshold / 1024;
                
                if (availableGB < thresholdGB) {
                    showNotification(
                        'Low Disk Space Warning',
                        `Only ${availableGB.toFixed(1)}GB remaining`,
                        'warning'
                    );
                }
            }
            
            // Check speed threshold
            if (rules.speed_threshold_enabled && queueData.kbpersec) {
                var currentSpeed = parseFloat(queueData.kbpersec);
                
                if (currentSpeed > 0 && currentSpeed < rules.speed_threshold_value) {
                    showNotification(
                        'Slow Download Speed',
                        `Current speed: ${currentSpeed.toFixed(1)} KB/s`,
                        'info'
                    );
                }
            }
            
        } catch (e) {
            console.error('Error checking notification rules:', e);
        }
    });
}

function checkCompletionNotifications(historyData) {
    if (!historyData || !historyData.history || !historyData.history.slots) return;
    
    var rules = store.get('notification_rules') || {};
    
    // Check for recent completions/failures and update statistics
    historyData.history.slots.forEach(function(item) {
        var completedTime = new Date(item.completed * 1000);
        var now = new Date();
        var timeDiff = now - completedTime;
        
        // Track statistics for all completed items
        updateDownloadStatistics(item);
        
        // Only notify about items completed in the last 5 minutes
        if (timeDiff < 5 * 60 * 1000) {
            if (item.status === 'Completed' && rules.completion_enabled) {
                // Check category filter
                if (rules.completion_categories.length === 0 || 
                    rules.completion_categories.includes(item.category)) {
                    showNotification(
                        'Download Completed',
                        item.name,
                        'success'
                    );
                }
            } else if (item.status === 'Failed' && rules.failure_enabled) {
                showNotification(
                    'Download Failed',
                    `${item.name} - ${item.fail_message || 'Unknown error'}`,
                    'error'
                );
            }
        }
    });
}

function updateDownloadStatistics(item) {
    var stats = store.get('download_statistics') || defaultSettings.download_statistics;
    if (!stats.enabled) return;
    
    var completedTime = new Date(item.completed * 1000);
    var dateKey = getDateKey(completedTime);
    var weekKey = getWeekKey(completedTime);
    var monthKey = getMonthKey(completedTime);
    
    var sizeBytes = parseFloat(item.bytes || 0);
    var isCompleted = item.status === 'Completed';
    var isFailed = item.status === 'Failed';
    
    // Initialize date entries if they don't exist
    if (!stats.daily[dateKey]) {
        stats.daily[dateKey] = createEmptyStats();
    }
    if (!stats.weekly[weekKey]) {
        stats.weekly[weekKey] = createEmptyStats();
    }
    if (!stats.monthly[monthKey]) {
        stats.monthly[monthKey] = createEmptyStats();
    }
    
    // Update statistics
    if (isCompleted) {
        stats.daily[dateKey].downloads++;
        stats.daily[dateKey].total_size += sizeBytes;
        stats.weekly[weekKey].downloads++;
        stats.weekly[weekKey].total_size += sizeBytes;
        stats.monthly[monthKey].downloads++;
        stats.monthly[monthKey].total_size += sizeBytes;
        
        // Update all-time stats
        stats.all_time.total_downloads++;
        stats.all_time.total_size_bytes += sizeBytes;
        if (!stats.all_time.first_download) {
            stats.all_time.first_download = completedTime.toISOString();
        }
    } else if (isFailed) {
        stats.daily[dateKey].failed++;
        stats.weekly[weekKey].failed++;
        stats.monthly[monthKey].failed++;
        stats.all_time.total_failed++;
    }
    
    // Clean up old statistics (keep last 90 days, 52 weeks, 24 months)
    cleanupOldStatistics(stats);
    
    // Save updated statistics
    store.set('download_statistics', stats);
}

function createEmptyStats() {
    return {
        downloads: 0,
        total_size: 0,
        failed: 0,
        avg_speed: 0
    };
}

function getDateKey(date) {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

function getWeekKey(date) {
    var week = getWeekNumber(date);
    return `${date.getFullYear()}-W${week.toString().padStart(2, '0')}`;
}

function getMonthKey(date) {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
}

function getWeekNumber(date) {
    var d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    var week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function cleanupOldStatistics(stats) {
    var now = new Date();
    var cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
    
    // Clean up daily stats
    Object.keys(stats.daily).forEach(function(dateKey) {
        var date = new Date(dateKey);
        if (date < cutoffDate) {
            delete stats.daily[dateKey];
        }
    });
    
    // Clean up weekly stats (keep last 52 weeks)
    var weekKeys = Object.keys(stats.weekly).sort();
    if (weekKeys.length > 52) {
        weekKeys.slice(0, weekKeys.length - 52).forEach(function(key) {
            delete stats.weekly[key];
        });
    }
    
    // Clean up monthly stats (keep last 24 months)
    var monthKeys = Object.keys(stats.monthly).sort();
    if (monthKeys.length > 24) {
        monthKeys.slice(0, monthKeys.length - 24).forEach(function(key) {
            delete stats.monthly[key];
        });
    }
}

function getDownloadStatistics(period) {
    var stats = store.get('download_statistics') || defaultSettings.download_statistics;
    var now = new Date();
    
    switch (period) {
        case 'today':
            return stats.daily[getDateKey(now)] || createEmptyStats();
        case 'week':
            return stats.weekly[getWeekKey(now)] || createEmptyStats();
        case 'month':
            return stats.monthly[getMonthKey(now)] || createEmptyStats();
        case 'all_time':
            return stats.all_time;
        default:
            return stats;
    }
}

function showNotification(title, message, type) {
    // Store the last notification to avoid duplicates
    var notificationKey = `last_notification_${type}_${title}`;
    chrome.storage.local.get([notificationKey], function(result) {
        var lastNotified = result[notificationKey] || 0;
        var now = Date.now();
        
        // Don't show same notification more than once per 10 minutes
        if (now - lastNotified < 10 * 60 * 1000) return;
        
        chrome.notifications.create({
            type: 'basic',
            iconUrl: getNotificationIcon(type),
            title: title,
            message: message
        });
        
        // Store when we last showed this notification
        chrome.storage.local.set({ [notificationKey]: now });
    });
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'images/content_icon_success.png';
        case 'error': return 'images/content_icon_error.png';
        case 'warning': return 'images/content_icon_error.png';
        default: return 'images/content_icon.png';
    }
}

function resetSettings() {
    store.fromObject(defaultSettings);
}

function restartTimer() {
    chrome.alarms.clear('refresh');
    startTimer();
}

function startTimer() {
    var refreshRate = getRefreshRate();
    if (refreshRate > 0) {
        var minutes = refreshRate / 60000;
        chrome.alarms.create('refresh', { periodInMinutes: minutes });
    } else {
    }
}

function refreshRateChanged() {
    restartTimer();
}

// Auto-pause scheduling functions
function updateScheduleStatus() {
    var schedule = store.get('auto_pause_schedule') || defaultSettings.auto_pause_schedule;
    if (!schedule.enabled) return;
    
    var now = new Date();
    var currentDay = now.getDay(); // 0=Sunday, 6=Saturday
    var currentTime = now.getHours() * 60 + now.getMinutes(); // Minutes since midnight
    
    // Check if today is a scheduled day
    if (!schedule.days.includes(currentDay)) return;
    
    // Parse schedule times
    var pauseTimeParts = schedule.pause_time.split(':');
    var resumeTimeParts = schedule.resume_time.split(':');
    var pauseMinutes = parseInt(pauseTimeParts[0]) * 60 + parseInt(pauseTimeParts[1]);
    var resumeMinutes = parseInt(resumeTimeParts[0]) * 60 + parseInt(resumeTimeParts[1]);
    
    // Check if we need to pause or resume
    var shouldBePaused = false;
    if (pauseMinutes < resumeMinutes) {
        // Same day schedule (e.g., pause at 2:00, resume at 8:00)
        shouldBePaused = currentTime >= pauseMinutes && currentTime < resumeMinutes;
    } else {
        // Overnight schedule (e.g., pause at 22:00, resume at 6:00)
        shouldBePaused = currentTime >= pauseMinutes || currentTime < resumeMinutes;
    }
    
    // Get current pause status
    chrome.storage.local.get(['paused'], function(result) {
        var currentlyPaused = result.paused;
        var timeString = now.toTimeString().substring(0, 8);
        
        if (shouldBePaused && !currentlyPaused && schedule.last_action !== 'pause_' + timeString.substring(0, 5)) {
            // Should pause and not currently paused
            sendSabRequest({ mode: 'pause' }, function(data) {
                schedule.last_action = 'pause_' + timeString.substring(0, 5);
                store.set('auto_pause_schedule', schedule);
            });
        } else if (!shouldBePaused && currentlyPaused && schedule.last_action !== 'resume_' + timeString.substring(0, 5)) {
            // Should resume and currently paused (only if paused by schedule)
            if (schedule.last_action && schedule.last_action.startsWith('pause_')) {
                sendSabRequest({ mode: 'resume' }, function(data) {
                    schedule.last_action = 'resume_' + timeString.substring(0, 5);
                    store.set('auto_pause_schedule', schedule);
                });
            }
        }
    });
}

function calculateNextScheduleEvents() {
    var schedule = store.get('auto_pause_schedule') || defaultSettings.auto_pause_schedule;
    if (!schedule.enabled || schedule.days.length === 0) {
        return { nextPause: null, nextResume: null };
    }
    
    var now = new Date();
    var nextPause = null;
    var nextResume = null;
    
    // Check next 7 days for scheduled events
    for (var i = 0; i < 7; i++) {
        var checkDate = new Date(now);
        checkDate.setDate(checkDate.getDate() + i);
        var dayOfWeek = checkDate.getDay();
        
        if (schedule.days.includes(dayOfWeek)) {
            // Parse times for this day
            var pauseTimeParts = schedule.pause_time.split(':');
            var resumeTimeParts = schedule.resume_time.split(':');
            
            var pauseTime = new Date(checkDate);
            pauseTime.setHours(parseInt(pauseTimeParts[0]), parseInt(pauseTimeParts[1]), 0, 0);
            
            var resumeTime = new Date(checkDate);
            resumeTime.setHours(parseInt(resumeTimeParts[0]), parseInt(resumeTimeParts[1]), 0, 0);
            
            // If resume time is before pause time, it's next day
            if (resumeTime <= pauseTime) {
                resumeTime.setDate(resumeTime.getDate() + 1);
            }
            
            // Check if these events are in the future
            if (pauseTime > now && !nextPause) {
                nextPause = pauseTime;
            }
            if (resumeTime > now && !nextResume) {
                nextResume = resumeTime;
            }
        }
    }
    
    return { nextPause: nextPause, nextResume: nextResume };
}

function getScheduleStatus() {
    var schedule = store.get('auto_pause_schedule') || defaultSettings.auto_pause_schedule;
    if (!schedule.enabled) {
        return { status: 'disabled', message: 'Schedule disabled' };
    }
    
    var events = calculateNextScheduleEvents();
    var now = new Date();
    
    if (events.nextPause && events.nextResume) {
        var nextEvent = events.nextPause < events.nextResume ? events.nextPause : events.nextResume;
        var isNextPause = nextEvent === events.nextPause;
        var timeDiff = nextEvent - now;
        var hoursUntil = Math.floor(timeDiff / (1000 * 60 * 60));
        var minutesUntil = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        
        var timeString = '';
        if (hoursUntil > 0) {
            timeString = hoursUntil + 'h ' + minutesUntil + 'm';
        } else {
            timeString = minutesUntil + 'm';
        }
        
        return {
            status: 'active',
            message: 'Next ' + (isNextPause ? 'pause' : 'resume') + ' in ' + timeString,
            nextEvent: nextEvent,
            isNextPause: isNextPause
        };
    } else {
        return { status: 'warning', message: 'No upcoming scheduled events' };
    }
}

function SetupContextMenu() {
    if (store.get('config_enable_context_menu')) {
        chrome.contextMenus.create({
            id: "SABconnect",
            title: "Send to SABnzbd",
            contexts: ["link"],
            targetUrlPatterns: ["*://*/*"]
        });
    }
}

function addToSABnzbd(request, sendResponse) {
    var nzburl = request.nzburl;
    var mode = request.mode;
    var nzbname = request.nzbname;
    
    var sabApiUrl = constructApiUrl();
    var data = constructApiPost();
    data.mode = mode;
    data.name = nzburl;
    data.output = 'json';
    if (nzbname) {
        data.nzbname = nzbname;
    }
    
    var url = new URL(sabApiUrl);
    Object.keys(data).forEach(key => url.searchParams.append(key, data[key]));
    
    var profile = activeProfile();
    var headers = {};
    if (profile.username && profile.password) {
        headers['Authorization'] = 'Basic ' + btoa(profile.username + ':' + profile.password);
    }
    
    fetch(url, {
        method: 'GET',
        headers: headers
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        sendResponse({ ret: 'success', data: data });
    })
    .catch(error => {
        sendResponse({ ret: 'error' });
    });
    
    fetchInfo(true);
}

function initializeProfile() {
    var firstProfileInitialized = store.get('first_profile_initialized');
    if (!firstProfileInitialized) {
        try {
            profiles.add('Default', {
                url: store.get('sabnzbd_url'),
                api_key: store.get('sabnzbd_api_key'),
                username: store.get('sabnzbd_username'),
                password: store.get('sabnzbd_password')
            });
            profiles.setActiveProfile("Default");
        } catch (e) {
            // Profile already exists or other error
        }
        store.set('first_profile_initialized', true);
        return;
    }
    
    var profile = profiles.getActiveProfile();
    if (!profile || !profile.values) {
        profile = profiles.getFirstProfile();
        if (profile) {
            profiles.setActiveProfile(profile.name);
        }
    }
}

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'initialize':
            if (request.provider) {
                var setting = 'provider_' + request.provider;
                sendResponse({ response: request.action, enabled: store.get(setting) });
            }
            break;
        case 'set_setting':
            store.set(request.setting, request.value);
            sendResponse({ response: request.action, value: true });
            break;
        case 'get_setting':
            sendResponse({ response: request.action, value: store.get(request.setting) });
            break;
        case 'addToSABnzbd':
            addToSABnzbd(request, sendResponse);
            return true;
        case 'get_categories':
            var params = { mode: 'get_cats' };
            sendSabRequest(params, sendResponse);
            return true;
        case 'refresh':
            refresh();
            sendResponse({ success: true });
            break;
        case 'setMaxSpeed':
            setMaxSpeed(request.speed, 
                function(data) { 
                    sendResponse({ success: true }); 
                },
                function(error) { 
                    sendResponse({ success: false }); 
                }
            );
            return true;
        case 'getMaxSpeed':
            getMaxSpeed(function(data) {
                sendResponse({ success: true, data: data });
            }, function(error) {
                sendResponse({ success: false, error: error });
            });
            return true;
        case 'testConnection':
            testConnection(request.profileValues, function(result) {
                // Check if there was an error
                chrome.storage.local.get(['error'], function(storage) {
                    var hasError = storage.error && storage.error !== '';
                    sendResponse({ 
                        success: !hasError,
                        error: storage.error || null
                    });
                });
            });
            return true;
        case 'resetSettings':
            resetSettings();
            sendResponse({ success: true });
            break;
        case 'restartTimer':
            restartTimer();
            sendResponse({ success: true });
            break;
        case 'setupContextMenu':
            SetupContextMenu();
            sendResponse({ success: true });
            break;
        case 'refreshRateChanged':
            refreshRateChanged();
            sendResponse({ success: true });
            break;
        case 'profileChanged':
            sendResponse({ success: true });
            break;
        case 'getStatistics':
            var period = request.period || 'today';
            // Fetch statistics from SABnzbd API
            fetchStatisticsFromSAB(period, function(stats) {
                sendResponse({ 
                    success: true, 
                    statistics: stats
                });
            });
            return true; // Indicate async response
        case 'getHistory':
            var limit = request.limit || 10;
            // Use the correct SABnzbd history API according to documentation
            var params = { 
                mode: 'history',
                start: 0,
                limit: limit,
                archive: 1  // Include archived/completed downloads
            };
            sendSabRequest(params, 
                function(data) {
                    sendResponse({ success: true, history: data });
                },
                function(error) {
                    console.error('SABnzbd history error:', error);
                    sendResponse({ success: false, error: error });
                }
            );
            return true;
        case 'toggleQueue':
            var mode = request.mode; // 'pause' or 'resume'
            sendSabRequest({ mode: mode }, 
                function(data) {
                    sendResponse({ success: true, data: data });
                },
                function(error) {
                    sendResponse({ success: false, error: error });
                }
            );
            return true;
        case 'getScheduleStatus':
            sendResponse({ 
                success: true, 
                status: getScheduleStatus()
            });
            break;
        case 'updateSchedule':
            var schedule = store.get('auto_pause_schedule') || defaultSettings.auto_pause_schedule;
            if (request.schedule) {
                Object.assign(schedule, request.schedule);
                store.set('auto_pause_schedule', schedule);
                sendResponse({ success: true });
            } else {
                sendResponse({ success: false, error: 'No schedule data provided' });
            }
            break;
        case 'getSchedule':
            sendResponse({ 
                success: true, 
                schedule: store.get('auto_pause_schedule') || defaultSettings.auto_pause_schedule
            });
            break;
        case 'shutdownSAB':
            sendSabRequest({ mode: 'shutdown' }, 
                function(data) {
                    sendResponse({ success: true, data: data });
                },
                function(error) {
                    sendResponse({ success: false, error: error });
                }
            );
            return true;
        case 'restartSAB':
            sendSabRequest({ mode: 'restart' }, 
                function(data) {
                    sendResponse({ success: true, data: data });
                },
                function(error) {
                    sendResponse({ success: false, error: error });
                }
            );
            return true;
    }
});

// Alarm handler
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'refresh') {
        refresh();
    }
});

// Context menu handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "SABconnect" && info.linkUrl) {
        addToSABnzbd({ 
            nzburl: info.linkUrl, 
            mode: 'addurl' 
        }, function(response) {
            // Handle response if needed
        });
    }
});

// Fetch statistics from SABnzbd API
function fetchStatisticsFromSAB(period, callback) {
    try {
        var params = { mode: 'server_stats' };
        
        sendSabRequest(params, 
            function(data) {
                try {
                    if (data && typeof data === 'object') {
                        var stats = {
                            downloads: 0,
                            total_size: 0,
                            failed: 0
                        };
                        
                        // The API returns simple numeric values for bytes downloaded
                        // No download counts are provided, only total bytes
                        switch (period) {
                            case 'today':
                                if (data.day !== undefined) {
                                    stats.downloads = '-'; // Count not available
                                    stats.total_size = parseFloat(data.day) || 0;
                                }
                                break;
                            case 'month':
                                if (data.month !== undefined) {
                                    stats.downloads = '-'; // Count not available
                                    stats.total_size = parseFloat(data.month) || 0;
                                }
                                break;
                            case 'all_time':
                            default:
                                if (data.total !== undefined) {
                                    stats.downloads = '-'; // Count not available
                                    stats.total_size = parseFloat(data.total) || 0;
                                }
                                break;
                        }
                        
                        callback(stats);
                    } else {
                        // Fallback to local statistics if API response is invalid
                        callback(getDownloadStatistics(period));
                    }
                } catch (parseError) {
                    console.error('Error parsing server stats:', parseError);
                    callback(getDownloadStatistics(period));
                }
            },
            function(error) {
                console.error('Error fetching server stats:', error);
                // Fallback to local statistics on error
                callback(getDownloadStatistics(period));
            }
        );
    } catch (error) {
        console.error('Error in fetchStatisticsFromSAB:', error);
        // Ensure callback is always called
        callback(getDownloadStatistics(period));
    }
}

// Initialize when service worker starts
store.init(function() {
    initializeProfile();
    startTimer();
    SetupContextMenu();
});