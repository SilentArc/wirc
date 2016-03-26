/*! wirc - v0.0.522 - 2016-03-26 */

(function(){
	var address = $( document.currentScript ).attr( 'data-addr' );
	var options = {
		'pings': false,
		'joins': true,
		'modes': true,
		'history': 50,
		'alternating': true,
		'snap': true,
		'timestamp': true,
		'part': false,
		'console': true,
		'ircstyles': true,
		'debug': false,
		'images': 'none',
		'ignoreConsole': true,
		'ignoreFollow': true,
		'ignoreAbandon': false,
		'highlight': true,
		'saveNick': true,
		'saveChannels': true,
		'nick': null,
		'channels': [],
		'token': null
	}

	var optionKey = ( window.location.search === '' ? 'Default' : window.location.search );
	var storedOptions = localStorage.getItem( 'options' + optionKey );
	if ( typeof storedOptions === 'string' ) {
		try {
			var optionsHolder = JSON.parse( storedOptions );
			var optionsKeys = Object.keys( options );
			for ( var index = 0; index < optionsKeys.length; index++ ){
				if ( typeof options[ optionsKeys[ index ] ] !== 'undefined' && typeof optionsHolder[ optionsKeys[ index ] ] !== 'undefined' ) options[ optionsKeys[ index ] ] = optionsHolder[ optionsKeys[ index ] ];
			}
		} catch( e ){
			console.log( 'Failed to load options: ' + e );
			localStorage.setItem( 'options' + optionKey , JSON.stringify( options ) );
		}
	}

	if ( options.nick === null ) options.nick = newRandomNick();
	
	var config = {
		'nick': options.nick,
		'nickRegex': new RegExp( '\\b' + options.nick + '\\b' ,'g' ),
		'updateNick': function( newNick ){
			config.nick = newNick;
			config.nickRegex = new RegExp( '\\b' + newNick + '\\b' ,'g' );
			if ( options.saveNick === true ) {
				options.nick = config.nick;
				saveOptions();
			}
		},
		'timeout': 360000,
		'reconnectDelay': 20000,
		'sendLimitMessages': 10,
		'sendLimitWindow': 5000,
		'modeMap': { 'q':'~', 'a':'&', 'o':'@', 'h':'%', 'v':'+' },
		'modeSymbols': [ '~', '&', '@', '%', '+' ],
		'modeSymbolRegex': new RegExp( '[~&@%+]', 'g' )
	}
	
	$( '<link/>', {
		rel: 'stylesheet',
		type: 'text/css',
		href: 'wirc.css'
	}).appendTo( 'head' );
	
	var ignoreList = new function () {
		var list = [];
		
		var storedIgnores = localStorage.getItem( 'ignores' + optionKey );
		if ( typeof storedIgnores === 'string'){
			try {
				list = JSON.parse( storedIgnores );
			} catch(e){
				console.log( 'Failed to load ignores: ' + e );
				localStorage.setItem( 'ignores' + optionKey , JSON.stringify( list ) );
			}
		}
		
		var saveIgnores = function (){
			if ( list.length > 0 ) localStorage.setItem( 'ignores' + optionKey , JSON.stringify( list ) );
			else localStorage.removeItem( 'ignores' + optionKey );
			optionUI.redrawIgnoreList();
		}
		
		this.getList = function () {
			return list;
		}
		this.onList = function( name ){
			if ( list.indexOf( name ) !== -1 ) return true;
			else return false;
		}
		this.add = function( name ){
			if ( list.indexOf( name ) === -1 ) {
				list.push( name );
				forward.notification( '"' + name + '" added to ignore list', 'info' );
				saveIgnores();
			}
			else forward.active( '"' + name + '" is already on the ignore list', 'info' );
		}
		this.remove = function( name ){
			if ( list.indexOf( name ) !== -1 ) {
				list.splice( list.indexOf( name ) , 1 );
				forward.notification( '"' + name + '" removed from ignore list', 'info' );
				saveIgnores();
			}
			else forward.active( '"' + name + '" is not on the ignore list', 'info' );
		}
	}
	
	var approvedImageHosts = ['imgur\\.com','i\\.imgur\\.com'];
	
	
	$(document.currentScript).parent().empty().append('<div id="chatBox"></div>');
	$('#chatBox').append('<div id="chatHead"></div>');

	var htmlCharacterMap = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;'
	}
	// ' ': '&nbsp; '
	// '(': '&#40;',')': '&#41;','?': '&#63;','[': '&#91;',']': '&#93;','{': '&#123','}': '&#125;','|': '&#124;','\\': '&#92;','/': '&#47;'
	// '=': '&#61;', '!': '&#33;', ':': '&#58;', ';': '&#59;', '~': '&#126;'
	
	var compose = {
		regex: {
			htmlCharacterMapRegex : new RegExp( '[' + Object.keys( htmlCharacterMap ).join( '' ) + ']', 'g' ),	// collapse htmlCharacterMap into this?
			imageRegex : /\b(https?:\/\/)?([\w\d.]+).\/([\w\d]+).(jpg|jpeg|gif|png)(\?[\w\d=]+)?\b/g,
			approvedImageRegex : new RegExp( '\\b(https?:\\/\\/)?(' + approvedImageHosts.join('|') + '){1}\\/([\\w\\d]+).(jpg|jpeg|gif|png)(\\?[\\w\\d=]+)?\\b', 'g' ),
			ircStyleRegex : /(\u0003(\d{0,2}(,\d{1,2})?))|(\u0002)|(\u0009)|(\u000F)|(\u0013)|(\u0015)|(\u001f)|(\u0016)/g,
			channelIDRegex : /(^|\s)(#\w+)/g,
			urlRegex : /\b(https?:\/\/)?([a-zA-Z0-9%_\-~]{1,256}\.)+[a-z]{2,6}(\/[a-zA-Z0-9@:;%_\-\+\.~#?&\/=]*)*\b/g,
			saneMessageRegex : /[\n\r]/g,
			saneInputRegex : /[\n\r: ]/g
		},
		html: function( text ){
			return text.replace( compose.regex.htmlCharacterMapRegex, function( character ) { return htmlCharacterMap[ character ]; } );
		},
		'styles': function( text ){
			var currentForegroundColour = -1;
			var currentBackgroundColour = -1;
			var currentStyles = [];
			var open = false;
	
			function ircStyleReplacement( sample ){
				if (sample === '\u0002') {
					if (currentStyles.indexOf('bold') === -1) currentStyles.push('bold');
					else currentStyles.splice(currentStyles.indexOf('bold'),1);
				}
				else if (sample === '\u0009') {
					if (currentStyles.indexOf('italic') === -1) currentStyles.push('italic');
					else currentStyles.splice(currentStyles.indexOf('italic'),1);
				}
				else if (sample === '\u000F') {	// Reset
					currentStyles = [];
					currentForegroundColour = -1;
					currentBackgroundColour = -1;
				}
				else if (sample === '\u0013') {
					if (currentStyles.indexOf('strikethrough') === -1) currentStyles.push('strikethrough');
					else currentStyles.splice(currentStyles.indexOf('strikethrough'),1);
				}
				else if (sample === '\u0015' || sample === '\u001f') {
					if (currentStyles.indexOf('underline') === -1) currentStyles.push('underline');
					else currentStyles.splice(currentStyles.indexOf('underline'),1);
				}
				else if (sample === '\u0016') {
					// reverse
				}
				else if (sample === '\u0003') {	// lone colour code, clear colours
					currentForegroundColour = -1;
					currentBackgroundColour = -1;
				}
				else {	// that leaves colours :/
					var colours = sample.slice(1).split(','); // remove control char
					if (colours.length === 1){	// no background colour
						if ( colours[0] >= 0 && colours[0] <= 15) currentForegroundColour = parseInt( colours[0], 10 );
						else currentForegroundColour = -1;
					}
					else {
						if ( colours[0] >= 0 && colours[0] <= 15 && colours[1] >= 0 && colours[1] <= 15) {
							currentForegroundColour = parseInt( colours[0], 10 );
							currentBackgroundColour = parseInt( colours[1], 10 );
						}
						else {	// abort on mangled colour codes
							currentForegroundColour = -1;
							currentBackgroundColour = -1;
						}
					}
				}
				
				var addendum = '';
				if (open === true) {
					addendum += '</span>';
					open = false;
				}
				if ((currentForegroundColour !== -1) || (currentBackgroundColour !== -1) || (currentStyles.length > 0)) {
					addendum += '<span class="';
					if (currentForegroundColour !== -1) addendum += 'fc' + currentForegroundColour + ' ';
					if (currentBackgroundColour !== -1) addendum += 'bc' + currentBackgroundColour + ' ';
					if (currentStyles.length > 0) addendum += currentStyles.join(' ') + ' ';
					addendum = addendum.slice(0,-1) + '">';
					open = true;
				}
				return addendum;
			}
			
			if (options.ircstyles === true) {
				var output = text.replace( compose.regex.ircStyleRegex, ircStyleReplacement);
				if (open === true) output += '</span>';
				return output;
			}
			else return text.replace( compose.regex.ircStyleRegex,'');
		},
		'text': function( text ){
			return compose.links( compose.styles( compose.html( text ) ) );
		},
		'images': function( text ){
			var matches = options.images === 'approved' ? text.match( compose.regex.approvedImageRegex ) : text.match( compose.regex.imageRegex );
			var results = '';
			if ( matches !== null && typeof matches === 'object' ){
				matches = matches.filter( function( value, index, self ){ return self.indexOf( value ) === index; } );
				for (var index in matches){
					results += '<div class="thumbnailContainer"><a href="'+matches[index]+'" title="'+matches[index]+'" target="blank"><img class="thumbnail" src="'+matches[index]+'" alt="'+matches[index]+'"></a></div>';
					// onload="channels[ $( this ).closest( 'div.chatArea' ).attr( 'title' ) ].scroll();"
				}
			}
			return results;		
		},
		'links': function( text ){
			return compose.channelID( compose.url( text ) );
		},
		'url': function( text ){
			return text.replace( compose.regex.urlRegex, function ( url ){ return '<a href="' + ( url.match( /^https?:\/\//g ) === null ? 'http://' + url : url ) + '" target="_blank" class="url" title="Click to open ' + url + ' in a new context">' + url + '</a>'; } );
		},
		'channelID': function( text ){
			return text.replace( compose.regex.channelIDRegex, function ( match, space, ID ){ return space + '<a href="#" class="actionLink" title="Click to go to ' + ID + '" data-action="channel" data-message="'+ID+'">' + ID + '</a>'; } );
		},
		'saneMessage': function( text ){
			return text.replace( compose.regex.saneMessageRegex, '' );
		},
		'saneInput': function( text ){
			return text.replace( compose.regex.saneInputRegex, '' );
		},
		'timestamp': function( stamp ){
			var now = ( typeof stamp === 'undefined' ? new Date(): new Date( stamp ) );
			return '<div class="time">[' + ( '0' + now.getHours() ).slice( -2 ) + ':' + ( '0' + now.getMinutes() ).slice( -2 ) + ':' + ( '0' + now.getSeconds() ).slice( -2 ) + ']</div>';
			//return '<div class="time">[' + new Date().toLocaleTimeString() + ']</div>';
		}
	}



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
	



	function lineHandler ( line, self ) {
		var message = parseMessage( line );
		if ( self === true ) message.self = true;
		if ( typeof commandLookup[ message.command ] === 'function') commandLookup[ message.command ]( message );
		else if ( options.debug === true ) forward.console( 'Unsupported command: ' + compose.text( message.raw ) );
	}

	function parseMessage ( message ){
		var parsedMessage = {
			raw: message,
			tags: {},
			prefix: null,
			command: null,
			params: [],
			self: false
		}

		var splitLine = message.split( ' ' );	// this is going to eat trailing spaces, needs a better design
		if ( splitLine[ 0 ].charCodeAt( 0 ) === 64 ){
			var tags = splitLine.shift();
			tags = tags.split( ';' );
			for ( var index = 0; index < tags.length; index++ ){
				if ( tags[ index ].indexOf( '=' ) === -1 ) parsedMessage.tags[ tags[ index ]] = true;
				else parsedMessage.tags[ tags[ index ].split( '=' )[ 0 ] ] = tags[ index ].split( '=' )[ 1 ];
			}
		}
		if ( splitLine[ 0 ].charCodeAt( 0 ) === 58 ) parsedMessage.prefix = splitLine.shift().slice( 1 );
		parsedMessage.command = splitLine.shift();
		var lastParam = false;
		while ( lastParam === false && splitLine.length > 0 ) {
			if ( lastParam === false && splitLine[ 0 ].charCodeAt( 0 ) === 58 ) {
				lastParam = true;
				parsedMessage.params.push( splitLine.join( ' ' ).slice( 1 ) );
			}
			else parsedMessage.params.push( splitLine.shift() );
		}
		return parsedMessage;
	}

	var commandLookup = {
		'PING': function( message ){
			irc.sendNow( 'PONG ' + message.params[ 0 ] );
			if ( options.pings === true ) forward.console( compose.html( 'Received ping (' + message.raw + '), replied pong (PONG ' + message.params[ 0 ] + ')' ) );
		},
		'CAP': function( message ){
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

				channels[ message.params[ 0 ] ].line( '<span class="nick">' + compose.html( ( message.prefix === null ? config.nick : message.prefix.split( '!' )[ 0 ] ) + ' has set mode: ' + message.params.slice( 1 ).join( ' ' ) ) + '</span>');
				
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
			forward.channel( message.params[ 0 ], '<span class="info">' + compose.text( message.prefix.split('!')[0] + ' has changed the topic for ' +  message.params[ 0 ] + ' to "' + message.params[ 1 ] + '"' ) + '</span>' );
		},
		'ERROR': function( message ){
			forward.console( compose.text( message.raw ) );
		},
		'001': function( message ){	// RPL_WELCOME
			forward.console( compose.text( message.params[ 1 ] ) );
		},
		'002': function( message ){	// RPL_YOURHOST
			forward.console( compose.text( message.params[ 1 ] ) );
		},
		'003': function( message ){	// RPL_CREATED
			forward.console( compose.text( message.params[ 1 ] ) );
		},
		'004': function( message ){	// RPL_MYINFO
			forward.console( compose.text('Server ' + message.params[ 1 ] + ' version ' + message.params[ 2 ] + ' supporting user modes "' + message.params[ 3 ] + '" and channel modes "' + message.params[ 4 ] +'"' ) );
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
		'251': function( message ){	// RPL_LUSERCLIENT
			forward.console( compose.text( message.params[ 1 ] ) );
		},
		'252': function( message ){	// RPL_LUSEROP
			forward.console( compose.text( message.params.slice( 1 ).join( ' ' ) ) );
		},
		'253': function( message ){	// RPL_LUSERUNKNOWN
			forward.console( compose.text( message.params.slice( 1 ).join( ' ' ) ) );
		},
		'254': function( message ){	// RPL_LUSERCHANNELS
			forward.console( compose.text( message.params.slice( 1 ).join( ' ' ) ) );
		},
		'255': function( message ){	// RPL_LUSERME
			forward.console( compose.text( message.params[ 1 ] ) );
		},
		'265': function( message ){	// RPL_LOCALUSERS
			forward.console( compose.text( message.params[ 1 ] ) );
		},
		'266': function( message ){	// RPL_GLOBALUSERS
			forward.console( compose.text( message.params[ 1 ] ) );
		},
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
		'372': function( message ){	// RPL_MOTD
			forward.console( compose.text( message.params[ 1 ] ) );
		},
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
		'461': function( message ){	// ERR_NEEDMOREPARAMS
			forward.active( compose.html( message.params[ 1 ] + ' ' + message.params[ 2 ] ) );
		},
		'482': function( message ){	// ERR_CHANOPRIVSNEEDED
			forward.active( compose.html( message.params[ 1 ] + ' ' + message.params[ 2 ] ) );
		},
		'900': function( message ){	// RPL_LOGGEDIN
			forward.active( compose.html( 'SASL: ' + message.params[ 3 ] ) );
		},
		'901': function( message ){	// RPL_LOGGEDOUT
			forward.active( compose.html( 'SASL: ' + message.params[ 2 ] ), 'warning' );
		},
		'902': function( message ){	// ERR_NICKLOCKED 
			forward.active( compose.html( 'SASL: ' + message.params[ 1 ] ), 'error' );
		},
		'903': function( message ){	// RPL_SASLSUCCESS
			forward.active( compose.html( message.params[ 1 ] ) );
		},
		'904': function( message ){	// ERR_SASLFAIL
			forward.active( compose.html( message.params[ 1 ] ), 'warning' );
		},
		'905': function( message ){	// ERR_SASLTOOLONG
			forward.active( compose.html( message.params[ 1 ] ), 'warning' );
		},
		'906': function( message ){	// ERR_SASLABORTED
			forward.active( compose.html( message.params[ 1 ] ), 'warning' );
		},
		'907': function( message ){	// ERR_SASLALREADY
			forward.active( compose.html( message.params[ 1 ] ), 'warning' );
		},
		'908': function( message ){	// RPL_SASLMECHS
			forward.active( compose.html( message.params[ 1 ] + ' ' + message.params[ 1 ] ) );
		},
		'926': function( message ){	// Channel forbidden
			forward.active( compose.html( message.params[ 2 ] ), 'error' );
		}
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
		}
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
		if ( line.charCodeAt( 0 ) === 47 ) {
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

	function userSort( a, b ) {	//if a is further up the list than b
		var aModes = a.match( config.modeSymbolRegex );
		var bModes = b.match( config.modeSymbolRegex );
		if ( aModes !== null && bModes === null ) return true;
		else if ( aModes === null && bModes !== null ) return false;
		else if ( aModes !== null && bModes !== null){
			for ( var index = 0; index < config.modeSymbols.length; index++ ){
				if ( aModes.indexOf( config.modeSymbols[index] ) !== -1 && bModes.indexOf( config.modeSymbols[index] ) === -1  ) return true;
				else if ( aModes.indexOf( config.modeSymbols[index] ) === -1 && bModes.indexOf( config.modeSymbols[index] ) !== -1 ) return false;
			}
			if ( a.toLowerCase() < b.toLowerCase() ) return true;
		}
		else if ( a.toLowerCase() < b.toLowerCase() ) return true;
		return false;
	}

	var alternator = function(){
		var alternateLineBackgroundSwitch = true;
		return function() {
			if ( alternateLineBackgroundSwitch ) {
				alternateLineBackgroundSwitch = false;
				return 'light';
			}
			else {
				alternateLineBackgroundSwitch = true;
				return ( options.alternating === true ? 'dark' : 'light' );
			}
		}
	}

	var inputBar = function( channelName, $chatArea ){
		var inputHistory = [];
		var inputHistoryPosition = null;
		var currentInput = '';

		$chatArea.append( '<div class="chatInput"><form><input class="input" title="type your message and hit enter to send" type="text"><button class="send" title="Sir, are you sure you want to say that? Sir? SIR?">Send</button></form></div>' );
		var $input = $chatArea.find('.input');
		this.focus = function(){ $input.focus(); }
		$input.focus();
		
		$input.on( 'keydown', function ( event ) {
			if ( typeof keypresses[ event.which ] === 'function' ) {
				event.preventDefault();
				keypresses[ event.which ]();
			}
		});
		$chatArea.find('.send').on('click', function ( event ){
			event.preventDefault();
			handleInput();
		});

		var keypresses = {
			13: function(){
				handleInput();
			},
			9: function(){	// tab
				var solutions = [];
				var partialWord = $input.val().split( ' ' ).slice( -1 )[ 0 ];	// this only tab completes against the last word

				if ( partialWord.length > 0 ){
					var filterRegex = new RegExp( '^' + partialWord.toLowerCase(), 'g' );
					$chatArea.find( 'div.userlist' ).each( function( index ){
						if ( filterRegex.test( $( this ).text().toLowerCase() ) === true ) solutions.push( $( this ).text() );
					});
					if ( solutions.length === 1 ) $input.val( $input.val().replace( new RegExp( partialWord + '$' ), solutions[ 0 ] ) );
					else if ( solutions.length > 1 ) forward.active( compose.html( 'Possible matches: ' + solutions.join( ', ' ) ) , 'info' );
				}
			},
			38: function(){	// up
				if ( inputHistory.length > 0 ){
					if ( inputHistoryPosition === null ) {
						inputHistoryPosition = 0;
						currentInput = $input.val();
						$input.val( inputHistory[ inputHistoryPosition ] );
					}
					else if ( inputHistoryPosition + 1 >= inputHistory.length ) {
						inputHistoryPosition = null;
						$input.val( currentInput );
					}
					else {
						inputHistoryPosition++;
						$input.val( inputHistory[ inputHistoryPosition ] );
					}
				}
			},
			40: function(){	// down
				if ( inputHistory.length > 0 ){
					if ( inputHistoryPosition === null ) {
						inputHistoryPosition = inputHistory.length - 1;
						currentInput = $input.val();
						$input.val( inputHistory[ inputHistoryPosition ] );
					}
					else if ( inputHistoryPosition - 1 < 0 ) {
						inputHistoryPosition = null;
						$input.val( currentInput );
					}
					else {
						inputHistoryPosition--;
						$input.val( inputHistory[ inputHistoryPosition ] );
					}
				}
			}
		}
		
		function handleInput(){
			if ( $input.val() !== '' ){
				var input = compose.saneMessage( $input.val() );
				inputHistory.unshift( input );
				if ( inputHistory.length > 20 ) inputHistory.pop();	// input history hardcoded? should this be somewhere else?
				inputHistoryPosition = null;
				currentInput = $input.val();
				$input.val( '' );
				$input.focus();
				inputHandler( channelName, input );
			}
		}
	}

	var userList = function ( channelName, $chatArea ){
		$chatArea.append('<div class="chatSidebar userSidebar"></div>');
		var $userSidebar = $chatArea.find( 'div.userSidebar' );
		var endOfNames = true;

		this.toggle = function(){
			if ( $userSidebar.is(':visible') === false ) $userSidebar.show();
			else $userSidebar.hide();
		}

		this.update = function () {
			if ( options.alternating === true ){
				$( 'div.userlist' ).removeClass( 'light dark' );
				$( 'div.userlist:even' ).addClass( 'light' );
				$( 'div.userlist:odd' ).addClass( 'dark' );
			}
			else $( 'div.userlist:not( light )' ).removeClass( 'dark' ).addClass( 'light' );
		}
		this.handle353 = function( list ){
			if ( endOfNames === true ){
				$userSidebar.find( 'div.userlist' ).remove();
				endOfNames = false;
			}
			for (var index in list) {
				channels[ channelName ].user.add( list[ index ].replace( config.modeSymbolRegex, '' ), list[ index ] );
			}
			channels[ channelName ].user.update();
		}
		this.handle366 = function(){
			endOfNames = true;
		}
		this.join = function(nick){
			channels[ channelName ].line('<span class="join">' + compose.html( nick +' has joined '+ channelName ) + '</span>');
			channels[ channelName ].user.add( nick, nick );
			channels[ channelName ].user.update();
		}
		this.nick = function(oldNick, newNick){
			if ( $userSidebar.find( 'div.userlist[title="' + oldNick + '"]' ).length > 0 ){
				channels[ channelName ].line('<span class="nick">' + compose.html( oldNick + ' is now known as ' + newNick ) + '</span>');	
				var modes = $( 'div.userlist[title="' + oldNick + '"]' ).text().match( config.modeSymbolRegex );
				$userSidebar.find( 'div.userlist[title="' + oldNick + '"]' ).remove();
				
				var modedNick = ( modes === null ? newNick : modes.join('') + newNick );
				channels[ channelName ].user.add( newNick, modedNick );
				channels[ channelName ].user.update();
			}
		}
		this.modeAdd = function( mode, target ){
			var displayNick = $userSidebar.find( 'div.userlist[title="' + target + '"]' ).text();
			if ( displayNick.indexOf( config.modeMap[ mode ] ) === -1 ){
				$userSidebar.find( 'div.userlist[title="' + target + '"]' ).remove();
				channels[ channelName ].user.add( target, config.modeMap[ mode ] + displayNick );
				channels[ channelName ].user.update();
			}
		}
		this.modeSub = function( mode, target ){
			var displayNick = $userSidebar.find( 'div.userlist[title="' + target + '"]' ).text();
			if ( displayNick.indexOf( config.modeMap[ mode ] ) !== -1 ){
				$userSidebar.find( 'div.userlist[title="' + target + '"]' ).remove();
				channels[ channelName ].user.add( target, displayNick.replace( new RegExp( '[' + config.modeMap[ mode ] + ']', 'g' ), '' ) );
				channels[ channelName ].user.update();
			}
		}
		this.part = function( nick, message ){
			channels[ channelName ].line( '<span class="part">' + compose.html(nick +' has left '+ channelName + ( typeof message === 'undefined' ? '': ': ' +  message ) ) + '</span>' );
			$userSidebar.find( 'div.userlist[title="' + nick + '"]' ).remove();
			channels[ channelName ].user.update();
		}
		this.quit = function(nick, message){
			if ( $userSidebar.find( 'div.userlist[title="' + nick + '"]' ).length > 0 ){
				channels[ channelName ].line( '<span class="quit">' + compose.html( nick + ' has quit: ' + message ) + '</span>' );
				$userSidebar.find( 'div.userlist[title="' + nick + '"]' ).remove();
				channels[ channelName ].user.update();
			}
		}
		this.kick = function(nick, message){
			channels[ channelName ].line( '<span class="kick">' + compose.html( nick + ' has been kicked from ' + channelName + ': '+ message ) + '</span>' );
			$userSidebar.find( 'div.userlist[title="' + nick + '"]' ).remove();
			channels[ channelName ].user.update();
		}
		this.add = function( nick, displayNick ){
			var added = false;
			$userSidebar.find('div.userlist').each(function(){
				if ( userSort( displayNick, $( this ).text() ) === true ) {
					$( '<div class="userlist" title="' + compose.html( nick ) + '">' + compose.html( displayNick ) + '</div>' ).insertBefore( $( this ) );
					added = true;
					return false;
				}
			});
			if( added === false ) $userSidebar.append( '<div class="userlist" title="' + compose.html( nick ) + '">' + compose.html( displayNick ) + '</div>' );
		}
	}

	var userHandler = function( channelName ){
		this.nick = function( oldNick, newNick ){
			if ( oldNick === channelName ){
				channels[ channelName ].line( '<span class="nick">' + compose.html( oldNick + ' is now known as ' + newNick ) + '</span>' );
				channels[ channelName ].renameChannel( newNick );
			}
			else if (channelName === ':Console' && newNick === config.nick ){
				channels[ channelName ].line( compose.text( 'You have changed your nickname to ' + newNick ) );
			}
		}
		this.quit = function( nick, message ){
			if ( nick === channelName ) channels[ channelName ].line( compose.html( nick +' has quit: '+ message ) );
		}
	}

	
	function deselectChatArea(){
		$( 'div.chatArea:visible' ).hide();
		$( 'div.switchSelected' ).removeClass( 'switchSelected' );
		$( 'span.channelDropDownArrow' ).hide();
	}
	
	function selectChatArea( channelName ){
		$( 'div.chatArea[title="' + channelName + '"]' ).show();
		channels[ channelName ].scroll();
		$( 'div.channelSwitch[title="' + channelName + '"]' ).removeClass( 'channelActivity' ).addClass( 'switchSelected' );
		$( 'div.channelSwitch[title="' + channelName + '"] > span.channelDropDownArrow' ).show();
	}

	function changeChatArea( channelName ){
		deselectChatArea();
		selectChatArea( channelName );
	}
	
	var channels = {};
	var channel = function (chanName,sidebars,isConsole) {
		var self = this;
		var channelName = chanName;
		var modes = [];
		var allowSidebars = ( sidebars === true ? true : false );
		var scrolled = true;
				
		if ( options.snap === true ) deselectChatArea();
		$('#chatBox').append('<div class="chatArea" title="'+channelName+'"></div>');
		var $chatArea = $('div.chatArea[title="'+channelName+'"]');
		if ( options.snap === false ) $chatArea.hide();

		if (isConsole === true){
			$('#chatHead').append('<div class="channelSwitch" title=":Console">&nbsp;&gt;&nbsp;</div>');
			var $channelSwitch = $('div.channelSwitch[title=":Console"]');
			$channelSwitch.on('click', function(e){
				$('#dropdownMenu').remove();
				if ( $chatArea.is(":visible") === false ){
					changeChatArea( channelName );
					input.focus();
				}
			});
		}
		else {
			$('#chatHead').append('<div class="channelSwitch" title="'+channelName+'">&nbsp;'+channelName+'&nbsp;<span class="channelDropDownArrow">&#9660;</span></div>');
			var $channelSwitch = $('div.channelSwitch[title="'+channelName+'"]');
			$channelSwitch.on('click', function(e){
				if ( $chatArea.is(":visible") === true ){
					$( '#dropdownMenu' ).is( ":visible" ) === false ? self.dropdownMenu( $( this ).position().left ) : $( '#dropdownMenu' ).remove();
				}
				else {
					$('#dropdownMenu').remove();
					changeChatArea( channelName );
					input.focus();
				}
			});
		}
		$channelSwitch.removeClass('channelActivity').addClass('switchSelected');
				
		if ( allowSidebars === true ) this.user = new userList( channelName, $chatArea );
		else this.user = new userHandler( channelName );

		$chatArea.append('<div class="chatText"></div>');
		var $chatText = $chatArea.find('.chatText');
		$chatText.on( 'scroll', function ( event ){
			scrolled = ( ( $chatText.scrollTop() + $chatText.height() ) === $chatText.prop('scrollHeight') ) ? true : false;
		});

		var input = new inputBar( channelName, $chatArea );

		this.scroll = function(){
			if ( scrolled === true && $chatArea.is( ":visible" ) ) $chatText.scrollTop( $chatText.prop( 'scrollHeight' ) );
		}
		
		this.dropdownMenu = function(position){
			$('#dropdownMenu').remove();
			$chatArea.append('<div id="dropdownMenu"></div>');
			$('#dropdownMenu').css( 'left', ( typeof position === 'number' ? Math.floor( position ) : 0 ) );
			$('#dropdownMenu').on('mouseleave', function(){
				$(this).remove();
			});
			
			if (allowSidebars === true) {
				$('#dropdownMenu').append('<div id="toggleUserlist">Show Userlist</div>');
				$('#toggleUserlist').on('click', function (){
					self.user.toggle();
				});
				
				$('#dropdownMenu').append('<div id="fetchTopic">Fetch Topic</div>');
				$('#fetchTopic').on('click', function (){
					irc.topic( channelName );
				});
				
				$('#dropdownMenu').append('<div id="partChannel">Part Channel</div>');
				$('#partChannel').on('click', function (){
					irc.part( channelName );
				});
			}
			else {
				$('#dropdownMenu').append('<div id="partChannel">Close Dialog</div>');
				$('#partChannel').on('click', function (){
					self.close();
				});
			}
		}
		
		this.renameChannel = function ( newName ){
			var oldName = channelName;
			channelName = newName;

			$chatArea.attr( 'title', channelName );
			$chatArea = $( 'div.chatArea[title="' + channelName + '"]' );
			$channelSwitch.attr( 'title', channelName );
			$channelSwitch.html( '&nbsp;' + channelName + '&nbsp;<span class="channelDropDownArrow">&#9660;</span>' );
			$channelSwitch = $('div.channelSwitch[title="'+channelName+'"]');
			if ( $chatArea.is( ':visible' ) === false ) $channelSwitch.find( 'span.channelDropDownArrow' ).hide();

			channels[newName] = channels[oldName];
			delete channels[oldName];
		}
		
		this.close = function( message ){
			$chatArea.remove();
			$channelSwitch.remove();
			delete channels[ channelName ];
			
			var replacement = Object.keys( channels );
			selectChatArea( replacement[ replacement.length - 1 ] );
			if ( typeof message === 'string' ) forward.active( message, 'info' );
		}
		
		this.modes = function(modeLine){
			var newModes = modeLine[4].trim();
			self.line( modeLine[0] + ' has set channel mode ' + newModes );
			newModes = newModes.split('');
			var set = true;
			for (var index in newModes){
				if ( newModes[index] === '+' ) set = true;
				else if ( newModes[index] === '-' ) set = false;
				else {
					if (set === true && modes.indexOf( newModes[index] ) === -1 ) modes.push( newModes[index] );
					else if ( modes.indexOf( newModes[index] ) !== -1 ) modes.splice( modes.indexOf( newModes[index] ),1 );
				}
			}
		}

		var alternateLineBackground = new alternator();

		this.line = function ( message, type, timestamp ){
			var appendage = '<div class="ircText';
			if ( type === 'self' ) appendage += ' self';
			else if ( type === 'error' ) appendage += ' error';
			else if ( type === 'info' ) appendage += ' info';
			else if ( type === 'warning' ) appendage += ' warning';
			else if ( options.highlight === true && message.search( config.nickRegex ) !== -1 ) appendage += ' highlight';
			appendage += '">' + compose.timestamp( typeof timestamp === 'undefined' ? void( 0 ) : timestamp ) + ' ';
			appendage += '<div class="messageContainer';
			if ( type === 'notice' ) appendage += ' notice';
			appendage += '">' + message + '</div>';
			if ( allowSidebars === true && options.images !== 'none' ) appendage += compose.images( message );
			appendage += '</div>';
			
			channels[ channelName ].append( appendage );
		}

		this.append = function ( line ){
			if ( $channelSwitch.hasClass('switchSelected') === false ) $channelSwitch.addClass('channelActivity');
			if ( $chatText.find( 'div.ircText' ).length >= options.history ) $chatText.find( '>:first-child' ).remove();
			$( line ).appendTo( $chatText ).addClass( alternateLineBackground() );
			channels[ channelName ].scroll();
		}
	}
	
	channels[':Console'] = new channel(':Console',false,true);
	forward.console('Welcome to the internets, your connection will establish shortly...');

	
	$( '#chatBox' ).append( '<div class="chatArea helpBox" Title=":Help"></div>' );
	
	$( '#chatHead' ).append( '<div class="channelSwitch specialSwitch" title="Help">&nbsp;&#9072;&nbsp;</div>' );
	$( 'div.specialSwitch[title="Help"]' ).on( 'click', function( e ){
		if ( !$( 'div.helpBox' ).is( ":visible" )){
			deselectChatArea();
			$('div.helpBox').show();
			$(this).addClass('switchSelected');
		}
	});
	
	var helptext = '<div class="help">';
			helptext += '<div>bug list</div>';
			helptext += '<hr />';
			helptext += '<div>scroll down after image loading?</div>';
			helptext += '<div>url detection regex not picking up trailing slashes</div>';
			helptext += '<div>all the broken things</div>';
			helptext += '<hr /><hr />';
			helptext += '1.0 proposed feature list';
			helptext += '<hr />';
			helptext += '<div>actual helptext</div>';
			helptext += '<div>options page layout</div>';
			helptext += '<div>all the numerics I\'ve missed</div>';
			helptext += '<div>channel modes in dropdown menu</div>';
			helptext += '<div>time format options</div>';
			helptext += '<div>option to have userlists open by default</div>';
			helptext += '<div>option to show hostmasks in join/quit and userlist (dropdown?)</div>';
			helptext += '<div>options (specifically nick box) refreshing on opening</div>';
			helptext += '<div>sort out if flex-grow should be 1 or less to push images all the way to the right or just a little</div>';
			helptext += '<div>sort adding modes in userlist by priority</div>';
			helptext += '<div>default inline images to disabled</div>';
			helptext += '<hr /><hr />';
			helptext += '1.2 proposed feature list';
			helptext += '<hr />';
			helptext += '<div>outbound ctcp requests?</div>';
			helptext += '<div>input formatting options</div>';
			helptext += '<div>tab completion mid input</div>';
			helptext += '<div>coloured username options (random/hash/modes)</div>';
			helptext += '<div>highlight by additional/selective words/regex</div>';
			helptext += '<div>channel tab highlight option to trigger only on messages/different colours for joins/parts, messages and highlights</div>';
			helptext += '<div>stylesheet choices</div>';
			helptext += '<div>bake css into javascript</div>';
			helptext += '<div>revisit allowing channel windows to remain open on part/kick/disconnect</div>';
		helptext += '</div>';
	$( 'div.helpBox' ).html( helptext );

	function saveOptions(){
		localStorage.setItem( 'options' + optionKey , JSON.stringify( options ) );
	}

	var optionUI = {
		toggle: function (id, text, effectCallback) {
			$('div.optionBox').append('<div class="option" id="option_'+id+'">'+text+'</div>');
			$('#option_'+id).addClass( options[id] === true ? 'optionOn' : 'optionOff' );
			$('#option_'+id).on('click', function () {
				if (options[$(this).prop('id').split('_')[1]]) {	// is true, set false
					$(this).removeClass('optionOn').addClass('optionOff');
					options[$(this).prop('id').split('_')[1]] = false;
				}
				else {	// is false, set true
					$(this).removeClass('optionOff').addClass('optionOn');
					options[$(this).prop('id').split('_')[1]] = true;
				}
				saveOptions();
				if ( typeof effectCallback === 'function' ) effectCallback();
			});
		},
		selector: function ( id, text, choiceArray, effectCallback ){
			$('div.optionBox').append('<div class="option" id="option_'+id+'">'+text+'</div>');
			$('#option_'+id).text( $('#option_'+id).text() + ' ' + options[id] );	// compose.html?
			$('#option_'+id).on('click', function () {
				var currentChoice = $( this ).text().split(' ');
				currentChoice = currentChoice[ currentChoice.length-1 ].trim();
				var nextChoice = choiceArray.indexOf( currentChoice ) + 1;
				nextChoice = nextChoice >= choiceArray.length ? choiceArray[0] : choiceArray[ nextChoice ] ;
				options[ $(this).prop('id').split('_')[1] ] = nextChoice;
				$( this ).text( $( this ).text().replace(currentChoice, nextChoice) );
				saveOptions();
				if ( typeof effectCallback === 'function' ) effectCallback();
			});
		},
		input: function ( id, text, sanity, effectCallback ){
			$( 'div.optionBox' ).append( '<div class="option" id="option_' + id + '">' + text + ': <input class="optionInput" data-id="' + id + '" value="' + ( options[ id ] === null ? '' : options[ id ] ) + '"><button class="optionButton" data-id="' + id + '" title="Sir, Are you sure that\'s wise? Sir? SIR?">Set</button></div>' );
			$( 'button.optionButton[data-id="' + id + '"]' ).on( 'click', function( event ){
				event.preventDefault();
				var id = $( this ).attr( 'data-id' );
				options[ id ] = ( sanity === 'message' ? compose.saneMessage( $( 'input.optionInput[data-id="' + id + '"]' ).val() ) : compose.saneInput( $( 'input.optionInput[data-id="' + id + '"]' ).val() ) );
				saveOptions();
				$( '#option_' + id ).append( '<span class="optionResult">Saved!</span>' );
				setTimeout( function(){
					$( 'span.optionResult' ).remove();
				}, 3000 );
				if ( typeof effectCallback === 'function' ) effectCallback();
			});
		},
		listInput: function( id, text, effectCallback ){
			$( 'div.optionBox' ).append( '<div class="option" id="option_' + id + '">' + text + ': <input class="optionInput" data-id="' + id + '" value="' + ( options[ id ] === null ? '' : options[ id ] ) + '"><button class="optionButton" data-id="' + id + '" title="Sir, Are you sure that\'s wise? Sir? SIR?">Set</button></div>' );
			$( 'button.optionButton[data-id="' + id + '"]' ).on( 'click', function( event ){
				event.preventDefault();
				var id = $( this ).attr( 'data-id' );
				var rawInput = $( 'input.optionInput[data-id="' + id + '"]' ).val().split(',');
				var arrayInput = [];
				for ( var index = 0; index < rawInput.length; index++ ) arrayInput.push( compose.saneInput( rawInput[ index ].trim() ) );
				options[ id ] = arrayInput;
				saveOptions();
				$( '#option_' + id ).append( '<span class="optionResult">Saved!</span>' );
				setTimeout( function(){
					$( 'span.optionResult' ).remove();
				}, 3000 );
				if ( typeof effectCallback === 'function' ) effectCallback();
			});
		},
		spacer: function(title){
			$('div.optionBox').append('<div class="optionHeader">'+(title ? title : '&nbsp;')+'</div>');
		},
		redrawIgnoreList: function (){
			$( '#ignoreList' ).find( 'div' ).remove();
			if ( ignoreList.getList().length > 0 ){
				for ( var index = 0; index < ignoreList.getList().length; index++ ) {
					$( '#ignoreList' ).append( '<div><span class="messageNick" data-action="nick" title="' + ignoreList.getList()[ index ] + '">' + ignoreList.getList()[ index ] + '</span></div>' );
				}
			}
			else $( '#ignoreList' ).append( '<div>No entries</div>' );
		},
		updateInputs: function(){
			$( 'input.optionInput' ).each( function(){
				$( this ).val( options[ $( this ).attr( 'data-id' ) ] );
			});
		}
	}

	$('#chatBox').append('<div class="chatArea optionBox" title=":Settings"></div>');
	
	$('#chatHead').append('<div class="channelSwitch specialSwitch" title="Settings">&nbsp;&#9881;&nbsp;</div>');
	$('div.specialSwitch[title="Settings"]').on('click', function( event ){
		if (!$('div.optionBox').is(":visible")){
			deselectChatArea();
			$('div.optionBox').show();
			$(this).addClass('switchSelected');
			optionUI.redrawIgnoreList();
			optionUI.updateInputs();
		}
	});

	optionUI.spacer( 'Self' );
	optionUI.toggle( 'saveNick', 'Keep nickname for future sessions' );
	optionUI.input( 'nick', 'Your nickname', 'input', function(){
		irc.nick( options.nick );
	});
	optionUI.input( 'token', 'Login token or password', 'message' );
	optionUI.spacer('Console');
	optionUI.toggle('pings','Show pings/pongs');
	optionUI.toggle('console','Show Console', function(){
		options.console === true ? $('div.channelSwitch[title=":Console"]').show() : $('div.channelSwitch[title=":Console"]').hide();
	});
	optionUI.spacer('Channels');
	optionUI.toggle( 'saveChannels', 'Reopen channels from previous sessions' );
	optionUI.listInput( 'channels', 'Auto join channels' );
	optionUI.toggle('joins','Show joins/parts');
	optionUI.toggle('modes','Show mode changes');
	optionUI.selector( 'history', 'Lines of history retained:', [ '40', '60', '80', '100' ], function(){
		options.history = parseInt( options.history, 10 );
		saveOptions();
		$( 'div.chatText' ).each( function(){
			$( this ).children().slice( 0, ( options.history * -1 ) ).remove();
		});
	});
	optionUI.toggle('alternating','Toggle alternating backgrounds', function(){
		if ( options.alternating === false ){
			$( 'div.userlist:not( light )' ).removeClass( 'dark' ).addClass( 'light' );
			$( 'div.ircText:not( light )' ).removeClass( 'dark' ).addClass( 'light' );
		}
		else {
			$( 'div.userlist:even' ).addClass( 'dark' );
			$( 'div.ircText:even' ).addClass( 'dark' );
		}
	});
	optionUI.toggle('snap','Snap on channel open');
	optionUI.toggle('timestamp','Show timestamps', function(){
		options.timestamp === true ? $( 'div.time' ).show() : $( 'div.time' ).hide();
	});
	optionUI.toggle( 'highlight','Highlight lines containing own nickname' );
	//optionUI.toggle('part','Close on part');
	optionUI.selector( 'images', 'Display inline images:', [ 'all', 'approved', 'none' ] );
	optionUI.toggle('ircstyles','Allow irc style formatted text');
	optionUI.spacer('Other');
	optionUI.toggle('debug','debug shit');
	optionUI.spacer('Users');
	optionUI.toggle('ignoreConsole','Send ignored user messages to the console');
	optionUI.toggle('ignoreFollow','Follow nick changes and ignore those as well');
	optionUI.toggle('ignoreAbandon','Remove ignores for ignored nicks changed away from');
	optionUI.spacer('Ignore List:');

	$( 'div.optionBox' ).append( '<div id="ignoreList"></div>' );
	optionUI.redrawIgnoreList();

	
	var ws;
	var preventReconnect = false;
	var holdover = false;
	var socket = {
		'close': function (){
			ws.close();
		},
		'send': function (message){
			ws.send(message);
		},
		'connect': function() {
			ws = new WebSocket( address );
			preventReconnect = false;
	
			ws.onerror = function(error){
				forward.console( 'A websocket error has occured, please wait while the websocket is turned off and on again', 'error' );
			}
			
			ws.onclose = function(event){
				for (var index in channels){
					if ( index !== ':Console' ) channels[ index ].close();
				}
				if ( ws.readyState === 3 && preventReconnect === false ){
					forward.console( 'Connection closed. ( code: ' + event.code + ' ) Attempting reconnection in ' + ( config.reconnectDelay/1000 ) + ' seconds. ( <a class="actionLink" data-action="cancelConnect" title="Cancel" href="#">Cancel</a> | <a class="actionLink" data-action="reconnect" title="Reconnect" href="#">Reconnect now</a> )', 'error' );
					clearTimeout( manualTimeoutCallback );
					reconnectCallback = setTimeout( function() {
						socket.connect();
					}, config.reconnectDelay );
				}
				else if ( preventReconnect === true ){
					forward.console( 'Connection closed. ( code: ' + event.code + ' ) <a class="actionLink" data-action="reconnect" title="Reconnect" href="#">Reconnect?</a>', 'error' );
					clearTimeout( manualTimeoutCallback );
				}
				else {
					forward.console( 'Connection closed. ( code: ' + event.code + ' )' );
				}
			}
			
			ws.onopen = function (){
				forward.console('Connecting to ' + address + '...');
				irc.login( true );
			}
			
			ws.onmessage = function ( event ) {
				irc.tapTimeout();
				var data = event.data.toString().split('\r\n');
				if ( holdover !== false) {
					data[0] = holdover + data[0];
					holdover = false;
				}
				if ( data[ data.length-1 ] !== '' ) holdover = data.pop();
				else data.pop();
				for (var i = 0; i < data.length; i++) lineHandler(data[i]);
			};
		}
	};


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

	$( document ).ready( function() {
		socket.connect();
	});

	$( window ).unload(function() {
		irc.quit('Browser closed');
	});
	
	window.onbeforeunload = function() {
		return "Navigating away from this page will disconnect you from the chat. Please don't leave us";
	}

}());
