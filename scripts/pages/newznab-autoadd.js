(function () { // Encapsulate

    /*
        New indexes are frequently requested in sabconnectplusplus
        of which the majority are supported as they are Newznab.
        Lets add support to automatically notify the user their
        popular indexer is supported, as well as add it to the
        config automatically if requested.
    */

    var newznabDetection = function(){
        // Lets try and wrap all detection functions to a simplistic block
        var runFound = false;

        // most sites detect here
        if ( ($('[name=RSSTOKEN]').filter(':first').length) &&
            ($('input.nzb_multi_operations_cart').filter(':first').length) )
        { return true; }

        // some additionals
        $('#browsetable tr:gt(0)').filter(':first').each(function() {
            if ( $(this).find('td.item label').filter(':first').length )
                runFound = true;
        });
        if ( runFound )
            return true;

        // If all else fails, we are not sab ;)
        return false;
    }

    // Lets restrict our movements to pages that are newznab, logged in and displaying triggerable data
    if ( newznabDetection() ) {
        var thishost = (window.location.hostname.match(/([^.]+)\.\w{2,3}(?:\.\w{2})?$/) || [])[0];
        $('body').prepend(
           $('<div>').addClass('notification autonabSticky hide').prepend(
                $('<p>SABconnect++ says: Would you like to enable one-click "Send to SAB" buttons on this site? </p>').append(
                    ' <a href="javascript:" id="autonabEnable">Enable</a> | <a href="javascript:" id="autonabIgnore">Ignore</a>'
                ),
                $('<a class="close" href="javascript:">×</a>')
            )
        );
        $('.notification.autonabSticky').notify();
        $('#autonabIgnore').click(function(){
            var request = {
                action: 'set_setting',
                setting: 'nabignore.' + thishost,
                value: true
            };
            chrome.runtime.sendMessage( request );
            $('a.close').click();
        });
        $('#autonabEnable').click(function(){
            var request = {
                action: 'get_setting',
                setting: 'provider_newznab'
            };
            chrome.runtime.sendMessage( request, function( response ) {
                var request = {
                    action: 'set_setting',
                    setting: 'provider_newznab',
                    value: response.value + ', ' + thishost
                };
                chrome.runtime.sendMessage( request, function() {
                    location.reload();
                });
            });
        });
    }
})();
