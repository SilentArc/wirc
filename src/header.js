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