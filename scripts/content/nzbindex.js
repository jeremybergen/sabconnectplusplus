var use_nice_name_nzbindex;

function addToSABnzbdFromNzbindex() {
    var addLink = this;

    // Set the image to an in-progress image
    var img = chrome.runtime.getURL('images/content_icon_fetching.png');
    if ($(this).find('img').length > 0) {
        $(this).find('img').attr("src", img);
        var nzburl = $(this).attr('href');
        
        // Try to get category from the modern site structure
        var category = null;
        var nice_name = null;
        
        // Find the table row containing this link
        var $row = $(this).closest('tr');
        if ($row.length > 0) {
            // Look for group/category information in the row
            var groupLinks = $row.find('a[href*="groups="]');
            if (groupLinks.length > 0) {
                category = $(groupLinks[0]).text().trim();
            }
            
            // Try to get nice name from the title link
            var titleLink = $row.find('a.font-medium, a[href*="/collection/"]');
            if (titleLink.length > 0 && use_nice_name_nzbindex == '1') {
                nice_name = titleLink.text().trim();
                // Clean up the name
                if (nice_name.length > 100) {
                    nice_name = nice_name.substring(0, 100) + '...';
                }
            }
        }
        
        console.log('SABconnect++ NZBIndex: Sending to SABnzbd:', nzburl, 'category:', category, 'name:', nice_name);
        addToSABnzbd(addLink, nzburl, "addurl", nice_name, category);
    } else {
        $(this).css('background-image', 'url(' + img + ')');

        //grab all checked boxes on page for batch download
        var checkedBoxes = $('input[type="checkbox"]:checked');
        console.log('SABconnect++ NZBIndex: Found checked boxes:', checkedBoxes.length);
        
        checkedBoxes.each(function() {
            var $checkbox = $(this);
            var $row = $checkbox.closest('tr');
            if ($row.length > 0) {
                var downloadLink = $row.find('a[href*="/download/"][href$=".nzb"]');
                if (downloadLink.length > 0) {
                    var nzburl = downloadLink.attr('href');
                    
                    // Get category from group links
                    var category = null;
                    var groupLinks = $row.find('a[href*="groups="]');
                    if (groupLinks.length > 0) {
                        category = $(groupLinks[0]).text().trim();
                    }
                    
                    // Get nice name if enabled
                    var nice_name = null;
                    var titleLink = $row.find('a.font-medium, a[href*="/collection/"]');
                    if (titleLink.length > 0 && use_nice_name_nzbindex == '1') {
                        nice_name = titleLink.text().trim();
                        if (nice_name.length > 100) {
                            nice_name = nice_name.substring(0, 100) + '...';
                        }
                    }
                    
                    console.log('SABconnect++ NZBIndex: Batch sending to SABnzbd:', nzburl);
                    addToSABnzbd(addLink, nzburl, "addurl", nice_name, category);
                }
            }
        });
    }

    return false;
}

function handleAllDownloadLinks() {
    console.log('SABconnect++ NZBIndex: Running handleAllDownloadLinks...');
    
    $('input[value="Create NZB"]').each(function () {
        console.log('SABconnect++ NZBIndex: Found "Create NZB" button');
        if ($(this).attr('x-nzbpatched') !== 'true') {
            $(this).attr('x-nzbpatched', 'true');
            // add button to send checked items to SABConnect
            var img = chrome.runtime.getURL('/images/content_icon.png');
            var link = '<input class="addSABnzbd" x-nzbpatched="true" type="button" value="      Download selected" style="background-image: url(' + img + '); background-repeat: no-repeat; background-position: 3px 1px;" />';
            $(this).after(link);
            $(this).parent().find('input[class="addSABnzbd"]').first().click(addToSABnzbdFromNzbindex);
        }
    });

    // Check for both escaped and unescaped slashes in the URL
    $('table a[href*="nzbindex.nl/download/"], table a[href*="nzbindex.nl\\/download\\/"]').each(function () {
        console.log('SABconnect++ NZBIndex: Found nzbindex.nl download link:', $(this).attr('href'));
        if ($(this).attr('x-nzbpatched') !== 'true') {
            $(this).attr('x-nzbpatched', 'true');
            var img = chrome.runtime.getURL('/images/content_icon.png');
            var href = $(this).attr('href');
            var link = $('<a class="addSABnzbdOnClick" x-nzbpatched="true" href="' + href + '"><img title="Send to SABnzbd" src="' + img + '" /></a>');
            $(this).before(link);
            $(link).click(function(e) {
                e.preventDefault();
                e.stopPropagation();
                addToSABnzbdFromNzbindex.call(this);
                return false;
            });
        }
    });

    // Check for both escaped and unescaped slashes in the URL
    $('table a[href*="nzbindex.com/download/"], table a[href*="nzbindex.com\\/download\\/"]').each(function () {
        console.log('SABconnect++ NZBIndex: Found nzbindex.com download link:', $(this).attr('href'));
        if ($(this).attr('x-nzbpatched') !== 'true') {
            $(this).attr('x-nzbpatched', 'true');
            var img = chrome.runtime.getURL('/images/content_icon.png');
            var href = $(this).attr('href');
            var link = $('<a class="addSABnzbdOnClick" x-nzbpatched="true" href="' + href + '"><img title="Send to SABnzbd" src="' + img + '" /></a> ');
            $(this).before(link);
            $(link).click(function(e) {
                e.preventDefault();
                e.stopPropagation();
                addToSABnzbdFromNzbindex.call(this);
                return false;
            });
        }
    });
    
    // Also try without table restriction - modern NZBIndex uses UUID-based .nzb links
    $('a[href*="/download/"][href$=".nzb"]').each(function () {
        var href = $(this).attr('href');
        console.log('SABconnect++ NZBIndex: Found modern download link:', href);
        if ($(this).attr('x-nzbpatched') !== 'true' && !$(this).hasClass('addSABnzbdOnClick')) {
            $(this).attr('x-nzbpatched', 'true');
            var img = chrome.runtime.getURL('/images/content_icon.png');
            var link = $('<a class="addSABnzbdOnClick" x-nzbpatched="true" href="' + href + '"><img title="Send to SABnzbd" src="' + img + '" /></a> ');
            $(this).before(link);
            $(link).click(function(e) {
                e.preventDefault();
                e.stopPropagation();
                addToSABnzbdFromNzbindex.call(this);
                return false;
            });
        }
    });
}

function RefreshSettings() {
    GetSetting('use_name_nzbindex', function (value) {
        use_nice_name_nzbindex = value;
    });
}

Initialize('nzbindex', RefreshSettings, function () {
    console.log('SABconnect++ NZBIndex: Script initialized');
    
    let insertionInProgress = false;

    function DOMNodeInserted() {
        if (!insertionInProgress) {
            insertionInProgress = true;
            handleAllDownloadLinks();
            
            // Fallback: Look for any download links if no icons were added
            if ($('a.addSABnzbdOnClick').length === 0 && $('input.addSABnzbd').length === 0) {
                console.log('SABconnect++ NZBIndex: No icons added with standard selectors. Trying fallback...');
                
                // Debug: Show what links are on the page
                console.log('SABconnect++ NZBIndex: All links:', $('a').length);
                console.log('SABconnect++ NZBIndex: Links with /download/:', $('a[href*="/download/"]').length);
                console.log('SABconnect++ NZBIndex: Links with .nzb:', $('a[href*=".nzb"]').length);
                console.log('SABconnect++ NZBIndex: Links with download text:', $('a:contains("Download")').length);
                
                // Try broader selectors - modern NZBIndex uses UUID-based .nzb links
                var downloadLinks = $('a[href*="/download/"][href$=".nzb"], a[href*=".nzb"], a[href*="get?"], a[title*="Download"], a:contains("Download")');
                console.log('SABconnect++ NZBIndex: Found potential download links:', downloadLinks.length);
                
                if (downloadLinks.length > 0) {
                    console.log('SABconnect++ NZBIndex: First download link href:', downloadLinks.first().attr('href'));
                }
                
                // Modern NZBIndex uses UUID-based download links like /download/uuid.nzb
                addIconsWithFallback({
                    linkSelector: 'a[href*="/download/"][href$=".nzb"], a[href*="get?"]',
                    iconClass: 'addSABnzbdOnClick',
                    processedAttr: 'x-nzbpatched',
                    clickHandler: addToSABnzbdFromNzbindex
                });
                
                console.log('SABconnect++ NZBIndex: Total icons added:', $('a.addSABnzbdOnClick').length);
            }
            
            insertionInProgress = false;
        }
    }
    // Initial run
    DOMNodeInserted();
    
    // Use MutationObserver instead of deprecated DOMNodeInserted
    var observer = new MutationObserver(function(mutations) {
        DOMNodeInserted();
    });
    
    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Also try after page is fully loaded
    $(window).on('load', function() {
        setTimeout(function() {
            console.log('SABconnect++ NZBIndex: Checking after window load...');
            DOMNodeInserted();
        }, 500);
    });
    
    // And periodically for dynamic content
    var retryCount = 0;
    var retryInterval = setInterval(function() {
        if (retryCount++ > 10) {
            clearInterval(retryInterval);
            return;
        }
        if ($('a.addSABnzbdOnClick').length === 0) {
            console.log('SABconnect++ NZBIndex: Retry #' + retryCount);
            DOMNodeInserted();
        } else {
            clearInterval(retryInterval);
        }
    }, 1000);
});