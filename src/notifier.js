
	var notifier = {
		'allowNotifications': false,
		'enable': function(){
			if ( typeof window.Notification === 'function' ) {
				if ( Notification.permission === 'granted' ) notifier.allowNotifications = true;
				else if ( Notification.permission !== 'denied' ) {
					Notification.requestPermission( function ( permission ) {
						if ( permission === 'granted' ) notifier.allowNotifications = true;
					});
				}
			}
		},
		'disable': function(){
			notifier.allowNotifications = false;
		},
		'pop': function( title, text ){
			if ( notifier.allowNotifications === true && document.hasFocus() === false ) new Notification( title, { 'body': text } );
		}
	}