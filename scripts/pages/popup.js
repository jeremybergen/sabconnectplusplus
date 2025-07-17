var profiles = null;
var oldPos = -1; 

function activeProfile() {
	if (!profiles) {
		console.error('ProfileManager not initialized');
		return null;
	}
	var profile = profiles.getActiveProfile();
	return profile ? profile.values : null;
}

window.activeProfile = activeProfile;

if (window.sabconnectStore) {
	var store = window.sabconnectStore;
	if (store.isReady) {
		storeReady_popup();
	} else {
		store.readyCallbacks.push(storeReady_popup);
	}
} else {
	var store = new StoreClass('settings', {}, undefined, storeReady_popup);
	window.sabconnectStore = store;
}

function getPref(name) {
    return store.get(name);
}

function setPref(name, value) {
    return store.set(name, value);
}

window.getPref = getPref;
window.setPref = setPref;

function storeReady_popup() {
	setTimeout(function() {
		profiles = new ProfileManager();
		
		var existingProfiles = store.get('profiles');
		if (!existingProfiles || typeof existingProfiles !== 'object' || Object.keys(existingProfiles).length === 0) {
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
		}
		
		if (!store.get('active_profile')) {
			var firstProfile = Object.keys(store.get('profiles') || {})[0];
			if (firstProfile) {
				store.set('active_profile', firstProfile);
			}
		}
		
		initializePopup();
	}, 100);
}

$(document).ready(function() {
});

function initializeSortable() {
	if (typeof $.fn.sortable === 'undefined') {
		console.error('jQuery UI sortable not available!');
		return;
	}
	
	try {
		$("ul#sab-queue").sortable({ 
			axis: 'y',
			scroll: true,
			scrollSensitivity: 20,
			scrollSpeed: 20,
			handle: '.filename',
			placeholder: 'ui-sortable-placeholder',
			helper: 'clone',
			opacity: 0.8,
			cursorAt: { top: 20, left: 100 },
			appendTo: 'body',
			start: function(event, ui) {
				ui.helper.css({
					'transform': 'none',
					'z-index': '9999'
				});
			},
			stop: function(event, ui) {
			}
		});
		
		
	} catch (error) {
		console.error('Error initializing sortable:', error);
		return;
	}
	
	$('ul#sab-queue').on('sortstart', function(event, ui) {
		chrome.storage.local.set({ skip_redraw: 1 });
		var id = $(ui.item).attr('id');
		oldPos = getSortItemPos(id);
	});
	
	$('ul#sab-queue').on('sortstop', function(event, ui) {
		chrome.storage.local.set({ skip_redraw: 0 });
		var id = $(ui.item).attr('id');
		var pos = getSortItemPos(id);
		if(pos == oldPos) {
			return;
		}
		moveQueueItem(id, pos);
	});
}

function initializePopup() {
	$('#queue_toggle_dropdown').show().css('display', 'flex');
	$('#queue_toggle_container').removeClass('dropdown-hidden');
	
	setTimeout(function() {
		refresh();
	}, 200);
	
	chrome.storage.local.get(['popupFirstOpened'], function(result) {
		if (!result.popupFirstOpened) {
			var iconElement = document.getElementById('addon-icon');
			if (iconElement) {
				iconElement.classList.add('rotate-animation');
				setTimeout(function() {
					iconElement.classList.remove('rotate-animation');
				}, 1000);
			}
			chrome.storage.local.set({ popupFirstOpened: true });
		}
	});
	
	chrome.storage.local.get(['lastOpened'], function(result) {
		var nowtime = new Date();
		var lastOpened = parseInt(result.lastOpened || 0);
		var closeWindow = false;
		if (lastOpened > 0) {
			if (nowtime.getTime() - lastOpened < 700) { 
				var profile = null;
				try {
					profile = activeProfile();
				} catch (e) {
					console.error('activeProfile error:', e);
					return;
				}
				if (profile && profile.url) {
					chrome.tabs.create({url: profile.url});
					closeWindow = true;
					window.close();
				}
			}
		}
		if (!closeWindow) {
			chrome.storage.local.set({ lastOpened: nowtime.getTime() });
			reDrawPopup();
			setTimeout(function() {
				initializeSortable();
			}, 500);
		}
	});

	$('#open_sabnzbd, #open_sabnzbd_btn').click( function() {
		
		var profileFunc = activeProfile || window.activeProfile;
		
		if (typeof profileFunc !== 'function') {
			alert('Profiles system not ready. Please wait a moment and try again.');
			return;
		}
		
		if (!profiles) {
			alert('Profiles not initialized. Please wait a moment and try again.');
			return;
		}
		
		var profile = activeProfile();
		
		if (!profile || !profile.url) {
			alert('No active profile configured. Please check your settings.');
			return;
		}
		var url = $.url.parse( profile.url );
		
		var build = {
			protocol: url.protocol,
			host: url.host,
			port: url.port,
			path: url.path,
		}
		
		if( store.get( 'config_enable_automatic_authentication' ) ) {
			build.user = $.url.encode(profile.username);
			build.password = $.url.encode(profile.password);
		}
		
		chrome.tabs.create( { url: $.url.build( build ) } );
	});

	$('#extension_settings, #extension_settings_btn').click( function() {
		chrome.tabs.create({url: 'settings.html'});
	});

	$('#refresh, #refresh_btn').click( function() {
		refresh();
	});

	$('#queue_toggle_btn').click( function() {
		toggleQueue();
	});
	
	$('#queue_toggle_dropdown').click( function(e) {
		e.stopPropagation();
		togglePauseDropdown();
	});
	
	$(document).on('click', '.dropdown-item', function() {
		var duration = parseInt($(this).data('duration'));
		togglePause(duration);
		hidePauseDropdown();
	});
	
	$(document).on('click', function(e) {
		if (!$(e.target).closest('#queue_toggle_container').length) {
			hidePauseDropdown();
		}
	});

	$('#set-speed').click( function() {
		setMaxSpeed( $('#speed-input').val() );
	});
	
	$('#speed-slider').on('input', function() {
		var value = $(this).val();
		$('#speed-input').val(value);
	});
	
	$('#speed-input').on('input', function() {
		var value = $(this).val();
		if (value !== '') {
			value = Math.max(0, Math.min(100, parseInt(value) || 0));
			$(this).val(value);
			$('#speed-slider').val(value);
		}
	});
	
	$('#speed-slider').on('change', function() {
		setMaxSpeed($(this).val());
	});
	
	$('.keyboard-help-trigger').click(function() {
		showKeyboardHelp();
	});
	
	
	$('#schedule-toggle').click(function() {
		var isEnabled = $(this).text() === 'Disable';
		toggleSchedule(!isEnabled);
	});
	
	$('#pause-time, #resume-time').change(function() {
		updateScheduleSettings();
		$(this).blur(); 
	});
	
	$('.day-checkbox input').change(function() {
		updateScheduleSettings();
		$(this).blur(); 
	});
	
	loadScheduleState();

	$('#speed-input').keydown( function( event ) {
		var code = event.keyCode || event.which;
		if( code == 13 ) { 
			setMaxSpeed( $('#speed-input').val() );
		}
	});

	if (!profiles) {
		console.error('Profiles manager not initialized');
		return;
	}
	
	populateProfileList();

	var currentActiveProfile = profiles.getActiveProfile();
	if (currentActiveProfile && currentActiveProfile.name) {
		if (!$('#profiles').is(':focus')) {
			$('#profiles').val( currentActiveProfile.name );
		}
	} else {
		console.warn('No active profile found, trying to set first available');
		var availableProfiles = store.get('profiles');
		if (availableProfiles && Object.keys(availableProfiles).length > 0) {
			var firstProfileName = Object.keys(availableProfiles)[0];
			store.set('active_profile', firstProfileName);
			if (!$('#profiles').is(':focus')) {
				$('#profiles').val(firstProfileName);
			}
		}
	}
	$('#profiles').change( OnProfileChanged );

	if (store.get('config_use_user_categories')) {
		$('#user_category').css("display", "block");
		populateAndSetCategoryList();
	}

	setMaxSpeedText();
	
	updateStatistics();
	
	updateHistory();
	
	if (store.get('config_enable_graph') == '1') {
		if (typeof Chart !== 'undefined') {
			initSpeedChart();
		} else {
		}
	}
}

function refresh()
{
	try {
		chrome.runtime.sendMessage({ action: 'refresh' }, function(response) {
			if (chrome.runtime.lastError) {
				console.error('Refresh message error:', chrome.runtime.lastError.message);
			}
		});
	} catch (error) {
		console.error('Failed to send refresh message:', error);
	}
}

function setMaxSpeedText()
{
	if ($('#speed-input').is(':focus')) {
		return;
	}
	
	getMaxSpeed( function( data ) {
		var speedValue = '';
		if (data) {
			if (data.queue && data.queue.speedlimit !== undefined) {
				speedValue = data.queue.speedlimit;
				updateDiskSpaceInfo(data.queue);
			} else if (data.speedlimit !== undefined) {
				speedValue = data.speedlimit;
			} else if (data.config && data.config.speedlimit !== undefined) {
				speedValue = data.config.speedlimit;
			} else if (data.value !== undefined) {
				speedValue = data.value;
			} else {
				}
		}
		if (!$('#speed-input').is(':focus')) {
			$('#speed-input').val( speedValue );
			$('#speed-slider').val( speedValue );
		}
	});
}

function updateDiskSpaceInfo(queueData) {
	if (queueData) {
		var availableSpace = queueData.diskspace1_norm ? queueData.diskspace1_norm.replace(' ', '') : (queueData.diskspace1 ? queueData.diskspace1 + 'G' : '-G');
		var totalSpace = queueData.diskspacetotal1 ? queueData.diskspacetotal1 + 'G' : '-G';
		
		var speedLimitMBs = '-MB/s';
		if (queueData.speedlimit_abs) {
			var bytesPerSec = parseInt(queueData.speedlimit_abs);
			var megabytesPerSec = (bytesPerSec / (1024 * 1024)).toFixed(1);
			speedLimitMBs = megabytesPerSec + 'MB/s';
		}
		
			
		$('#disk-available').text(availableSpace);
		$('#disk-total').text(totalSpace);
		$('#speed-limit-abs').text(speedLimitMBs);
	}
}

function setMaxSpeed( speed )
{
	chrome.runtime.sendMessage({ 
		action: 'setMaxSpeed', 
		speed: speed 
	}, function(response) {
		if (response && response.success) {
			setMaxSpeedText();
		} else {
			console.error('setMaxSpeed failed:', response);
			alert( 'Failed to set max speed.' );
		}
	});
}

function getMaxSpeed( success_callback )
{
	try {
		chrome.runtime.sendMessage({ action: 'getMaxSpeed' }, function(response) {
			if (chrome.runtime.lastError) {
				console.error('GetMaxSpeed message error:', chrome.runtime.lastError.message);
				return;
			}
			if (response && response.success && success_callback) {
				success_callback(response.data);
			} else if (response && !response.success) {
				console.error('getMaxSpeed failed:', response.error);
			}
		});
	} catch (error) {
		console.error('Failed to send getMaxSpeed message:', error);
	}
}

function moveQueueItem(nzoid, pos)
{
	var sabApiUrl = constructApiUrl();
	var data = constructApiPost();
	data.mode = 'switch';
	data.value = nzoid;
	data.value2 = pos;

	var url = new URL(sabApiUrl);
	Object.keys(data).forEach(key => url.searchParams.append(key, data[key]));
	
	var profile = null;
	try {
		profile = activeProfile();
	} catch (e) {
		console.error('activeProfile error:', e);
		return;
	}
	var headers = {};
	if (profile.username && profile.password) {
		headers['Authorization'] = 'Basic ' + btoa(profile.username + ':' + profile.password);
	}
	
	fetch(url, {
		method: 'POST',
		headers: headers
	})
	.then(response => {
		if (!response.ok) throw new Error('Network response was not ok');
		return response.json();
	})
	.then(data => { refresh(); })
	.catch(error => {
		$('#error').html('Failed to move item, please check your connection to SABnzbd');
	});
}

function queueItemAction(action, nzoid, callback)
{
	var sabApiUrl = constructApiUrl();
	var data = constructApiPost();
	data.mode = 'queue';
	data.name = action;
	data.value = nzoid;	

	var url = new URL(sabApiUrl);
	Object.keys(data).forEach(key => url.searchParams.append(key, data[key]));
	
	var profile = null;
	try {
		profile = activeProfile();
	} catch (e) {
		console.error('activeProfile error:', e);
		return;
	}
	var headers = {};
	if (profile.username && profile.password) {
		headers['Authorization'] = 'Basic ' + btoa(profile.username + ':' + profile.password);
	}
	
	fetch(url, {
		method: 'POST',
		headers: headers
	})
	.then(response => {
		if (!response.ok) throw new Error('Network response was not ok');
		return response.json();
	})
	.then(data => { refresh(); })
	.catch(error => {
		$('#error').html('Failed to move item, please check your connection to SABnzbd');
	});
}


var paused = false;
var oldPos = -1;

function durationPause(e) {
	var val = parseInt($(this).val());
	if(isNaN(val)) {
		val = parseInt(window.prompt("Duration (minutes)"));
	}
	if(val > 0) {
		togglePause(val);
	} else {
		$(this).val(0);
	}
}

function togglePause(duration) {	
	if (paused) {
		var mode = 'resume';
		var wasPaused = true;
	} else {
		var mode = 'pause';
		var wasPaused = false;
	}
	
	var sabApiUrl = constructApiUrl();
	var data = constructApiPost();
	
	data.mode = mode;
	if(mode == "pause" && typeof duration == "number") {
		data.mode = "config";
		data.name = "set_pause";
		data.value = duration;
	}
	
	var url = new URL(sabApiUrl);
	Object.keys(data).forEach(key => url.searchParams.append(key, data[key]));
	
	var profile = null;
	try {
		profile = activeProfile();
	} catch (e) {
		console.error('activeProfile error:', e);
		return;
	}
	var headers = {};
	if (profile.username && profile.password) {
		headers['Authorization'] = 'Basic ' + btoa(profile.username + ':' + profile.password);
	}
	
	fetch(url, {
		method: 'GET',
		headers: headers
	})
	.then(response => {
		if (!response.ok) throw new Error('Network response was not ok');
		return response.json();
	})
	.then(data => {
		if (wasPaused) {
			var msg = 'Pause Queue';
		} else {
			var msg = 'Resume Queue';
		}
		$('#togglePause').replaceWith(buildPauseDiv(msg, !wasPaused));
		
		refresh();
	})
	.catch(error => {
		$('#togglePause').html('failed - try again');
	});	
}

function SetupTogglePause() {
	chrome.storage.local.get(['paused'], function(result) {
		paused = result.paused === true;

	if (paused) {
		var playImg = chrome.runtime.getURL('images/control_play.png');
		var img = '<img src="' + playImg +'" />';
		var msg = 'Resume Queue';
	} else {
		var pauseImg = chrome.runtime.getURL('images/control_pause.png');
		var img = '<img src="' + pauseImg +'" />';
		var msg = 'Pause Queue';
	}
	
	$(".menu").prepend("<hr>", buildPauseDiv(msg));
	
	$(".menu").on("click", "select", function(e) { 
		e.stopPropagation(); 
	});
	
	$(document).on("wheel", function(e) {
		return true;
	});
	});
}

function buildPauseDiv(msg, overridePaused) {
	var pauseState = overridePaused;
	if(typeof pauseState == "undefined") {
		pauseState = paused;
	}
	var $div = $("<div id='togglePause'><span style='float:none;'>"+ msg +" </span></div");
	
	if(!pauseState) {
		var selectDuration = $("<select id='pause-duration'></select>");
		var durations = {
			0:		"&#8734;",
			5:		"5 minutes",
			15:		"15 minutes",
			30:		"30 minutes",
			60: 	"1 hour",
			180:	"3 hours",
			360:	"6 hours",
			NaN:	"Other..."
		}
		for(var minutes in durations) {
			var intMinutes = parseInt(minutes);
			selectDuration.append($("<option value='"+ intMinutes +"'>"+durations[minutes]+"</option>"));
		}
		
		$div.append(selectDuration);
	}
	
	return $div;
}

function getSortItemPos(id) {
	var list = $('ul#sab-queue').sortable('toArray');
	var pos = -1;
	
	$.each(list, function(i, item) {
		if(item == id) {
			pos = i;
		}
	});
	
	return pos;
}

function reDrawPopup() {
	chrome.storage.local.get(['skip_redraw', 'error', 'paused', 'status', 'timeleft', 'speed', 'sizeleft', 'paused_jobs', 'pause_int', 'queue', 'queue_info', 'speedlog'], function(result) {
		if(result.skip_redraw == '1') return;
		
		var shouldSkipQueueRedraw = false;
		
		if (shouldSkipQueueRedraw) {
		}

		var error = result.error;
		if(error) {
			$('#sab-errors').html('<div id="errors-container">' + error + '</div>');
		} else {
			$('#sab-errors').html('');
		}

		paused = result.paused === true;

		var fields = ['status', 'paused', 'timeleft', 'speed', 'sizeleft', 'paused_jobs'];
		
		$.each(fields, function(i, field) {
			var value = result[field];
			$('#sab-' + field).html(value);
		});
		
		var status = result.status;
		$('#sab-status').removeClass().addClass(status);
		
		
		var hasQueueItems = false;
		var hasQueueData = false;
		if (result.queue) {
			try {
				var queueItems = JSON.parse(result.queue);
				hasQueueItems = queueItems && queueItems.length > 0;
				hasQueueData = true;
			} catch(e) {
				hasQueueData = false;
			}
		}
		
		updateQueueToggleButton(status, paused, hasQueueItems, hasQueueData);

		if (!shouldSkipQueueRedraw) {
			$('ul#sab-queue').html('');
		
		if(paused) {
			var remaining = result.pause_int;
			if(remaining == 0) { 
				$("#sab-timeleft").html("&#8734;");
			} else {
				$("#sab-timeleft").html(remaining);
			}
		}
	
		var data = {
			'playImg':chrome.runtime.getURL('images/play.svg'),
			'pauseImg':chrome.runtime.getURL('images/pause-item.svg'),
			'deleteImg':chrome.runtime.getURL('images/delete-item.svg')
		};
		
		var queue = result.queue;
		var jobs = [];
		if(typeof queue != "undefined" && queue)
			jobs = JSON.parse(queue);
	$.each(jobs, function(i, slot) {
	    var infoItems = [];
	    
	    if (slot.cat && slot.cat !== '*') {
	        infoItems.push(slot.cat);
	    }
	    
	    if (slot.size) {
	        infoItems.push(slot.size);
	    } else if (slot.mb) {
	        infoItems.push(fileSizes(parseFloat(slot.mb) * 1048576));
	    }
	    
	    if (slot.avg_age) {
	        infoItems.push(slot.avg_age + ' old');
	    }
	    
	    var infoLine = infoItems.length > 0 ? infoItems.join(' • ') : '';
	    
		var el = '<li id="' + slot.nzo_id + '" class="item">'
		    + '<div class="file-' + slot.status + ' filename" title="' + slot.filename + '">' + slot.filename + '</div>';
		    
		if (infoLine) {
		    el += '<div class="queue-info">' + infoLine + '</div>';
		}
		    
		el += '<div class="controls">';
		if ( slot.status == "Paused" ) {
		    el += '<a class="resumeItem lowOpacity" href=""><img src="' + data.playImg + '" /></a>';
	    } else {
		    el += '<a class="pauseItem lowOpacity" href=""><img src="' + data.pauseImg + '" /></a>';
	    }
	    el += '<a class="deleteItem lowOpacity" href=""><img src="' + data.deleteImg + '" /></a>';
	    
	    el += '</div>'
        	+ '<div class="float-fix"></div>';
        if (slot.percentage != "0") {
            var percentage = parseFloat(slot.percentage);
            var progressText = percentage.toFixed(1) + '%';
            
            var sizeInfo = '';
            if (slot.mb && slot.mbleft) {
                var totalMB = parseFloat(slot.mb);
                var leftMB = parseFloat(slot.mbleft);
                var downloadedMB = totalMB - leftMB;
                sizeInfo = ' • ' + fileSizes(downloadedMB * 1048576) + ' / ' + fileSizes(totalMB * 1048576);
            }
            
            var etaInfo = '';
            if (slot.timeleft && slot.timeleft !== '0:00:00') {
                etaInfo = ' • ETA: ' + slot.timeleft;
            }
            
            el += '<div class="progressBarContainer">'
                + '<div class="progressBarInner" style="width:' + slot.percentage + '%"></div>'
                + '<div class="progressBarText">' + progressText + sizeInfo + etaInfo + '</div>'
                + '</div>';
        }
        el += '</li>';

		$(el).appendTo($('#sab-queue'));
	});
	
	
	$(".item").hover(
		function () {
			$(this).find('.lowOpacity').addClass('fullOpacity').removeClass('lowOpacity');
		}, 
		function () {
			$(this).find('.fullOpacity').addClass('lowOpacity').removeClass('fullOpacity');
		}
	);
	/*
	$(".filename").hover(
		function () {
			$(this).closest('li').addClass('highlight')
		}, 
		function () {
			$(this).closest('li').removeClass('highlight')
		}
	);   */ 
	$(".item").hover(
		function () {
			$(this).addClass('highlight');
		}, 
		function () {
			$(this).removeClass('highlight');
		}
	);
	
	
	$('.resumeItem').click(function() {
		var id = $(this).closest('li.item').attr('id');
		queueItemAction('resume', id, reDrawPopup);
		
		return false;
	});
	
	$('.pauseItem').click(function() {
		var id = $(this).closest('li.item').attr('id');
		queueItemAction('pause', id, reDrawPopup);
		
		return false;
	});	
	
	$('.deleteItem').click(function() {
		var li = $(this).closest('li.item');
		var id = li.attr('id');
		li.remove();
		queueItemAction('delete', id, reDrawPopup);
		
		return false;
	});
	
	
	
		} 
		
		if( store.get( 'config_enable_graph' ) == '1' ) {
			var speedlog = result.speedlog;
			var line1 = [0];
			if(typeof speedlog != "undefined" && speedlog) {
				line1 = JSON.parse(speedlog);
			}
			updateSpeedChart(line1, status);
		} else {
		    $('#graph-container').hide();
		}
		
		setMaxSpeedText();
		
		var queueInfo = result.queue_info;
		if (queueInfo) {
			try {
				var queueData = JSON.parse(queueInfo);
				updateDiskSpaceInfo(queueData);
			} catch (e) {
				console.error('Error parsing queue_info:', e);
			}
		}
		
		updateStatistics();
		
		updateHistory();
		
		updateScheduleStatus();
	});
}


function fileSizes(value, decimals) {
    if(decimals == null) decimals = 2;
    var kb = value / 1024;
    var mb = value / 1048576;
    var gb = value / 1073741824;
    var tb = value / 1099511627776; 
    
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

function safeUpdateValue(selector, value) {
    var $element = $(selector);
    if ($element.length > 0 && !$element.is(':focus')) {
        if ($element.is('input[type="checkbox"]')) {
            $element.prop('checked', value);
        } else {
            $element.val(value);
        }
        return true; 
    }
    return false; 
}

function OnProfileChanged( event )
{
	var profileName = event.target.value;
	profiles.setActiveProfile( profileName );
	
	$(event.target).blur();
	
	chrome.runtime.sendMessage({ 
		action: 'profileChanged', 
		profileName: profileName 
	});
	
	setMaxSpeedText();
	refresh();
}

function populateProfileList()
{
	var profiles = store.get( 'profiles' );
	for( var p in profiles ) {
		$('#profiles').append(
            $('<option>').attr({
    			value: p,
    			text: p
    		}).html(p)
		);
	}
}

function OnCategoryChanged(event)
{
    var categoryName = event.target.value;
    store.set('active_category', categoryName);
    
    $(event.target).blur();

    setMaxSpeedText();
    refresh();
}

function populateAndSetCategoryList()
{
    var params = {
        action: 'get_categories'
    }
    chrome.runtime.sendMessage(params, function(data) {
        for (i = 0; i < data.categories.length; i++) {
            var cat = '<option value="' + data.categories[i] + '">' + data.categories[i] + '</option>';
            $('#userCategory').append(cat);
        }
        if (!$('#userCategory').is(':focus')) {
            $('#userCategory').val(store.get('active_category'));
        }
        $('#userCategory').change(OnCategoryChanged);
    });
}

function updateStatistics() {
	var periods = ['today', 'month', 'all_time'];
	
	periods.forEach(function(period) {
		chrome.runtime.sendMessage({ 
			action: 'getStatistics', 
			period: period 
		}, function(response) {
			if (response && response.success) {
				var stats = response.statistics;
				
				var totalSize = '-';
				if (stats.total_size !== undefined) {
					totalSize = fileSizes(stats.total_size);
				} else if (stats.total_size_bytes !== undefined) {
					totalSize = fileSizes(stats.total_size_bytes);
				}
				
				var elementId = '';
				switch(period) {
					case 'today':
						elementId = '#stats-today';
						break;
					case 'month':
						elementId = '#stats-month';
						break;
					case 'all_time':
						elementId = '#stats-total';
						break;
				}
				
				if (elementId) {
					$(elementId).text(totalSize);
				}
			}
		});
	});
}

function updateHistory() {
	if ($('#history-limit').is(':focus')) {
		return;
	}
	
	if (!$('#history-content').is(':visible')) {
		return;
	}
	
	var limit = $('#history-limit').val() || 10;
	
	chrome.runtime.sendMessage({ 
		action: 'getHistory', 
		limit: parseInt(limit)
	}, function(response) {
		var historyContent = $('#history-content');
		
		if (response && response.success && response.history) {
			
			var slots = [];
			if (response.history.history && response.history.history.slots) {
				slots = response.history.history.slots;
			} else if (response.history.slots) {
				slots = response.history.slots;
			}
			
			
			if (slots.length === 0) {
				historyContent.html('<div class="history-empty">No recent downloads found</div>');
				return;
			}
			
			var html = '';
			slots.forEach(function(item) {
				var statusClass = item.status === 'Completed' ? 'history-status-completed' : 'history-status-failed';
				var completedTime = new Date(item.completed * 1000);
				var timeAgo = getTimeAgo(completedTime);
				var size = item.bytes ? fileSizes(parseFloat(item.bytes)) : 'Unknown size';
				
				var displayName = item.name || item.nzb_name || 'Unknown';
				if (displayName.length > 50) {
					displayName = displayName.substring(0, 47) + '...';
				}
				
				html += '<div class="history-item">' +
					'<div class="history-item-header">' +
						'<div class="history-item-name" title="' + item.name + '">' + displayName + '</div>' +
						'<div class="history-item-status ' + statusClass + '">' + item.status + '</div>' +
					'</div>' +
					'<div class="history-item-details">' +
						'<div class="history-item-size">' + size + '</div>' +
						'<div class="history-item-time">' + timeAgo + '</div>' +
					'</div>' +
				'</div>';
			});
			
			historyContent.html(html);
		} else {
			historyContent.html('<div class="history-empty">Unable to load history</div>');
		}
	});
}

$('#history-limit').change(function() {
	updateHistory();
	$(this).blur(); 
});

function toggleHistorySection() {
	var content = $('#history-content');
	var dropdown = $('#history-limit');
	var button = $('#history-toggle');
	var icon = button.find('img');
	
	if (content.is(':visible')) {
		content.hide();
		dropdown.addClass('history-hidden');
		icon.attr('src', 'images/chevron-down.svg');
		icon.attr('alt', 'Show');
	} else {
		content.show();
		dropdown.removeClass('history-hidden');
		icon.attr('src', 'images/chevron-up.svg');
		icon.attr('alt', 'Hide');
		updateHistory(); 
	}
	
	button.blur(); 
}

$('#history-toggle').click(toggleHistorySection);

$('.history-header-row .info-label').click(toggleHistorySection);

$('#shutdown_btn').click(function() {
	if (confirm('Are you sure you want to shutdown SABnzbd?')) {
		chrome.runtime.sendMessage({ 
			action: 'shutdownSAB' 
		}, function(response) {
			if (response && response.success) {
			} else {
				alert('Failed to shutdown SABnzbd: ' + (response ? response.error : 'Unknown error'));
			}
		});
	}
});

$('#restart_btn').click(function() {
	if (confirm('Are you sure you want to restart SABnzbd?')) {
		chrome.runtime.sendMessage({ 
			action: 'restartSAB' 
		}, function(response) {
			if (response && response.success) {
			} else {
				alert('Failed to restart SABnzbd: ' + (response ? response.error : 'Unknown error'));
			}
		});
	}
});

function getTimeAgo(date) {
	var now = new Date();
	var diffMs = now - date;
	var diffMinutes = Math.floor(diffMs / 60000);
	var diffHours = Math.floor(diffMs / 3600000);
	var diffDays = Math.floor(diffMs / 86400000);
	
	if (diffMinutes < 1) {
		return 'Just now';
	} else if (diffMinutes < 60) {
		return diffMinutes + 'm ago';
	} else if (diffHours < 24) {
		return diffHours + 'h ago';
	} else if (diffDays < 7) {
		return diffDays + 'd ago';
	} else {
		return date.toLocaleDateString();
	}
}

var speedChart = null;
var chartType = 'spline'; 

function initSpeedChart() {
	
	if (speedChart) {
		speedChart.destroy();
	}
	
	var ctx = document.getElementById('speed-chart');
	if (!ctx) {
		return;
	}
	
	
	var computedStyle = getComputedStyle(document.documentElement);
	var accentGreen = computedStyle.getPropertyValue('--accent-green').trim() || '#00b894';
	var accentGreenLight = computedStyle.getPropertyValue('--accent-green-light').trim() || '#00cec9';
	var textSecondary = computedStyle.getPropertyValue('--text-secondary').trim() || '#636e72';
	var borderColor = computedStyle.getPropertyValue('--border-color').trim() || '#e1e8ed';
	
	
	var tension, borderWidth, pointRadius;
	switch(chartType) {
		case 'line':
			tension = 0.1;
			borderWidth = 2;
			pointRadius = 2;
			break;
		case 'spline':
			tension = 0.6;
			borderWidth = 3;
			pointRadius = 0;
			break;
		case 'smooth':
			tension = 0.8;
			borderWidth = 4;
			pointRadius = 0;
			break;
		default:
			tension = 0.6;
			borderWidth = 3;
			pointRadius = 0;
	}
	
	try {
		speedChart = new Chart(ctx, {
		type: 'line',
		data: {
			labels: ['', '', '', '', '', '', '', '', '', ''],
			datasets: [{
				label: 'Speed',
				data: [0],
				borderColor: accentGreen,
				backgroundColor: accentGreen + '30',
				fill: true,
				tension: tension, 
				pointRadius: 0,
				pointHoverRadius: 0,
				pointHoverBackgroundColor: 'transparent',
				pointHoverBorderColor: 'transparent',
				pointHoverBorderWidth: 0,
				borderWidth: borderWidth,
				cubicInterpolationMode: 'monotone', 
				borderCapStyle: 'round',
				borderJoinStyle: 'round'
			}]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			animation: {
				duration: 750,
				easing: 'easeInOutCubic', 
				animateRotate: true,
				animateScale: true
			},
			plugins: {
				legend: {
					display: false
				},
				tooltip: {
					enabled: false
				}
			},
			scales: {
				x: {
					display: false
				},
				y: {
					display: false,
					beginAtZero: true
				}
			},
			elements: {
				point: {
					radius: 0,
					hoverRadius: 0,
					hitRadius: 0,
					borderWidth: 0,
					hoverBorderWidth: 0
				}
			}
		}
	});
	
	
	} catch (error) {
		updateSpeedChartFallback(null, null);
	}
}

function updateSpeedChart(speedData, status) {
	if (typeof Chart === 'undefined') {
		updateSpeedChartFallback(speedData, status);
		return;
	}
	
	if (!speedChart) {
		initSpeedChart();
	}
	
	if (!speedChart) {
		updateSpeedChartFallback(speedData, status);
		return;
	}
	
	if (!speedData) {
		return;
	}
	
	var formattedData = speedData.map(function(speed) {
		return parseFloat(speed) || 0;
	});
	
	
	if (formattedData.every(function(speed) { return speed === 0; }) || status === 'Idle') {
		$('#graph-container').hide();
		return;
	}
	
	$('#graph-container').show();
	
	speedChart.data.datasets[0].data = formattedData;
	
	var maxSpeed = Math.max(...formattedData);
	if (maxSpeed > 0) {
		speedChart.options.scales.y.max = maxSpeed * 1.1; 
	}
	
	
	speedChart.update('active');
	
}

function formatSpeedValue(kbPerSec) {
	if (kbPerSec >= 1024) {
		return (kbPerSec / 1024).toFixed(1) + ' MB';
	} else {
		return kbPerSec.toFixed(0) + ' KB';
	}
}

function formatSpeedValueMbit(kbitPerSec) {
	var mbitPerSec = kbitPerSec / 1024.0;
	
	if (mbitPerSec >= 1024) {
		return (mbitPerSec / 1024).toFixed(1) + ' Gbit/s';
	} else if (mbitPerSec >= 1) {
		return mbitPerSec.toFixed(1) + ' Mbit/s';
	} else {
		return kbitPerSec.toFixed(0) + ' kbit/s';
	}
}

function updateSpeedDisplay(speedText) {
	$('#graph-container .speed-display').remove();
	
	var speedDisplay = '<div class="speed-display">' + speedText + '</div>';
	$('#graph-container').append(speedDisplay);
}

function toggleQueue() {
	chrome.storage.local.get(['paused'], function(result) {
		var isPaused = result.paused === true;
		var action = isPaused ? 'resume' : 'pause';
		
		chrome.runtime.sendMessage({ 
			action: 'toggleQueue', 
			mode: action 
		}, function(response) {
			if (response && response.success) {
				setTimeout(refresh, 100);
			}
		});
	});
}

function togglePauseDropdown() {
	var $menu = $('#pause_duration_menu');
	if ($menu.is(':visible')) {
		hidePauseDropdown();
	} else {
		showPauseDropdown();
	}
}

function showPauseDropdown() {
	$('#pause_duration_menu').show();
	$('#queue_toggle_container').addClass('show-dropdown');
}

function hidePauseDropdown() {
	$('#pause_duration_menu').hide();
	$('#queue_toggle_container').removeClass('show-dropdown');
}

function updateQueueToggleButton(status, isPaused, hasQueueItems, hasQueueData) {
	
	var $btn = $('#queue_toggle_btn');
	var $img = $btn.find('img');
	var $dropdown = $('#queue_toggle_dropdown');
	var $container = $('#queue_toggle_container');
	
	$btn.removeClass('paused downloading idle');
	
	if (isPaused === true) {
		$img.attr('src', 'images/play.svg');
		$img.attr('alt', 'Resume Queue');
		$btn.attr('title', 'Resume Queue (Space)');
		$btn.addClass('paused');
		$dropdown.hide();
		$container.addClass('dropdown-hidden');
		hidePauseDropdown();
	} else {
		$img.attr('src', 'images/pause.svg');
		$img.attr('alt', 'Pause Queue');
		$btn.attr('title', 'Pause Queue (Space)');
		$btn.addClass('downloading');
		$dropdown.show();
		$dropdown.css('display', 'flex'); 
		$container.removeClass('dropdown-hidden');
	}
}

function updateSpeedChartFallback(speedData, status) {
	if (typeof Chart !== 'undefined') {
		return;
	}
	
	if (!speedData) return;
	
	var formattedData = speedData.map(function(speed) {
		return parseFloat(speed) || 0;
	});
	
	if (formattedData.every(function(speed) { return speed === 0; }) || status === 'Idle') {
		$('#graph-container').hide();
		return;
	}
	
	$('#graph-container').show();
	
	var maxSpeed = Math.max(...formattedData);
	if (maxSpeed === 0) maxSpeed = 1; 
	
	var html = '<div class="fallback-chart spline-chart">';
	formattedData.forEach(function(speed, index) {
		var height = (speed / maxSpeed) * 100;
		var prevHeight = index > 0 ? (formattedData[index - 1] / maxSpeed) * 100 : height;
		var nextHeight = index < formattedData.length - 1 ? (formattedData[index + 1] / maxSpeed) * 100 : height;
		
		var curveClass = '';
		if (height > prevHeight && height > nextHeight) curveClass = 'peak';
		else if (height < prevHeight && height < nextHeight) curveClass = 'valley';
		else if (height > prevHeight) curveClass = 'rising';
		else if (height < prevHeight) curveClass = 'falling';
		
		html += '<div class="chart-bar ' + curveClass + '" style="height: ' + height + '%; --prev-height: ' + prevHeight + '%; --next-height: ' + nextHeight + '%;"></div>';
	});
	html += '</div>';
	
	$('#graph-container').html(html);
}


function loadScheduleState() {
	chrome.runtime.sendMessage({ action: 'getSchedule' }, function(response) {
		if (response && response.success) {
			var schedule = response.schedule;
			
			if (!$('#pause-time').is(':focus')) {
				$('#pause-time').val(schedule.pause_time);
			}
			if (!$('#resume-time').is(':focus')) {
				$('#resume-time').val(schedule.resume_time);
			}
			
			var anyDayCheckboxFocused = $('.day-checkbox input:focus').length > 0;
			if (!anyDayCheckboxFocused) {
				$('.day-checkbox input').each(function() {
					var dayValue = parseInt($(this).val());
					$(this).prop('checked', schedule.days.includes(dayValue));
				});
			}
			
			if (schedule.enabled) {
				$('#schedule-toggle').text('Disable');
				$('#schedule-content').show();
			} else {
				$('#schedule-toggle').text('Enable');
				$('#schedule-content').hide();
			}
			
			updateScheduleStatus();
		}
	});
}

function toggleSchedule(enable) {
	chrome.runtime.sendMessage({ 
		action: 'updateSchedule',
		schedule: { enabled: enable }
	}, function(response) {
		if (response && response.success) {
			if (enable) {
				$('#schedule-toggle').text('Disable');
				$('#schedule-content').show();
			} else {
				$('#schedule-toggle').text('Enable');
				$('#schedule-content').hide();
			}
			updateScheduleStatus();
		}
	});
}

function updateScheduleSettings() {
	var selectedDays = [];
	$('.day-checkbox input:checked').each(function() {
		selectedDays.push(parseInt($(this).val()));
	});
	
	var scheduleData = {
		pause_time: $('#pause-time').val(),
		resume_time: $('#resume-time').val(),
		days: selectedDays
	};
	
	chrome.runtime.sendMessage({ 
		action: 'updateSchedule',
		schedule: scheduleData
	}, function(response) {
		if (response && response.success) {
			updateScheduleStatus();
		}
	});
}

function updateScheduleStatus() {
	chrome.runtime.sendMessage({ action: 'getScheduleStatus' }, function(response) {
		if (response && response.success) {
			var status = response.status;
			var $statusElement = $('#schedule-status-text');
			var $statusContainer = $('.schedule-status');
			
			$statusElement.text(status.message);
			
			$statusContainer.removeClass('active warning');
			if (status.status === 'active') {
				$statusContainer.addClass('active');
			} else if (status.status === 'warning') {
				$statusContainer.addClass('warning');
			}
		}
	});
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	if (request.action === 'refresh_popup') {
		reDrawPopup();
	} else if (request.action === 'settings_changed') {
		location.reload();
	}
});

$(document).keydown(function(e) {
	if ($(e.target).is('input, select, textarea')) {
		return;
	}
	
	switch(e.key.toLowerCase()) {
		case ' ':
			e.preventDefault();
			toggleQueue();
			break;
			
		case 'r':
			e.preventDefault();
			refresh();
			break;
			
		case 'p':
			e.preventDefault();
			if (e.shiftKey) {
				togglePause();
			} else {
				var firstItem = $('.resumeItem, .pauseItem').first();
				if (firstItem.length > 0) {
					firstItem.click();
				}
			}
			break;
			
		case 'o':
			e.preventDefault();
			$('#open_sabnzbd_btn').click();
			break;
			
		case 's':
			e.preventDefault();
			$('#speed-input').focus().select();
			break;
			
		case 'escape':
			e.preventDefault();
			window.close();
			break;
			
		case 'd':
			e.preventDefault();
			var firstDeleteButton = $('.deleteItem').first();
			if (firstDeleteButton.length > 0 && confirm('Delete first download?')) {
				firstDeleteButton.click();
			}
			break;
			
		case 'h':
			e.preventDefault();
			$('#history-limit').focus();
			break;
			
		case 'b':
			e.preventDefault();
			var checkedBoxes = $('.queue-checkbox:checked');
			if (checkedBoxes.length > 0) {
				$('.queue-checkbox').prop('checked', false);
			} else {
				$('.queue-checkbox').prop('checked', true);
			}
			updateBatchControls();
			break;
			
		case '?':
			e.preventDefault();
			showKeyboardHelp();
			break;
	}
	
});

function showKeyboardHelp() {
	var helpText = 'Keyboard Shortcuts:\n\n' +
		'R - Refresh queue\n' +
		'P - Pause/Resume first item\n' +
		'Shift+P - Pause/Resume all\n' +
		'O - Open SABnzbd\n' +
		'S - Focus speed input\n' +
		'H - Focus history selector\n' +
		'D - Delete first item\n' +
		'ESC - Close popup\n' +
		'? - Show this help';
	
	alert(helpText);
}
