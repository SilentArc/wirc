	$( document ).ready( function() {
		if ( options.highlightNotify === true ) notifier.enable();
		socket.connect();
	});

	$( window ).unload(function() {
		irc.quit('Browser closed');
	});
	
	window.onbeforeunload = function() {
		return "Navigating away from this page will disconnect you from the chat. Please don't leave us";
	}

}());
