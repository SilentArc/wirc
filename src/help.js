	
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