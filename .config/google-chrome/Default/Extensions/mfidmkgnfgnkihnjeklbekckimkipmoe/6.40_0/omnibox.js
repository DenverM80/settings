var tab;
var settings;
var ADVANCED = location.pathname.substr(1) === 'omniadvanced.html';
var DISABLED_WARNING = chrome.runtime.getManifest().name + ' is disabled';
DISABLED_WARNING += (ADVANCED ? '.' : ' in your settings.');

function onMenuClick(event)
{
    chrome.runtime.getBackgroundPage(function(page)
    {
        switch (event.relayTarget.id)
        {
            case 'page':
            case 'session':
            case 'whitelist':
            case 'blacklist':
                var enabled;
                if (ADVANCED == false) {
                    enabled = !event.relayTarget.classList.contains('checked');
                    showGlassPane();
                }
                else {
                    enabled = event.relayTarget.checked;
                }
                page.extension.exports.setPermissions({
                    id: tab.id,
                    url: tab.url,
                    type: event.relayTarget.id,
                    enabled: enabled
                });
                if (ADVANCED == false)
                    window.close();
                else
                    loadFrameInfo();
                break;
            case 'extension':
                page.extension.exports.setPermissions({
                    id: tab.id,
                    url: tab.url,
                    type: 'extension',
                    enabled: !event.relayTarget.checked
                });
                loadFrameInfo();
                break;
            case 'counter':
                settings.set('plugincounter', +event.relayTarget.checked);
                break;
            case 'foreground':
                settings.set('tabfocus', (settings.get('tabfocus') & 0x02) | event.relayTarget.checked);
                break;
            case 'background':
                settings.set('tabfocus', (settings.get('tabfocus') & 0x01) | (event.relayTarget.checked << 1));
                break;
            case 'inspect':
                showGlassPane();
                page.extension.exports.openInspectorTool(tab);
                window.close();
                break;
            case 'settings':
            case 'return':
                document.body.classList.toggle('other');
                break;
            case 'options':
                showGlassPane();
                page.extension.exports.openOptionsPage();
                window.close();
                break;
        }
    });
}

function displayWarning(text)
{
    var e = $('info');
    e.textContent = text;
    e.classList.toggle('hidden', !text);
    document.body.classList.toggle('destroy', !!text);
}

function freezeCheckboxState(freeze)
{
    var elms = $a('.mainmenu .menu input[type=checkbox]');
    for (var i = 0; i < elms.length; i++)
    {
        elms[i].removeAttribute('disabled');
        if (!elms[i].checked && freeze)
            elms[i].setAttribute('disabled', '');
    }
}

function checkOption(id, freeze)
{
    ['page', 'session', 'whitelist', 'blacklist'].forEach(function(str) {
        $(str).checked = (str === id) ? true : false;
    });
    freezeCheckboxState(freeze);
}

function loadFrameInfo()
{
    chrome.runtime.getBackgroundPage(function(page)
    {
        var frame = page.extension.exports.getFrameInfo(tab.id);
        if (ADVANCED == false) {
            if (frame.status === 'deny')
            {
                var blacklist = $('blacklist');
                blacklist.classList.remove('hidden');
                blacklist.classList.add('checked');
                $('page').classList.add('hidden');
                $('whitelist').classList.add('hidden');
            }
            else
            {
                var enabled = settings.get('enabled');
                var filtered = $('whitelist').classList.toggle('checked', enabled && (frame.status === 'allow'));
                $('page').classList.toggle('checked', enabled && !filtered && !frame.blocked);
            }
        }
        else {
            if (frame.status === 'allow')
                checkOption('whitelist', true);
            else if (frame.status === 'deny')
                checkOption('blacklist', true);
            else if (frame.session == true)
                checkOption('session', true);
            else if (frame.blocked == false)
                checkOption('page', true);
            else
                checkOption('', false);
        }
        displayWarning(settings.get('enabled') ? '' : DISABLED_WARNING);
    });
}

chrome.runtime.getBackgroundPage(function(page)
{
    settings = page.extension.exports.getSettings();
    $('counter').checked = settings.get('plugincounter') == true;
    $('foreground').checked = settings.get('tabfocus') & 0x01;
    $('background').checked = settings.get('tabfocus') & 0x02;
    $('extension').checked = settings.get('enabled') == false;
    if (settings.get('enabled') == false)
        displayWarning(DISABLED_WARNING);
    chrome.tabs.query({lastFocusedWindow: true, active: true}, function(tabs)
    {
        tab = tabs[0];
        loadFrameInfo();
        if (ADVANCED == true)
            $('hostname').textContent = page.extension.utils.url(tab.url).host;
        relayEvent(document.body, 'change', 'input[type=checkbox]', onMenuClick);
        relayEvent(document.body, 'click', '.menuitem,#return,#options', onMenuClick);
    });
});

initExtensionNames([$q('body > div.submenu > section:nth-child(2) > div:nth-child(4) > label > span')]);
