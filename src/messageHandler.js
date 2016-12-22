

	function lineHandler ( line, self ) {
		var message = parseMessage( line );
		if ( self === true ) message.self = true;
		if ( typeof commandLookup[ message.command ] === 'function') commandLookup[ message.command ]( message );
		else if ( options.debug === true ) forward.console( 'Unsupported command: ' + compose.text( message.raw ) );
	}

	var parserRegex = {
		'tags': /^@\S+\s/g,
		'tagParser': /(?:([^;=\s]+)(?:=([^;\s]+))?)/g,
		'prefix': /^(?::(\S+)\s)/g,
		'params': /^(?:([^:][^\s]*)\s?)/g
	};

	function parseMessage ( message ){
		var parsedMessage = {
			raw: message,
			tags: {},
			prefix: null,
			command: null,
			params: [],
			self: false
		}

		message = message.replace( parserRegex.tags, function( match ){
			match.slice( 1 ).replace( parserRegex.tagParser, function ( match, tag, value ){
				if ( value === undefined ) parsedMessage.tags[ tag ] = true;
				else parsedMessage.tags[ tag ] = value.replace( /\\:/g, ';' ).replace( /\\s:/g, ' ' ).replace( /\\/g, '\\' );
				return '';
			});
			return '';
		});
		message = message.replace( parserRegex.prefix, function ( match, prefix ){
			parsedMessage.prefix = prefix;
			return '';
		});
		var lastParam = false;
		while ( lastParam === false && message.length > 0 ){
			lastParam = true;
			message = message.replace( parserRegex.params, function ( match, param ){
				if ( parsedMessage.command === null ) parsedMessage.command = param;
				else parsedMessage.params.push( param );
				lastParam = false;
				return '';
			});
		}
		if ( message.length > 0 ) parsedMessage.params.push( message.slice( 1 ) );

		return parsedMessage;
	}

	var forward = {
		'channel': function( target, message, type ){
			if ( channels[target] !== undefined ) channels[target].line( message, type );
			else {
				newChannel( target, false, false);
				channels[target].line( message, type );
			}
		},
		//'all': function( message ){	// this is not used, remove?
		//	for ( var index in channels ) channels[ index ].line( message );
		//},
		'console': function( message, type ){
			channels[ ':Console' ].line( message, type );
		},
		'active': function( message, type ){
			var active = $( 'div.chatArea:visible' ).attr( 'title' );
			if ( active !== undefined ) forward.channel( active, message, type );
			else forward.console( message, type );
		},
		'notification': function( message, type ){
			var active = $( 'div.chatArea:visible' ).attr( 'title' );
			if ( active !== undefined && active.charAt( 0 ) !== ':' ) forward.channel( active, message, type );
			forward.console( message, type );
		},
		'ignore': function ( message ){
			if ( options.ignoreConsole === true ) forward.console( message );
		},
		'alias': {
			'consoleText': function( message ){
				forward.console( compose.text( message.params[ 1 ] ) );
			},
			'consoleTrim' : function( message ){
				forward.console( compose.text( message.params.slice( 1 ).join( ' ' ) ) );
			},
			'active': function( message ){
				forward.active( compose.html( message.params[ 1 ] ) );
			},
			'activeTwoParams' : function( message ){
				forward.active( compose.html( message.params[ 1 ] + ' ' + message.params[ 2 ] ) );
			},
			'activeWarning' : function( message ){	
				forward.active( compose.html( message.params[ 1 ] ), 'warning' );
			},
			'activeError' : function( message ){
				forward.active( compose.html( message.params[ 2 ] ), 'error' );
			}
		}
	}

	var commandLookup = {
		'PING': function( message ){
			irc.sendNow( 'PONG ' + message.params[ 0 ] );
			if ( options.pings === true ) forward.console( compose.html( 'Received ping (' + message.raw + '), replied pong (PONG ' + message.params[ 0 ] + ')' ) );
		},
		'CAP': function( message ){
			if ( message.self === false ){
				if ( message.params[ 1 ] === 'LS' ) {
					if ( typeof config.CAP === 'undefined' ) config.CAP = {};
					if ( message.params[ 2 ] === '*' ) {
						if ( config.CAP.multilineLS === false ) config.CAP.LS = message.params[ 3 ];
						else config.CAP.LS += ' ' + message.params[ 3 ];
						config.CAP.multilineLS = true;
						forward.active( 'Server capabilities: ' + message.params[ 3 ] );
					}
					else {
						if ( config.CAP.multilineLS === true ) config.CAP.LS += ' ' + message.params[ 2 ];
						else config.CAP.LS = message.params[ 2 ];
						config.CAP.multilineLS = false;
						if ( registrationState === 0 ) {
							registrationState = 1;
							irc.login();
						}
						forward.active( 'Server capabilities: ' + message.params[ 2 ] );
					}
				}
				else if ( message.params[ 1 ] === 'ACK' ){
					if ( options.debug ) forward.console( 'CAP negotiation accepted: ' + message.params[ 2 ] );
					config.CAP.ACK = message.params[ 2 ];
					if ( registrationState === 1 ) {
						registrationState = 2;
						irc.login();
					}
				}
				else if ( message.params[ 1 ] === 'NAK' ){
					if ( options.debug ) forward.console( 'CAP negotiation rejected: ' + message.params[ 2 ] );
					if ( typeof config.CAP.ACK === 'undefined' ) config.CAP.ACK = '';
					if ( registrationState === 1 ) {
						registrationState = 2;
						irc.login();
					}
				}
				else if ( message.params[ 1 ] === 'LIST' ){
					forward.active( 'Currently enabled capabilities: ' + message.params[ 2 ] );
				}
				else {
					forward.console( 'Unrecognised CAP command: ' + message.params.slice( 1 ).join( ' ' ) );
				}
			}
		},
		'AUTHENTICATE': function( message ){	// for SASL
			if ( registrationState === 2 && options.token !== null && message.params[ 0 ] === '+' )	irc.sendNow( 'AUTHENTICATE ' + options.token );
			registrationState = 3;
			irc.login();
		},
		'JOIN': function( message ){
			if ( message.prefix.split('!')[ 0 ] === config.nick ) {
				newChannel( message.params[ 0 ], true );
				if ( options.saveChannels === true && options.channels.indexOf( message.params[ 0 ] ) === -1 ){
					options.channels.push( message.params[ 0 ] );
					saveOptions();
				}
			}
			else channels[ message.params[ 0 ] ].user.join( message.prefix.split('!')[0]);
		},
		'PRIVMSG': function( message ){
			var source = ( message.self === true ? config.nick : message.prefix.split( '!' )[ 0 ] );
			if ( message.params[ 1 ].charCodeAt( 0 ) === 1 ){
				if ( message.params[ 1 ].indexOf( '\u0001ACTION' ) === 0 ) forward.channel( message.params[ 0 ], '<span class="action">' + compose.text( '* ' + source + message.params[ 1 ].slice( 7, -1 ) ) + '</span>', ( message.self === true ? 'self' : void( 0 ) ) );
				else if ( message.params[ 1 ] === '\u0001VERSION\u0001' ) irc.notice( ( message.params[ 0 ] === config.nick ? source : message.params[ 0 ] ) , String.fromCharCode( 1 ) + 'VERSION ' + 'pre alpha build' + String.fromCharCode( 1 ) );
				else if ( message.params[ 1 ] === '\u0001TIME\u0001' ) irc.notice( ( message.params[ 0 ] === config.nick ? source : message.params[ 0 ] ) , String.fromCharCode(1) + 'TIME ' + new Date().toLocaleString() + String.fromCharCode(1) );
				//else if ( message.params[ 1 ] === '\u0001AVATAR\u0001' ) forward.console( 'CTCP AVATAR request from ' + source + ' ignored' );	// just say no to avatars in irc
				else if ( message.params[ 1 ] === '\u0001SOURCE\u0001' ) irc.notice( ( message.params[ 0 ] === config.nick ? source : message.params[ 0 ] ) , String.fromCharCode( 1 ) + 'SOURCE ' + 'https://github.com/SilentArc/wirc' + String.fromCharCode( 1 ) );
				else if ( message.params[ 1 ] === '\u0001FINGER\u0001' ) irc.notice( ( message.params[ 0 ] === config.nick ? source : message.params[ 0 ] ) , String.fromCharCode( 1 ) + 'FINGER ' + 'kinky' + String.fromCharCode( 1 ) );
				//else if ( message.params[ 1 ] === '\u0001CLIENTINFO\u0001' ) irc.notice( ( message.params[ 0 ] === config.nick ? source : message.params[ 0 ] ) , String.fromCharCode( 1 ) + 'CLIENTINFO ' + 'something something ctcp list?' + String.fromCharCode( 1 ) );
				//else if ( message.params[ 1 ] === '\u0001USERINFO\u0001' ) // technically unless we give the user a way to set this it shouldn't return anything	// give it a setting in options?
				else if ( message.params[ 1 ].split( ' ' )[ 0 ] === '\u0001PING' ) irc.notice( ( message.params[ 0 ] === config.nick ? source : message.params[ 0 ] ) , message.params[ 1 ] );
				else if ( options.debug === true ) forward.console( 'CTCP ' + message.params[ 1 ].slice( 1, -1 ) + ' request from ' + source + ' unsupported and ignored' );
			}
			else if ( ignoreList.onList( source ) === true ) {
				forward.ignore( 'Ignored message to "' + message.params[ 0 ] + '": <span class="spacer">&lt;</span><span class="messageNick" data-action="nick" title="'+ source +'">' +  compose.text( source ) + '</span><span class="spacer">&gt;</span> ' + compose.text( message.params[ 1 ] ) );			
			}
			else if ( message.params[ 0 ] === config.nick ){	// private messages
				forward.channel( source, '<span class="spacer">&lt;</span><span class="messageNick" data-action="nick" title="' + source + '">' +  compose.text( source ) + '</span><span class="spacer">&gt;</span> ' + compose.text( message.params[ 1 ] ) );
			}
			else {	// channel messages	
				forward.channel( message.params[ 0 ], '<span class="spacer">&lt;</span><span class="messageNick" data-action="nick" title="'+ source +'">' +  compose.text( source ) + '</span><span class="spacer">&gt;</span> ' + compose.text( message.params[ 1 ] ), ( source === config.nick ? 'self' : '' ) );
			}
		},
		'NOTICE': function( message ){
			var source = ( message.self === true ? config.nick : message.prefix.split( '!' )[ 0 ] );
			if ( message.params[ 1 ].charCodeAt( 0 ) === 1 ) {
				if ( options.debug === true ) forward.console( compose.text( '*' + source + '* ' + message.params[ 1 ] ), 'notice' );
			}
			else if ( source === config.nick ) forward.active( compose.text( '*NOTICE to ' + message.params[ 0 ] + '* ' + message.params[ 1 ] ), 'notice' );
			else forward.active( compose.text( '*' + source + '* ' + message.params[ 1 ] ), 'notice' );
		},
		'MODE': function( message ){
			// a proper mode parser needs to be built here and a series of individual/related mode changes be passed
			if ( message.params[ 0 ] === config.nick) forward.active( compose.html( 'You have set mode: ' + message.params[ 1 ] ) );
			else {
				var consumingModes = ['O','o','v','k','l','b','e','I'];	// this should be outside? maybe the entire parser should be?

				if ( options.modes === true ) channels[ message.params[ 0 ] ].line( '<span class="nick">' + compose.html( ( message.prefix === null ? config.nick : message.prefix.split( '!' )[ 0 ] ) + ' has set mode: ' + message.params.slice( 1 ).join( ' ' ) ) + '</span>');
				
				var modeArray = message.params.slice( 1 );
				while ( modeArray.length > 0 ){
					if ( modeArray[0].charCodeAt( 0 ) === 43 ) { //+
						var modes = modeArray.shift().slice( 1 );
						while ( modes.length > 0 ){
							var mode = modes.charAt( 0 );
							modes = modes.slice( 1 );
							if ( typeof config.modeMap[ mode ] === 'string' ){
								var target = modeArray.shift();
								channels[ message.params[ 0 ] ].user.modeAdd( mode, target );
							}
							else if ( typeof consumingModes[ mode ] === 'string' ) modeArray.shift();	// I guess I should do something with this
						}
					}
					else if ( modeArray[0].charCodeAt( 0 ) === 45 ) { //-
						var modes = modeArray.shift().slice( 1 );
						while ( modes.length > 0 ){
							var mode = modes.charAt( 0 );
							modes = modes.slice( 1 );
							if ( typeof config.modeMap[ mode ] === 'string' ){
								var target = modeArray.shift();
								channels[ message.params[ 0 ] ].user.modeSub( mode, target );
							}
							else if ( typeof consumingModes[ mode ] === 'string' ) modeArray.shift();
						}
					}
					else break;
				}

			}
		},
		'NICK': function( message ){
			var oldNick = message.prefix.split( '!' )[ 0 ];
			
			if ( oldNick === config.nick ) {
				config.updateNick( message.params[ 0 ] );
				forward.console( '<span class="nick">' + compose.html( oldNick + ' is now known as ' + message.params[ 0 ] ) + '</span>' );
			}

			if ( options.ignoreFollow === true && ignoreList.onList( oldNick ) === true )ignoreList.add( message.params[ 0 ] );
			if ( options.ignoreAbandon === true && ignoreList.onList( oldNick ) === true ) ignoreList.remove( oldNick );

			for ( var index in channels ) {
				if ( index !== ':Console' ) channels[ index ].user.nick( oldNick , message.params[ 0 ] );
			}
		},
		'PART': function( message ){
			if ( message.prefix.split( '!' )[ 0 ] === config.nick ) {
				channels[  message.params[ 0 ] ].close( 'You have left channel ' +  message.params[ 0 ] + ( typeof message.params[ 1 ] === 'undefined' ? '': ': ' +  message.params[ 1 ] ) );
				
				if ( options.saveChannels === true && options.channels.indexOf( message.params[ 0 ] ) !== -1 ){
					options.channels.splice( options.channels.indexOf( message.params[ 0 ] ), 1 );
					saveOptions();
				}
			}
			else channels[ message.params[ 0 ] ].user.part( message.prefix.split( '!' )[ 0 ] , message.params[ 1 ] );
		},
		'QUIT': function( message ){
			var quitter = message.prefix.split('!')[0];
			var note = message.params[ 0 ];
			for ( var index in channels ) if ( index !== ':Console' ) channels[ index ].user.quit( quitter , note );
		},
		'KICK': function( message ){
			if ( message.params[ 1 ] === config.nick ){
				channels[ message.params[ 0 ] ].close( 'You have been kicked from channel ' + message.params[ 0 ] + ': ' + message.params[ 2 ] );

				if ( options.saveChannels === true && options.channels.indexOf( message.params[ 0 ] ) !== -1 ){
					options.channels.splice( options.channels.indexOf( message.params[ 0 ] ), 1 );
					saveOptions();
				}
			}
			else channels[ message.params[ 0 ] ].user.kick( message.params[ 1 ] , message.params[ 2 ] );	
		},
		'TOPIC': function( message ){
			if ( message.self === false )forward.channel( message.params[ 0 ], '<span class="info">' + compose.text( message.prefix.split('!')[0] + ' has changed the topic for ' +  message.params[ 0 ] + ' to "' + message.params[ 1 ] + '"' ) + '</span>' );
		},
		'ERROR': function( message ){
			forward.console( compose.text( message.raw ) );
		},
		'001': forward.alias.consoleText,	// RPL_WELCOME
		'002': forward.alias.consoleText,	// RPL_YOURHOST
		'003': forward.alias.consoleText,	// RPL_CREATED
		'004': function( message ){	// RPL_MYINFO
			if ( message.params.length > 2 ) forward.console( compose.text( 'Server ' + message.params[ 1 ] + ' version ' + message.params[ 2 ] + ' supporting user modes "' + message.params[ 3 ] + '" and channel modes "' + message.params[ 4 ] +'"' ) );
			else forward.console( compose.text( message.params[ 1 ] ) );
		},
		'005': function( message ){	// RPL_BOUNCE or RPL_ISUPPORT
			forward.console( 'This server supports: ' + compose.text( message.params.slice( 1 ).join( ' ' ) ) );
			
			if (typeof config.ISUPPORT === 'undefined') config.ISUPPORT = {};
			for (var index = 1; index < message.params.length; index++){
				if ( message.params[ index ].indexOf( '=' ) === -1) config.ISUPPORT[ message.params[index] ] = true;
				else config.ISUPPORT[ message.params[ index ].split( '=' )[ 0 ] ] = message.params[ index ].split( '=' )[ 1 ];
			}

			// update config.modeMap/modeSymbols/modeSymbolRegex over default
			config.modeSymbols = config.ISUPPORT.PREFIX.split( ')' )[ 1 ].split( '' );
			config.modeSymbolRegex = new RegExp( '[' + config.ISUPPORT.PREFIX.split( ')' )[ 1 ] + ']', 'g' );
			var modeLetters = config.ISUPPORT.PREFIX.split( ')' )[ 0 ].split( '(' )[ 1 ].split( '' );
			config.modeMap = {};
			for ( var index = 0; index < modeLetters.length && index < config.modeSymbols.length; index++ ){
				config.modeMap[ modeLetters[ index ] ] = config.modeSymbols[ index ];
			}
		},
		'251': forward.alias.consoleText,	// RPL_LUSERCLIENT
		'252': forward.alias.consoleTrim,	// RPL_LUSEROP
		'253': forward.alias.consoleTrim,	// RPL_LUSERUNKNOWN
		'254': forward.alias.consoleTrim,	// RPL_LUSERCHANNELS
		'255': forward.alias.consoleText,	// RPL_LUSERME
		'265': forward.alias.consoleText,	// RPL_LOCALUSERS
		'266': forward.alias.consoleText,	// RPL_GLOBALUSERS
		'315': function( message ){	// RPL_ENDOFWHO
			forward.active( compose.text( message.params[ 1 ] + ' :' + message.params[ 2 ] ) );
		},
		'324': function( message ){	// RPL_CHANNELMODEIS
			channels[ message.params[ 1 ] ].modes( message.raw );	// I thnk this is wrong
		},
		'331': function( message ){	// RPL_NOTOPIC
			forward.channel( message.params[ 1 ], '<span class="info">Topic for ' + compose.text( message.params[ 1 ] + ' is: ' + message.params[ 2 ] ) + '</span>');
		},
		'332': function( message ){	// RPL_TOPIC
			forward.channel( message.params[ 1 ], '<span class="info">Topic for ' + compose.text( message.params[ 1 ] + ' is: ' + message.params[ 2 ] ) + '</span>');
		},
		'333': function( message ){	// RPL_TOPICWHOTIME
			forward.channel( message.params[ 1 ], '<span class="info">Topic set by ' + compose.text( message.params[ 2 ].split( '!' )[ 0 ] + ' on ' + new Date( message.params[ 3 ] * 1000).toString() ) + '</span>' );
		},
		'352': function( message ){	// RPL_WHOREPLY
			forward.active( compose.text( message.params.slice( 1 ).join( ' ' ) ) );
		},
		'353': function( message ){	// RPL_NAMREPLY
			channels[ message.params[ 2 ] ].user.handle353( message.params[ 3 ].split( ' ' ) );
		},
		'366': function( message ){	// RPL_ENDOFNAMES
			channels[ message.params[ 1 ] ].user.handle366();
		},
		'372': forward.alias.consoleText,	// RPL_MOTD
		'375': function( message ){	// RPL_MOTDSTART
			forward.console( compose.html( message.params[ 1 ] ) );
		},
		'376': function( message ){	// RPL_ENDOFMOTD
			forward.console( compose.html( message.params[ 1 ] ) );
			if ( typeof options.channels === 'object' ){
				for ( var index = 0; index < options.channels.length; index++ ){
					irc.join( options.channels[ index ] );
				}
			}
		},
		'403': function( message ){	// ERR_NOSUCHCHANNEL 
			forward.active( compose.html( message.params.join( ' ' ) ) );
		},
		'421': function( message ){	// ERR_UNKNOWNCOMMAND
			forward.active( compose.html( message.params[ 1 ] + ' :' + message.params.slice( 2 ).join( ' ' ) ) );
		},
		'432': function( message ){	// ERR_ERRONEUSNICKNAME
			forward.active( compose.html( message.params.slice( 1 ).join( ' ' ) ), 'error' );
			if ( message.params[ 0 ] === '*' ) irc.nick( newRandomNick() );
			else {
				config.updateNick( message.params[ 0 ] );
				for ( var index in channels ) {
					channels[ index ].user.nick( message.params[ 1 ] , config.nick );
				}
			}
		},
		'433': function( message ){	// ERR_NICKNAMEINUSE
			forward.active( compose.html( message.params.slice( 1 ).join( ' ' ) ), 'error' );
			if ( message.params[ 0 ] === '*' ) irc.nick( newRandomNick() );
			else {
				config.updateNick( message.params[ 0 ] );
				for ( var index in channels ) {
					channels[index].user.nick( message.params[ 1 ] , config.nick );
				}
			}
		},
		'461': forward.alias.activeTwoParams,	// ERR_NEEDMOREPARAMS
		'482': forward.alias.activeTwoParams,	// ERR_CHANOPRIVSNEEDED
		'900': function( message ){	// RPL_LOGGEDIN
			forward.active( compose.html( 'SASL: ' + message.params[ 3 ] ) );
		},
		'901': function( message ){	// RPL_LOGGEDOUT
			forward.active( compose.html( 'SASL: ' + message.params[ 2 ] ), 'warning' );
		},
		'902': function( message ){	// ERR_NICKLOCKED
			forward.active( compose.html( 'SASL: ' + message.params[ 1 ] ), 'error' );
		},
		'903': forward.alias.active,	// RPL_SASLSUCCESS
		'904': forward.alias.activeWarning,	// ERR_SASLFAIL
		'905': forward.alias.activeWarning,	// ERR_SASLTOOLONG
		'906': forward.alias.activeWarning,	// ERR_SASLABORTED
		'907': forward.alias.activeWarning,	// ERR_SASLALREADY
		'908': forward.alias.activeWarning,	// RPL_SASLMECHS
		'926': forward.alias.activeError	// Channel forbidden
	}
	
	function newChannel(channelName,sidebars,type){
		if (typeof channels[channelName] === 'undefined'){
			channels[channelName] = new channel(channelName,sidebars,type);
		}
		else if ($('div.chatArea[title="'+channelName+'"]').is(":visible") === false) {
			deselectChatArea();
			selectChatArea(channelName);
		}
	}

	function inputHandler( context, line ) {
		if ( line.charCodeAt( 0 ) === 47 ) {	// forward slash
			var message = {
				channel: context,
				raw: line,
				command: null,
				params: null
			};
			message.command = line.split(' ').shift().toLowerCase().slice( 1 );
			if ( line.search( ' ' ) !== -1 ) message.params = line.substring( line.search( ' ' ) + 1 );
			
			if ( typeof inputLookup[ message.command ] === 'function') inputLookup[ message.command ]( message );
			else irc.send( message.raw.slice( 1 ) );
		}
		else irc.privmsg( context, line );
	}

	var inputLookup= {
		'me': function( message ){
			irc.action( message.channel, message.params );
		},
		'nick': function( message ){
			irc.nick( message.params.split(' ')[0] );
		},
		'join': function( message ){
			irc.join( message.params );
		},
		'notice': function( message ){
			irc.notice( message.params.split( ' ' )[ 0 ], message.params.split( ' ' ).slice( 1 ).join( ' ' ) );
		},
		'say': function( message ){
			irc.privmsg( message.params.split( ' ' )[ 0 ], message.params.split( ' ' ).slice( 1 ).join( ' ' ) );
		},
		'privmsg': function( message ){
			irc.privmsg( message.params.split( ' ' )[ 0 ], message.params.split( ' ' ).slice( 1 ).join( ' ' ) );
		},
		'part': function( message ){
			if ( message.params === null && message.channel !== ':Console' ) irc.part( message.channel );
			else irc.part( message.params.split( ' ' )[ 0 ], message.params.split( ' ' ).slice( 1 ).join( ' ' ) );
		},
		'quit': function( message ){
			irc.quit( message.params );
		},
		'mode': function( message ){
			irc.send( 'MODE ' + message.params );
		},
		'ignore': function( message ){
			ignoreList.add( message.params);
		},
		'unignore': function( message ){
			ignoreList.remove( message.params );
		},
		'topic': function( message ){
			irc.topic( message.channel, message.params );
		}
	}