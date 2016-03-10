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