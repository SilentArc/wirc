
	var manualTimeoutCallback = null;
	var reconnectCallback = null;
	var sentMessageTimes = [];
	for (var index = 0; index < config.sendLimitMessages; index++) sentMessageTimes.push( 0 );
	var registrationState = 0;	// 0 unregistered send CAP LS, 1 CAP LS responce send CAP REQ, 2 CAP ACK/NAK send AUTH, 3 done GLHF
	var requestedCAPs = [ 'multi-prefix', 'twitch.tv/membership' ];
	
	var irc = {
		'join': function( channelName ) {
			if ( typeof channelName === 'string' )	channelName = channelName.trim().split(' ');
			if ( channelName.length > 0 ){
				for (var index = 0; index < channelName.length; index++ ){
					if ( typeof channels[ channelName[ index ] ] === 'undefined' ) {
						irc.sendNow('JOIN ' + channelName);
					}
					else if ( $( 'div.chatArea[title="' + channelName[ index ] + '"]' ).is( ':visible' ) === false ){
						changeChatArea( channelName[ index ] );
					}
				}
			}
			else forward.active( 'No channels specified in join command!', 'error' );
		},
		'nick': function( nickname ) {
			irc.sendNow('NICK ' + nickname);
			var oldNick = config.nick;
			config.updateNick( nickname );
			for (var index = 0; index < channels.length; index++ ) {
				channels[index].user.nick( oldNick , nickname );
			}
		},
		'part': function ( channelName, reason ) {
			irc.sendNow( 'PART ' + channelName + ' :' + ( typeof reason !== 'undefined' ? reason : 'I clicked a thing!' ) );
		},
		'quit': function( message ){
			preventReconnect = true;
			clearTimeout(manualTimeoutCallback);
			if (typeof message === 'undefined') message = 'Kyaiee!';
			irc.sendNow( 'QUIT :' + message );
			socket.close();
			forward.console( '<span class="warning">You have disconnected from this server ( <a class="actionLink" data-action="reconnect" title="Cancel">Click here to reconnect</a> )</span>' );
		},
		'tapTimeout': function (){
			clearTimeout(manualTimeoutCallback);
			manualTimeoutCallback = setTimeout(function() {
				forward.notification( 'Connection timed out. Reconnecting...', 'error' );
				irc.forceReconnect();
			}, config.timeout);
		},
		'send': function( message ){	
			if ( sentMessageTimes[0] > ( Date.now() - config.sendLimitWindow ) ) forward.active( 'Client flood limiter exceeded, Message was not sent', 'warning' );
			else {
				irc.sendNow( message );
				lineHandler( message, true );
				sentMessageTimes.push( Date.now() );
				sentMessageTimes.shift();
			}
		},
		'sendNow': function( message ){
			if ( message.length > 510 ) message = message.substr( 0, 510 );	// send warning?
			socket.send( message + '\r\n' );
			irc.tapTimeout();
		},
		'forceReconnect': function(){
			socket.close();
			clearTimeout(reconnectCallback);
			reconnectCallback = null;
			socket.connect();
		},
		'login': function( newSocket ){
			if ( newSocket === true ) registrationState = 0;
			if ( registrationState === 0 ) irc.sendNow( 'CAP LS' );
			else if ( registrationState === 1 ) {
				var requests = [];
				for ( var index = 0; index < requestedCAPs.length; index++ ){
					if ( config.CAP.LS.indexOf( requestedCAPs[ index ] ) !== -1  ) requests.push( requestedCAPs[ index ] );
				}
				if ( config.CAP.LS.indexOf( 'sasl' ) !== -1 && options.token !== null ) requests.push( 'sasl' );
				else if ( options.token !== null ) irc.sendNow( 'PASS ' + options.token );
				irc.sendNow('NICK ' + config.nick );
				irc.sendNow('USER ' + config.nick + ' ' + config.nick + ' ' + config.nick +' :' + config.nick);
				if ( requests.length > 0 ){
					var requestsString = '';
					if ( requests.length == 1 ) requestsString = requests[ 0 ];
					else {
						requestsString += ':';
						requestsString += requests.join( ' ' );
					}
					irc.sendNow( 'CAP REQ ' + requestsString );
				}
			}
			else if( registrationState === 2 && config.CAP.ACK.indexOf( 'sasl' ) !== -1 && options.token !== null ) irc.sendNow( 'AUTHENTICATE PLAIN' );
			else {
				registrationState = 3;
				irc.sendNow( 'CAP END' );
			}
		},
		'topic': function( channel, newTopic ){
			if ( typeof newTopic === 'undefined' || newTopic === null || newTopic.length === 0 ) irc.send( 'TOPIC ' + channel );
			else irc.send( 'TOPIC ' + channel + ' :' + newTopic );
		},
		'privmsg': function( channel, message ){
			irc.send( 'PRIVMSG ' + channel + ' :' + message );
		},
		'action': function(target, message){
			irc.send('PRIVMSG ' + target + ' :' + String.fromCharCode(1) + "ACTION " + message + String.fromCharCode(1));
		},
		'notice': function( target, message ){
			irc.send( 'NOTICE ' + target + ' :' + message );
		}
	};

	function newRandomNick(){
		return 'Creep_' + Math.random().toString( 36 ).substring( 2, 9 );
	}