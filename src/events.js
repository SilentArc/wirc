

	var eventHandler = {
		'channel': function ( name ) {
			irc.join( name );
		},
		'reconnect': function () {
			if (ws.readyState === 3) irc.forceReconnect();
			else forward.active('Unable to reconnect when socket is not in closed state');
		},
		'cancelConnect': function () {
			clearTimeout( reconnectCallback );
			if ( reconnectCallback !== null && ws.readyState === 3 ) forward.active('Connection cancelled, have a nice day');
			reconnectCallback = null;
		}
	}

	$('#chatBox').on('click','a.actionLink', function ( event ){
		event.preventDefault();
		eventHandler[ $( this ).attr( 'data-action' ) ]( $( this ).attr( 'data-message' ) );
	});
	
	$('#chatBox').on('click','span.messageNick, div.userlist', function ( event ){
		event.preventDefault();
		var self = this;
		if ( $( '#dropdownMenu' ).is( ":visible" ) === false ) {
			$('div.chatArea:visible').append('<div id="dropdownMenu"></div>');
			$('#dropdownMenu').css({
				"left": Math.floor( $( this ).position().left ),
				"top": Math.floor( $( this ).position().top + $( this ).outerHeight() )
			});
			$('#dropdownMenu').on('mouseleave', function(){
				$( this ).remove();
			});
			$('#dropdownMenu').append('<div id="openDialog">Open Dialog</div>');
			$('#openDialog').on('click', function (){
				newChannel( $( self ).attr( 'title' ) , false );
			});
			if ( ignoreList.onList( $( this ).attr( 'title' ) ) === true  ) {
				$('#dropdownMenu').append('<div id="unignore">Unignore</div>');
				$('#unignore').on('click', function (){
					ignoreList.remove( $( self ).attr( 'title' ) );
				});
			}
			else {
				$('#dropdownMenu').append('<div id="ignore">Ignore</div>');
				$('#ignore').on('click', function (){
					ignoreList.add( $( self ).attr( 'title' ) );
				});
			}
		}
		else $('#dropdownMenu').remove();
	});
	