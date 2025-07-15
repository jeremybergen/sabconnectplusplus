// profiles will be initialized by the calling page
var profiles = null;
var StoreClass = StoreSync;
// Background function no longer needed in Manifest V3
// Service workers handle background functionality directly
function background()
{
	// For backwards compatibility, return null
	// Callers should use chrome.runtime.sendMessage instead
	return null;
}

function activeProfile()
{
	if (!profiles) {
		console.error('ProfileManager not initialized');
		return null;
	}
	var profile = profiles.getActiveProfile();
	return profile ? profile.values : null;
}

// Ensure functions are available globally
window.activeProfile = activeProfile;

function setPref(key, value) {
	// Store temporarily in chrome.storage.local
	chrome.storage.local.set({ [key]: value });
	
	if (key == 'refresh_rate') {
		chrome.runtime.sendMessage({ action: 'refreshRateChanged' });
	}
}

// Note: getPref is now async due to chrome.storage
// Use chrome.storage.local.get directly for new code
function getPref(key, callback) {
	chrome.storage.local.get([key], function(result) {
		var v = result[key];
		if (v == 'true') v = true;
		if (v == 'false') v = false;
		if (callback) callback(v);
	});
}

function checkEndSlash(input) {
	if (input.charAt(input.length-1) == '/') {
		return input;
	} else {
		var output = input+'/';
		return output;
	}
}

function constructApiUrl( profileValues ) {
	var profile = profileValues || activeProfile();
	if (!profile || !profile.url) {
		return null;
	}
	return checkEndSlash( profile.url ) + 'api';
}

function constructApiPost( profileValues ) {
	var profile = profileValues || activeProfile();
	var data = {};
	
	if (!profile) {
		return data;
	}
	
	var apikey = profile.api_key;
	if( apikey ) {
		data.apikey = apikey;
	}

	var username = profile.username;
	if( username ) {
		data.ma_username = username;
	}

	var password = profile.password;
	if( password ) {
		data.ma_password = password;
	}
	
	return data;
}

function getRefreshRate()
{
	return parseInt( background().store.get( 'config_refresh_rate' ) ) * 1000;
}

/// Used to merge two associative arrays.
function combine( dst, src )
{
	for( var property in src ) {
		if( src.hasOwnProperty( property ) ) {
			dst[property] = src[property];
		}
	}
	
	return dst;
}