	
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