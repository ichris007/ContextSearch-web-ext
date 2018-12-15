var userOptions = {};

var CS_MARK_instance;

browser.runtime.sendMessage({action: "getUserOptions"}).then( result => {
	
	userOptions = result.userOptions;

	let styleEl = document.createElement('style');
	document.head.appendChild(styleEl);
	
	styleEl.innerText = `
		.CS_mark[data-style="0"] { 
			background:${userOptions.highLight.styles[0].background};
			color:${userOptions.highLight.styles[0].color};
		}	
		.CS_mark[data-style="1"] {
			background:${userOptions.highLight.styles[1].background};
			color:${userOptions.highLight.styles[1].color};
		}
		.CS_mark[data-style="2"] {
			background:${userOptions.highLight.styles[2].background};
			color:${userOptions.highLight.styles[2].color};
		}
		.CS_mark[data-style="3"] {
			background:${userOptions.highLight.styles[3].background};
			color:${userOptions.highLight.styles[3].color};
		}
		.CS_mark_selected {
			background: #65FF00 !important;
			color: white !important;
		}
		`;
});

document.addEventListener('CS_mark', (e) => {
	
	CS_MARK_instance = new Mark(document.body);
	
	// Chrome markings happened before loading userOptions
	let optionsCheck = setInterval( () => {
		if ( userOptions === {} ) return;
		
		clearInterval(optionsCheck);
		
		mark(e.detail.trim());
	
	}, 100);
	
});

document.addEventListener('keydown', (e) => {
	if ( e.which === 27 ) {
		CS_MARK_instance.unmark();
		
		let nav = document.getElementById('CS_highLightNavBar');
		
		if ( nav ) nav.parentNode.removeChild(nav);
	}
}, {once: true});

function mark(searchTerms) {

	let phrases = searchTerms.match(/".*?"/g) || [];

	phrases.forEach( (phrase, i) => {
		searchTerms = searchTerms.replace(phrase, "");
		phrases[i] = phrase.replace(/^"(.*)"$/g, "$1");
	});

	let words = searchTerms.trim().split(/\s+/).concat(phrases);

	if ( !userOptions.highLight.markOptions.separateWordSearch )
		words = [e.detail.trim()];

	// sort largest to smallest to avoid small matches breaking larger matches
	words.sort( (a, b) => {return ( a.length > b.length ) ? -1 : 1} );

	words.forEach( (word, i) => {
		CS_MARK_instance.mark(word, {
			className:"CS_mark",
			separateWordSearch: false,
			
			done: () => {
				if ( i !== words.length - 1 ) return;

				document.querySelectorAll(".CS_mark").forEach( el => {
					let index = words.findIndex( word => {
						return word.toLowerCase() === el.textContent.toLowerCase();
					});
					
					 if ( index !== -1 ) el.dataset.style = index > 3 ? index % 4 : index;	
				});
				
				if ( userOptions.highLight.navBar.enabled )
					createNavBar();
				
				if ( userOptions.highLite.findBar.enabled ) 
					createFindBar(searchTerms, document.querySelectorAll(".CS_mark").length);
			}
		});
	});
}
function createNavBar() {

	let hls = document.querySelectorAll('.CS_mark');
	
	if ( ! hls.length ) return;

	let div = document.createElement('div');
	div.id = 'CS_highLightNavBar';
	
	div.style.transform = 'scaleX(' + 1/window.devicePixelRatio + ')';
	
	let img = new Image();
	img.src = browser.runtime.getURL('icons/crossmark.png');
	img.style.transform = 'scaleY(' + 1/window.devicePixelRatio + ')';
	
	img.addEventListener('mousedown', (e) => {
		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation();
	})
	img.addEventListener('mouseup', (e) => {	
		CS_MARK_instance.unmark();
		div.parentNode.removeChild(div);
	});
	
	div.appendChild(img);
	
	let ratio = document.documentElement.clientHeight / document.documentElement.offsetHeight;
	
	function navScrollToHandler(e) {
		document.documentElement.scrollTop = e.clientY / ratio - .5 * document.documentElement.clientHeight;
	}
	
	div.onclick = navScrollToHandler;
	
	div.addEventListener('mousedown', (e) => {
		
		e.preventDefault();
		
		function mouseMoveHandler(_e) {
			_e.preventDefault();
			navScrollToHandler(_e);
		}
		
		document.addEventListener('mousemove', mouseMoveHandler);
		
		document.addEventListener('mouseup', () => {
			document.removeEventListener('mousemove', mouseMoveHandler);
		}, {once:true});
	});
	
	// keep track of markers with the same top offset
	let layers = 0;

	hls.forEach( (hl, index) => {

		let rect = hl.getBoundingClientRect();
		
		let marker = document.createElement('div');

		marker.style.top = rect.top * ratio / document.documentElement.clientHeight * 100 + "vh";
		marker.style.height = rect.height * ratio / document.documentElement.clientHeight * 100 + "vh";

		marker.style.backgroundColor = userOptions.highLight.styles[hl.dataset.style || 0].background;
		
		marker.onclick = function(e) {
			
			e.stopImmediatePropagation();

			let _top = parseFloat(marker.style.top) / ratio;
			navScrollToHandler(e);

			jumpTo(index);
		}
		
		div.appendChild(marker);
		
		// if stacking elements, offset margins
		if ( marker.previousSibling && marker.previousSibling.style.top === marker.style.top )
			marker.style.marginTop = ++layers * 4 + 'px';
		else
			layers = 0;
		
	});
	
	document.body.appendChild(div);

}

function createFindBar(searchTerms, total) {
	let fb = document.createElement('iframe');
	fb.style = 'position:fixed;left:0;right:0;top:0;display:block;height:40px;z-index:2;width:100vw;border:none;border-bottom:1px solid #ccc;';
	fb.id = 'CS_findBarIframe';
	
	document.body.appendChild(fb);
	fb.onload = function() {
		fb.contentWindow.postMessage({searchTerms:searchTerms, index: -1, total:total}, browser.runtime.getURL('/findbar.html'));
	}
	
	fb.src = browser.runtime.getURL("/findbar.html");
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {

	if (typeof message.action === 'undefined') return;
	
	switch (message.action) {

		case "getHighlightStatus":
		
			return Promise.resolve(true);
			break;
	}
});

window.addEventListener("message", (e) => {
	
	function nextPrevious(dir) {
		let marks = document.querySelectorAll('.CS_mark');
		let index = [].findIndex.call(marks, div => div.classList.contains("CS_mark_selected") );

		index += dir;
		
		if ( index < 0 ) index = marks.length - 1;
		if ( index >= marks.length ) index = 0;
		
		jumpTo(index);
	}
	
	switch ( e.data.action ) {
		case "next":
			nextPrevious(1);
			break;
			
		case "previous":
			nextPrevious(-1);
			break;
			
		case "mark":
			CS_MARK_instance.unmark();
			mark(e.data.searchTerms);
			break;
			
	}
	
});

function jumpTo(index) {
	
	document.querySelectorAll('.CS_mark_selected').forEach( _div => _div.classList.remove('CS_mark_selected') );
	
	let marks = document.querySelectorAll('.CS_mark');
	let mark = marks[index];

	mark.classList.add('CS_mark_selected');
	
	let nav = document.getElementById('CS_highLightNavBar');
	if ( nav ) {
		let navdivs = nav.querySelectorAll('div');
		if ( navdivs[index] ) navdivs[index].classList.add('CS_mark_selected');
	}
	
	document.documentElement.scrollTop = mark.offsetTop - .5 * document.documentElement.clientHeight;
	
	let fb = document.getElementById('CS_findBarIframe');
	fb.contentWindow.postMessage({index: index, total: marks.length}, browser.runtime.getURL('/findbar.html'));
}



