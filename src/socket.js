	
	var ws = null;
	var socket = {
		'preventReconnect': false,
		'holdover': null,
		'close': function (){
			ws.close();
		},
		'send': function (message){
			ws.send(message);
		},
		'connect': function() {
			ws = new WebSocket( address );
			socket.preventReconnect = false;
	
			ws.onerror = function(error){
				forward.console( 'A websocket error has occured, please wait while the websocket is turned off and on again', 'error' );
			}
			
			ws.onclose = function(event){
				for (var index in channels){
					if ( index !== ':Console' ) channels[ index ].close();
				}
				if ( ws.readyState === 3 && socket.preventReconnect === false ){
					forward.console( 'Connection closed. ( code: ' + event.code + ' ) Attempting reconnection in ' + ( config.reconnectDelay/1000 ) + ' seconds. ( <a class="actionLink" data-action="cancelConnect" title="Cancel" href="#">Cancel</a> | <a class="actionLink" data-action="reconnect" title="Reconnect" href="#">Reconnect now</a> )', 'error' );
					clearTimeout( manualTimeoutCallback );
					reconnectCallback = setTimeout( function() {
						socket.connect();
					}, config.reconnectDelay );
				}
				else if ( socket.preventReconnect === true ){
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
				if ( socket.holdover !== null) {
					data[0] = socket.holdover + data[0];
					socket.holdover = null;
				}
				if ( data[ data.length-1 ] !== '' ) socket.holdover = data.pop();
				else data.pop();
				for (var i = 0; i < data.length; i++) lineHandler(data[i]);
			};
		}
	};