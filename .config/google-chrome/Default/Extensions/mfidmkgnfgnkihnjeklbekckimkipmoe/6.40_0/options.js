window.addEventListener('message', function(e) {
    if (e.data.event == 'navigation') {
        var manifest = chrome.runtime.getManifest();
        var page = e.data.id;
        document.title = manifest.name + ' - ' + page[0].toUpperCase() + page.substr(1);
        showPage(page, page + '.html');
    }
    else if (e.data.event == 'navigationLoaded')
        postChildMessage('mainmenu', {event: 'changeSelection', id: 'settings'});
    else if (e.data.event == 'relayMessage')
        postChildMessage(e.data.target, e.data.message);
    else if (e.data.event == 'sendToBackground')
        $q('.navigation').classList.add('background');
    else if (e.data.event == 'sendToForeground')
        $q('.navigation').classList.remove('background');
});
