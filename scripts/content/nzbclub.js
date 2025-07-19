function addToSABnzbdFromNZBCLUB() {
    // Set the image to an in-progress image
    var img = chrome.runtime.getURL('images/content_icon_fetching.png');
    $(this).find('img').first().attr("src", img);

    var nzburl = $(this).attr('href');
    var addLink = $(this).parent();

    addToSABnzbd(addLink, nzburl, "addurl");

    return false;
}

function handleAllDownloadLinks() {
	$('div.project-action > div > button[id="get"]').each(function() {
	    var img = chrome.runtime.getURL('/images/content_icon.png');
	    var href = "/nzb_get/" + $(this).parent().parent().attr('collectionid');
	    var link = '<a class="addSABnzbd" href="' + href + '"><img style="margin-top: auto; width: 14px; height: 14px; border-radius: 0%; margin-bottom: auto;" title="Send to SABnzbd" src="' + img + '" /></a>';
	    $(this).after(link);
		$(this).parent().find('a[class="addSABnzbd"]').first().click(addToSABnzbdFromNZBCLUB);
	});
	return;
}

Initialize( 'nzbclub', null, function() {
	console.log('SABconnect++ NZBClub: Script initialized');
	handleAllDownloadLinks();
	
	// Fallback if no icons were added
	if ($('a.addSABnzbd').length === 0) {
		console.log('SABconnect++ NZBClub: No icons added, trying fallback...');
		addIconsWithFallback({
			linkSelector: 'a[href*="/nzb_get.aspx"], a[href*="/nzb/"]',
			iconClass: 'addSABnzbd',
			clickHandler: addToSABnzbdFromNZBCLUB
		});
	}
});