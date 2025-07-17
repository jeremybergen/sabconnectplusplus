if (window.sabconnectStore) {
	var store = window.sabconnectStore;
	if (store.isReady) {
		storeReady_settings();
	} else {
		store.readyCallbacks.push(storeReady_settings);
	}
} else {
	var store = new StoreClass('settings', undefined, undefined, storeReady_settings);
	window.sabconnectStore = store;
}

var profiles = null;

function getPref(name) {
    return store.get(name);
}

function setPref(name, value) {
    return store.set(name, value);
}

window.getPref = getPref;
window.setPref = setPref;

function storeReady_settings() {
	
	if (!store.isReady) {
		setTimeout(storeReady_settings, 50);
		return;
	}
	
	if (!store.data.profiles) {
		setTimeout(storeReady_settings, 50);
		return;
	}
	
	chrome.storage.local.get(['profiles'], function(result) {
		
		setTimeout(function() {
			profiles = new ProfileManager();
		
		var existingProfiles = store.get('profiles');
		
		var directProfileData = store.data.profiles;
		
		if (directProfileData && typeof directProfileData === 'object' && 
			Object.keys(directProfileData).length > Object.keys(existingProfiles || {}).length) {
			existingProfiles = directProfileData;
			store.data.profiles = directProfileData;
		}
		
		
		var shouldCreateDefault = !existingProfiles || typeof existingProfiles !== 'object' || Object.keys(existingProfiles).length === 0;
		
		if (shouldCreateDefault) {
			var defaultProfiles = {
				'Default': {
					url: '',
					api_key: '',
					username: '',
					password: ''
				}
			};
			store.set('profiles', defaultProfiles);
			store.set('active_profile', 'Default');
		} else {
		}
		
		if (!store.get('active_profile')) {
			var firstProfile = Object.keys(store.get('profiles') || {})[0];
			if (firstProfile) {
				store.set('active_profile', firstProfile);
			}
		}
		
			FancySettings.initWithManifest( InitializeSettings );
		}, 100);
	});
}

var popup = null;
var settings = null;

this.is_sabconnect_settings = true;

var profileMissingErrorMsg =
	'A connection profile exists in the popup but does not exist in localStorage for some reason. '+
	'Please file a bug at the SABconnect++ Google Code page if you see this message and explain '+
	'what you did to reproduce this error.'

var ProfilePopup = new Class({
	'profiles': {},
	
	'initialize': function ( settings )
	{
		this.settings = settings;
	},
	
	'add': function ( name )
	{
		var opt = new Element('option', {
			'id': name,
			'text': name
		});
		
		opt.inject(this.settings.manifest.profile_popup.element);
		this.profiles[name] = opt;
	},
	
	'remove': function ( name )
	{
		this.profiles[name].dispose();
		delete this.profiles[name];
	},
	
	'rename': function( currentName, newName )
	{
		var p = this.profiles[currentName];
		p.set( 'id', newName );
		p.set( 'text', newName );
		
		delete this.profiles[currentName];
		this.profiles[newName] = p;
	},
	
	'setSelection': function( name )
	{
		this.settings.manifest.profile_popup.element.value = name;
	},
	
	'getSelection': function()
	{
		return this.settings.manifest.profile_popup.element.value;
	}
});

function checkForErrors()
{
	var error = getPref('error');
	if(error) {
		$('connection-status')
			.set( 'class', 'connection-status-failure' )
			.set( 'html', 'Failed' )
			;
	} else {
		$('connection-status')
			.set( 'class', 'connection-status-success' )
			.set( 'html', 'Succeeded' )
			;
	}
	
	setPref('error', '');
}

function OnTestConnectionClicked()
{
	$('connection-status')
		.set( 'class', '' )
		.set( 'html', 'Running...' )
		;

	chrome.runtime.sendMessage({ 
		action: 'testConnection', 
		profileValues: getConnectionValues() 
	}, function(response) {
		if (response && response.success) {
			$('connection-status')
				.set( 'class', 'connection-status-success' )
				.set( 'html', 'Succeeded' );
		} else {
			$('connection-status')
				.set( 'class', 'connection-status-failure' )
				.set( 'html', 'Failed: ' + (response && response.error ? response.error : 'Unknown error') );
		}
	});
}
	
function RefreshControlStates( settings )
{
	for( var name in settings.manifest ) {
		var setting = settings.manifest[name];
		if( typeOf( setting.set ) === "function" ) {
			setting.set( store.get( setting.params.name ) );
		}
	}
}

function OnResetConfigClicked( settings )
{
	chrome.runtime.sendMessage({ action: 'resetSettings' });
	RefreshControlStates( settings );
}

function OnRefreshRateChanged()
{
	chrome.runtime.sendMessage({ action: 'restartTimer' });
	chrome.runtime.sendMessage({ action: 'settings_changed' });
}

function CreateTestConnectionStatusElement( settings )
{
	var resultDiv = new Element( 'div', {
		id: 'connection-status'
	});
	
	resultDiv.inject( settings.manifest.test_connection.container, 'bottom' );
}

function OnToggleContextMenu()
{
	chrome.runtime.sendMessage({ action: 'setupContextMenu' });
	chrome.runtime.sendMessage({ action: 'settings_changed' });
}

function NotifyTabRefresh()
{
	chrome.windows.getAll( {populate: true}, function( windows ) {
		windows.forEach( function( window ) {
			window.tabs.forEach( function( tab ) {
				chrome.tabs.sendMessage( tab.id, { action: 'refresh_settings' } );
			});
		});
	});
}

function RegisterContentScriptNotifyHandlers( settings )
{
	Object.each( settings.manifest, function( setting ) {
		if( setting.params.type !== 'button' ) {
			setting.addEvent( 'action', NotifyTabRefresh );
			setting.addEvent( 'action', function() {
				chrome.runtime.sendMessage({ action: 'settings_changed' });
			});
		}
	});
}

function SetupConnectionProfiles( settings )
{
	popup = new ProfilePopup( settings );
	
	var profileNames = store.get( 'profiles' );
	
	for( var p in profileNames ) {
		popup.add( p );
	}

	var activeProfile = profiles.getActiveProfile();
	
	if (activeProfile && activeProfile.name) {
		changeActiveProfile( activeProfile.name );
	} else {
		var allProfiles = store.get('profiles');
		if (allProfiles && typeof allProfiles === 'object') {
			var firstProfileName = Object.keys(allProfiles)[0];
			if (firstProfileName) {
				changeActiveProfile(firstProfileName);
			}
		}
	}
}

function getConnectionValues()
{
	return {
		'url': settings.manifest.sabnzbd_url.get(),
		'api_key': settings.manifest.sabnzbd_api_key.get(),
		'username': settings.manifest.sabnzbd_username.get(),
		'password': settings.manifest.sabnzbd_password.get()
	};
}

function setConnectionValues( profileName, url, api_key, username, password )
{
	try {
		settings.manifest.profile_name.set( profileName, true );
		settings.manifest.sabnzbd_url.set( url || '', true );
		settings.manifest.sabnzbd_api_key.set( api_key || '', true );
		settings.manifest.sabnzbd_username.set( username || '', true );
		settings.manifest.sabnzbd_password.set( password || '', true );
		
		if (settings.manifest.sabnzbd_url.refresh) {
			settings.manifest.sabnzbd_url.refresh();
		}
		if (settings.manifest.sabnzbd_api_key.refresh) {
			settings.manifest.sabnzbd_api_key.refresh();
		}
		if (settings.manifest.sabnzbd_username.refresh) {
			settings.manifest.sabnzbd_username.refresh();
		}
		if (settings.manifest.sabnzbd_password.refresh) {
			settings.manifest.sabnzbd_password.refresh();
		}
		
	} catch (error) {
		console.error('Error setting connection values:', error);
	}
}

function generateUniqueName( name )
{
	var newName = name;
	var counter = 1;
	
	while( profiles.contains( newName ) ) {
		newName = name + counter++;
	}
	
	return newName;
}

function OnCreateProfileClicked()
{
	try {
		var name = generateUniqueName( 'New Profile' );
		
		setConnectionValues( name, '', '', '', '' );
		profiles.add( name, getConnectionValues() );
		profiles.setActiveProfile( name );
		
		popup.add( name );
		popup.setSelection( name );
	}
	catch( e ) {
		throw e;
	}
}

function OnDuplicateProfileClicked()
{
	try {
		var activeProfile = profiles.getActiveProfile();
		var name = generateUniqueName( activeProfile.name );
		
		var values = activeProfile.values;
		setConnectionValues( name, values.url, values.api_key, values.username, values.password );
		profiles.add( name, activeProfile.values );
		profiles.setActiveProfile( name );
		
		popup.add( name );
		popup.setSelection( name );
	}
	catch( e ) {
		throw e;
	}
}

function OnDeleteProfileClicked()
{
	try {
		var selectedProfile = popup.getSelection();
		popup.remove( selectedProfile );
		
		var newActive = profiles.remove( selectedProfile );
		if( newActive ) {
			changeActiveProfile( newActive );
		}
	}
	catch( e ) {
		if( e == 'profile_missing' ) {
			alert( profileMissingErrorMsg );
		}
		else {
			throw e;
		}
	}
}

function changeActiveProfile( profileName )
{
	var allProfiles = store.get('profiles');
	
	if (!allProfiles || !allProfiles[profileName]) {
		console.error('Profile not found in storage:', profileName);
		return;
	}
	
	profiles.setActiveProfile( profileName );
	popup.setSelection( profileName );
	
	var profileData = allProfiles[profileName];
	
	var password = store.get("profile_pass" + profileName) || "";
	
	if( profileData ) {
		setConnectionValues( 
			profileName, 
			profileData.url || '', 
			profileData.api_key || '', 
			profileData.username || '', 
			password 
		);
		
		store.set('sabnzbd_url', profileData.url || '');
		store.set('sabnzbd_api_key', profileData.api_key || '');
		store.set('sabnzbd_username', profileData.username || '');
		store.set('sabnzbd_password', password);
	} else {
		console.error('No profile data found for:', profileName);
	}
}

function OnProfileChanged( value )
{
	var profileName = popup.getSelection();
	
	changeActiveProfile( profileName );
}

function OnConnectionFieldEdited( fieldName, value )
{
	var profile = profiles.getActiveProfile();
	if (profile && profile.values) {
		profile.values[fieldName] = value;
		profiles.setProfile( profile );
		
		var storeFieldName = 'sabnzbd_' + fieldName;
		if (fieldName === 'api_key') storeFieldName = 'sabnzbd_api_key';
		store.set(storeFieldName, value);
	}
}

function OnProfileNameChanged( value )
{
	var profileName = profiles.getActiveProfile().name;
	var newProfileName = settings.manifest.profile_name.get();
	if( profileName != newProfileName ) {
		popup.rename( profileName, newProfileName );
		profiles.edit( profileName, getConnectionValues(), newProfileName );
		profiles.setActiveProfile( newProfileName );
	}
}

function AddProfileButtons( settings )
{
	var m = settings.manifest;
	m.profile_create.bundle.inject( m.profile_popup.bundle );
	m.profile_duplicate.bundle.inject( m.profile_popup.bundle );
	m.profile_delete.bundle.inject( m.profile_popup.bundle );
	
	m.profile_popup.container.setStyle( 'display', 'inline-block' );
	m.profile_popup.container.setStyle( 'margin-right', '10');
	m.profile_popup.element.setStyle( 'width', '150');
	m.profile_create.bundle.setStyle( 'display', 'inline-block');
	m.profile_duplicate.bundle.setStyle( 'display', 'inline-block');
	m.profile_delete.bundle.setStyle( 'display', 'inline-block');
	
	m.profile_create.addEvent( 'action', OnCreateProfileClicked );
	m.profile_duplicate.addEvent( 'action', OnDuplicateProfileClicked );
	m.profile_delete.addEvent( 'action', OnDeleteProfileClicked );
	
	m.sabnzbd_url.addEvent( 'action', function(v) { OnConnectionFieldEdited( 'url', v ) } );
	m.sabnzbd_api_key.addEvent( 'action', function(v) { OnConnectionFieldEdited( 'api_key', v ) } );
	m.sabnzbd_username.addEvent( 'action', function(v) { OnConnectionFieldEdited( 'username', v ) } );
	m.sabnzbd_password.addEvent( 'action', function(v) { OnConnectionFieldEdited( 'password', v ) } );
	
	m.profile_name.element.addEvent( 'blur', OnProfileNameChanged );
}

function InitializeSettings( settings )
{
	this.settings = settings;
	
	settings.manifest.config_reset.addEvent( 'action', OnResetConfigClicked );
	settings.manifest.test_connection.addEvent( 'action', OnTestConnectionClicked );
	settings.manifest.config_refresh_rate.addEvent( 'action', OnRefreshRateChanged );
	settings.manifest.config_enable_context_menu.addEvent( 'action', OnToggleContextMenu );
	settings.manifest.profile_popup.addEvent( 'action', OnProfileChanged );

	CreateTestConnectionStatusElement( settings );
	SetupConnectionProfiles( settings );
	AddProfileButtons( settings );
	RegisterContentScriptNotifyHandlers( settings );
}

window.onbeforeunload = function() {
	store.queueCommit();
	var profile_name = settings.manifest.profile_name.get();
	if( profiles.getActiveProfile().name !== profile_name ) {
		var msg =
			'You have made changes to the active profile\'s name, ' +
			'but it has not been saved. Click out of the "Profile Name" ' +
			'text field to save the changes. You may also leave the ' +
			'options page now to discard those changes.'
			;
			
		return msg;
	}
};