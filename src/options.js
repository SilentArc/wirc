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