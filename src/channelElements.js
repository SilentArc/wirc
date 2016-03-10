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