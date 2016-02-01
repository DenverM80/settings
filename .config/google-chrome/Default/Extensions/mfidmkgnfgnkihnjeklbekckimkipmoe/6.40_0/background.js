ext.define('extension.storage', function() {

var messages = extension.messages;

function onChange(changes) {
    chrome.storage.local.set(changes.added);
    chrome.storage.local.remove(changes.removed);
}

return {
    bind: function() {
        messages.listen({
            'change-settings': onChange
        });
    },
    local: chrome.storage.local,
    remote: chrome.storage.sync,
    BYTES_PER_ITEM: chrome.storage.sync.QUOTA_BYTES_PER_ITEM,
    UNIT: 3600000,
    OPS_PER_UNIT: chrome.storage.sync.MAX_WRITE_OPERATIONS_PER_HOUR
};

});
ext.define('extension.preferences', function() {

var utils = extension.utils;
var messages = extension.messages;

var prefs = Object.create(null);
var defaults = Object.freeze({
    'prefs.defaultmode': 0,
    'prefs.contextmenu': 1,
    'prefs.enabled': 1,
    'prefs.flashborder': 0,
    'prefs.flashquality': 0,
    'prefs.idleseconds': 0,
    'prefs.idletabs': 0,
    'prefs.optionsview': 0,
    'prefs.omniicon': 1,
    'prefs.omnialways': 1,
    'prefs.panelbgimage': 'pluginlogo.svg',
    'prefs.panelbgsize': 32,
    'prefs.panelcolor': [65, 65, 65, 1],
    'prefs.paneltooltip': 0,
    'prefs.panelclick': 1,
    'prefs.plugincounter': 0,
    'prefs.showicon': 1,
    'prefs.tabfocus': 0,
    'prefs.toolbar': 0,
    'prefs.toolbarposition': 0
});

function getPref(key) {
    if (typeof key === 'string')
        return prefs[key] != null ? prefs[key] : defaults[key];
    return utils.scan(prefs, defaults);
}

function getChanges() {
    return utils.merge({}, prefs);
}

function setPref(key, value) {
    var p = utils.object(key, value), changes = {};
    for (var k in p) {
        if (k in defaults) {
            var c = {};
            if (k in prefs) {
                if (utils.equals(p[k], prefs[k]))
                    continue;
                c.oldValue = prefs[k];
            }
            if (p[k] == null || utils.equals(p[k], defaults[k])) {
                if (prefs[k] != null)
                    c.oldValue = prefs[k];
                delete prefs[k];
            }
            else
                c.newValue = prefs[k] = p[k];
            if ('oldValue' in c || 'newValue' in c)
                changes[k] = c;
        }
    }
    if (Object.keys(changes).length)
        messages.send('change-settings', utils.diff(changes, getPref()));
}

return {
    bind: function() {
        messages.listen({
            'account-data': setPref
        });
    },
    get: getPref,
    getChanges: getChanges,
    set: setPref
};

});
ext.define('extension.filters', function() {

var utils = extension.utils;
var messages = extension.messages;

var cache = Object.create(null);
var data = Object.create(null);
var defaults = Object.freeze({
    'data.patternlistA': [],
    'data.patternlistC': [],
    'data.patternlistB': [],
    'data.patternlistD': [],
    'data.patternlistE': [],
    'data.patternlistF': []
});

function getEnabledPatterns(filters) {
    var n = [];
    filters.forEach(function(filter) {
        if (filter.enabled)
            n.push(filter.pattern);
    });
    return n;
}

function extractTargets(filters) {
    return getEnabledPatterns(filters).map(utils.regexp);
}

function extractSources(filters) {
    var n = [];
    filters.forEach(function(filter) {
        if (filter.root && filter.enabled) {
            var p = getEnabledPatterns(filter.patterns);
            if (p.length)
                n.push({root: filter.root, patterns: p});
        }
    });
    return n;
}

function getFilter(key) {
    if (typeof key === 'string')
        return data[key] != null ? data[key] : defaults[key];
    return utils.scan(data, defaults);
}

function getChanges() {
    return utils.merge({}, data);
}

function setFilter(key, value) {
    var p = utils.object(key, value), changes = {}, rx = /(patternlist[BDEF])$/;
    for (var k in p) {
        if (k in defaults) {
            var c = {};
            if (k in data) {
                if (utils.equals(p[k], data[k]))
                    continue;
                c.oldValue = data[k];
            }
            if (p[k] == null || utils.equals(p[k], defaults[k])) {
                if (data[k] != null)
                    c.oldValue = data[k];
                cache[k] = defaults[k];
                delete data[k];
            }
            else {
                cache[k] = rx.test(k) ? extractSources(p[k]) : extractTargets(p[k]);
                c.newValue = data[k] = p[k];
            }
            if ('oldValue' in c || 'newValue' in c)
                changes[k] = c;
        }
    }
    if (Object.keys(changes).length)
        messages.send('change-settings', utils.diff(changes, getFilter()));
}

function updateFilter(url, pattern, type, enable) {
    var k;
    switch (type) {
        case 'whitelist': k = 'data.patternlistA'; break;
        case 'blacklist': k = 'data.patternlistC'; break;
    }
    if (k) {
        var h = url.href, r = utils.regexp, f = utils.copy(getFilter(k));
        for (var i = 0; i < f.length; i++) {
            if (r(f[i].pattern).test(h)) {
                f[i].enabled = +enable;
                setFilter(k, f);
                return;
            }
        }
        f.push({enabled: +enable, pattern: pattern});
        setFilter(k, f);
    }
}

function matchSite(key, site) {
    if (key in cache) {
        var c = cache[key];
        for (var i = 0; i < c.length; i++) {
            if (c[i].test(site))
                return c[i];
        }
    }
}

function matchSelective(key, site) {
    var n = [];
    if (key in cache) {
        var c = cache[key], r = utils.regexp;
        c.forEach(function(filter) {
            if (r(filter.root).test(site))
                n = n.concat(filter.patterns);
        });
    }
    return n;
}

function matchGlobal(key) {
    return key in cache ? cache[key] : {};
}

function matchSiteWhitelist(str) {
    return matchSite('data.patternlistA', str);
}

function matchSiteBlacklist(str) {
    return matchSite('data.patternlistC', str);
}

function matchSiteSelective(str) {
    return [
        matchSelective('data.patternlistB', str),
        matchSelective('data.patternlistD', str),
        matchGlobal('data.patternlistE'),
        matchGlobal('data.patternlistF')
    ];
}

return {
    bind: function() {
        messages.listen({
            'account-data': setFilter
        });
    },
    get: getFilter,
    getChanges: getChanges,
    set: setFilter,
    update: updateFilter,
    matchWhitelist: matchSiteWhitelist,
    matchBlacklist: matchSiteBlacklist,
    matchSelective: matchSiteSelective
};

});
ext.define('extension.sync', function() {

var utils = extension.utils;
var messages = extension.messages;
var storage = extension.storage;

var sync = Object.create(null);
var defaults = Object.freeze({
    'sync.enabled': 0,
    'sync.filters': 1,
    'sync.settings': 1
});

var opqueue = utils.opqueue(storage.UNIT, storage.OPS_PER_UNIT);
opqueue.tick = Date.now();

function onChange(changes) {
    if (getPref('sync.enabled'))
        sendChanges(filterDiff(changes));
}

function checkSafeItemSize(key, value) {
    return function(pass) {
        storage.local.getBytesInUse(key, function(bytes) {
            if (bytes <= storage.BYTES_PER_ITEM)
                pass(key, value)
            else {
                debug("Can't sync " + key + ": Item too large.");
                pass();
            }
        });
    }
}

function debug(str) {
    if (typeof str === 'string' ? str : chrome.runtime.lastError)
        console.warn('[%s] %s', utils.time(), str || chrome.runtime.lastError.message);
}

function setRemote(items) {
    opqueue.put(function() {
        storage.local.get(Object.keys(items), function(data) {
            var d = {}, t = [];
            for (var k in data)
                t.push(checkSafeItemSize(k, data[k]));
            utils.iterate(t, function(key, value) {d[key] = value;}, function() {
                storage.remote.set(d, debug);
            });
        });
    });
}

function removeRemote(items) {
    opqueue.put(function() {
        storage.local.get(items, function(data) {
            storage.remote.remove(items.filter(function(item) {
                return !data.hasOwnProperty(item);
            }), debug);
        });
    });
}

function filterPattern() {
    var f = ['(?!sync)'];
    if (getPref('sync.settings'))
        f.push('prefs');
    if (getPref('sync.filters'))
        f.push('data');
    return '/^(' + f.join('|') + ')\\./';
}

function filterChanges(changes) {
    var d = {}, c = filterData(changes);
    for (var k in c)
        d[k] = c[k].newValue;
    return d;
}

function filterDiff(changes) {
    var f = filterPattern();
    return {
        added: utils.grep(f, changes.added),
        removed: utils.grep(f, changes.removed)
    };
}

function filterData(items) {
    return utils.grep(filterPattern(), items);
}

function updateAccount(items) {
    if (Object.keys(items).length)
        messages.send('account-data', items);
}

function sendChanges(changes) {
    if (Object.keys(changes.added).length)
        setRemote(changes.added);
    if (changes.removed.length)
        removeRemote(changes.removed);
}

function retreiveChanges(items) {
    var k = Object.keys(items);
    if (k.length)
        storage.remote.get(k, updateAccount);
}

function getPref(key) {
    if (typeof key === 'string')
        return sync[key] != null ? sync[key] : defaults[key];
    return utils.scan(sync, defaults);
}

function setPref(key, value) {
    var p = utils.object(key, value), changes = {};
    for (var k in p) {
        if (k in defaults) {
            var c = {};
            if (k in sync) {
                if (utils.equals(p[k], sync[k]))
                    continue;
                c.oldValue = sync[k];
            }
            if (p[k] == null || utils.equals(p[k], defaults[k])) {
                if (sync[k] != null)
                    c.oldValue = sync[k];
                delete sync[k];
            }
            else
                c.newValue = sync[k] = p[k];
            if ('oldValue' in c || 'newValue' in c)
                changes[k] = c;
        }
    }
    if (Object.keys(changes).length)
        messages.send('change-settings', utils.diff(changes, getPref()));
}

function pullRemote(items) {
    if (getPref('sync.enabled'))
        retreiveChanges(filterData(items));
}

function pushRemote(items) {
    if (getPref('sync.enabled'))
        sendChanges({ added: filterData(items), removed: [] });
}

function mergeAccount(items) {
    if (getPref('sync.enabled'))
        updateAccount(filterChanges(items));
}

return {
    bind: function() {
        messages.listen({
            'change-settings': onChange
        });
    },
    get: getPref,
    set: setPref,
    pull: pullRemote,
    push: pushRemote,
    merge: mergeAccount
};

});
ext.define('extension.sessions', function() {

var origins = [];

function hasOrigin(url) {
    return origins.indexOf(url.origin) !== -1;
}

function addOrigin(url, enable) {
    var i = origins.indexOf(url.origin);
    if (enable) i === -1 && origins.push(url.origin);
    else i !== -1 && origins.splice(i, 1);
}

return {
    get: hasOrigin,
    set: addOrigin
};

});
(function() {

var utils = extension.utils;
var messages = extension.messages;
var preferences = extension.preferences;
var sessions = extension.sessions;
var filters = extension.filters;
var storage = extension.storage;
var sync = extension.sync;

var CRVERSION = navigator.userAgent.match(/\bChrome\/(\d+)/), CRVERSION = CRVERSION ? parseInt(CRVERSION[1], 10) : -1;
var BLOCK = 'window.FlashControl && FlashControl("block",{0})\n//@ sourceURL=injected';
var STATUS = 'window.FlashControl && FlashControl("{0}",{1})\n//@ sourceURL=injected';
var CHECK = 'window.FlashControl && FlashControl("validate")\n//@ sourceURL=injected';

var currentTabId = -1;
var currentWindowId = -1;
var pageactionImages = Object.create(null);
var extensionReady = utils.event();
var extensionName = chrome.runtime.getManifest().name;

var sharedFrameConfig = Object.create(null);
var frameObj = Object.create(null);
frameObj.toString = function() {
    return JSON.stringify(this);
};

var frameMap = Object.create(null);
frameMap[-1] = Object.freeze(createFrameInstance('destroy', 'about:blank', false));

function handleIdleState(state) {
    if (state === 'idle') {
        console.log("[%s] %s", utils.time(), "entering idle mode");
        chrome.tabs.query({url: '*://*/*'}, function(tabs) {
            var activeTabsOnly = preferences.get('prefs.idletabs');
            tabs.forEach(function(tab) {
                if (activeTabsOnly && tab.active)
                    return;
                blockIsolatedWorlds(tab.id, true);
                updateOmniboxMenu(tab);
            });

            updateContextMenu();
        });
    }
}

function waitForIdleState(seconds) {
    chrome.idle.onStateChanged.removeListener(handleIdleState);
    if (seconds > 0) {
        chrome.idle.onStateChanged.addListener(handleIdleState);
        chrome.idle.setDetectionInterval(Math.max(seconds, 60));
    }
}

function setFramePermission(permission) {
    switch (permission.type) {
        case 'extension':
            preferences.set('prefs.enabled', +permission.enabled);
            break;
        case 'whitelist':
        case 'blacklist':
            var url = utils.url(permission.url);
            filters.update(url, url.host, permission.type, permission.enabled);
            chrome.tabs.query({url: '*://' + url.hostname + '/*'}, function(tabs) {
                tabs.forEach(loadIsolatedWorlds);
                tabs.forEach(updateOmniboxMenu);
                updateContextMenu();
            });
            break;
        case 'session':
            var url = utils.url(permission.url);
            sessions.set(url, permission.enabled);
            chrome.tabs.query({url: url.protocol + '//' + url.hostname + '/*'}, function(tabs) {
                tabs.forEach(updateSession);
                tabs.forEach(updateOmniboxMenu);
                updateContextMenu();
            });
            break;
        case 'page':
            blockIsolatedWorlds(permission.id, !frameMap[permission.id].blocked);
            updateOmniboxMenu(permission);
            updateContextMenu(permission);
            break;
    }
}

function getFrameDetails(tabId) {
    var frame = frameMap[tabId];
    var copy = utils.copy(frame);
    copy.session = sessions.get(frame.url);
    return copy;
}

function getSettingsAdapter() {
    return utils.adapter(preferences, 'prefs.');
}

function getFiltersAdapter() {
    return utils.adapter(filters, 'data.');
}

function getSyncAdapter() {
    return utils.adapter(sync, 'sync.');
}

function openTabInspector(tab) {
    var path = chrome.runtime.getURL('inspector.html');
    var url = path + '#' + tab.id;
    chrome.tabs.query({url: path}, function(tabs) {
        for (var i = 0; i < tabs.length; i++) {
            if (tabs[i].url === url) {
                chrome.windows.update(tabs[i].windowId, {focused: true});
                return;
            }
        }
        chrome.windows.create({
            width: 700,
            height: 470,
            type: 'popup',
            focused: true,
            url: url
        });
    });
}

function openOptionsPage() {
    var path = chrome.runtime.getURL('options.html');
    chrome.tabs.query({url: path}, function(tabs) {
        if (tabs.length > 0)
            chrome.tabs.update(tabs[0].id, {active: true});
        else
            chrome.tabs.create({active: true, url: path});
    });
}

function runTabScript(tabId, details, isCSS) {
    if (frameMap[tabId] !== frameMap[-1]) {
        var injectDetails = {allFrames: true};
        if (CRVERSION > 36)
            injectDetails.matchAboutBlank = true;
        injectDetails = utils.merge(injectDetails, details);
        if (isCSS)
            chrome.tabs.insertCSS(tabId, injectDetails);
        else
            chrome.tabs.executeScript(tabId, injectDetails);
    }
}

function createFrameInstance(status, url, blocked) {
    return Object.create(frameObj, {
        url: {
            value: utils.url(url)
        },
        blocked: {
            configurable: true,
            enumerable: true,
            writable: true,
            value: blocked
        },
        status: {
            enumerable: true,
            value: status
        },
        found: {
            writable: true,
            value: 0
        },
        icon: {
            value: document.createElement('canvas')
        }
    });
}

function updateFrame(tab) {
    var frame;
    var url = tab.url;
    if (!utils.permitted(url))
        frame = frameMap[-1];
    else if (!preferences.get('prefs.enabled'))
        frame = createFrameInstance('destroy', url, false);
    else if (filters.matchWhitelist(url)) {
        frame = createFrameInstance('allow', url, false);
        frame.preferences = sharedFrameConfig;
    }
    else if (filters.matchBlacklist(url))
        frame = createFrameInstance('deny', url, true);
    else {
        frame = createFrameInstance('capture', url, true);
        frame.blocked = isTabBlocked(tab);
        frame.preferences = sharedFrameConfig;
        frame.filterset = filters.matchSelective(url);
    }
    return frameMap[tab.id] = frame;
}

function getFrame(tabId) {
    return frameMap[tabId] || (frameMap[tabId] = createFrameInstance('', 'about:blank', false));
}

function updateIsolatedWorlds(tab) {
    updateFrame(tab);
    loadIsolatedWorlds(tab);
}

function loadIsolatedWorlds(tab) {
    var frame = frameMap[tab.id];
    runTabScript(tab.id, {code: utils.format(STATUS, frame.status, frame)});
}

function blockIsolatedWorlds(tabId, blocked) {
    frameMap[tabId].blocked = blocked;
    runTabScript(tabId, {code: utils.format(BLOCK, blocked)});
}

function updateSession(tab) {
    blockIsolatedWorlds(tab.id, !sessions.get(frameMap[tab.id].url));
}

function isTabBlocked(tab) {
    var flags = preferences.get('prefs.tabfocus');
    if (flags == 0) {
        var allowedSession = sessions.get(utils.url(tab.url));
        return preferences.get('prefs.defaultmode') ? allowedSession : !allowedSession;
    }
    if (flags & 0x01 && tab.active) return false;
    if (flags & 0x02 && !tab.active) return true;
}

function addContextmenuItem(menu) {
    chrome.contextMenus.create(utils.merge({
        contexts: ['page', 'frame'],
        onclick: onContextMenu
    }, menu));
}

function loadContextMenu() {
    chrome.contextMenus.removeAll(function() {
        if (!preferences.get('prefs.contextmenu'))
            return;
        var menus = [];
        var advancedUI = preferences.get('prefs.optionsview') > 0;
        var matches = ['*://*/*'];
        menus.push({id: 'page', title: 'Allow Flash on this page', type: 'checkbox', documentUrlPatterns: matches});
        if (advancedUI)
            menus.push({id: 'session', title: 'Allow this session', type: 'checkbox', documentUrlPatterns: matches});
        menus.push({id: 'whitelist', title: 'Always allow Flash on this site', type: 'checkbox', documentUrlPatterns: matches});
        if (advancedUI)
            menus.push({id: 'blacklist', title: 'Forbid this site', type: 'checkbox', documentUrlPatterns: matches});
        menus.push({type: 'separator', documentUrlPatterns: matches});
        if (advancedUI) {
            menus.push({id: 'inspector', title: 'Inspect this tab', documentUrlPatterns: matches});
            menus.push({type: 'separator', documentUrlPatterns: matches});
        }
        menus.push({id: 'extension', title: 'Disable', type: 'checkbox'});
        menus.push({id: 'options', title: 'Settings'});
        menus.forEach(addContextmenuItem);
        updateContextMenu();
    });
}

//TODO update
function updateContextMenu(tab) {
    chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
        windowId: currentWindowId
    }, function(tabs) {
        if (tabs.length === 0 || ((tab != null) && (tabs[0].id != tab.id)))
            return;
        var f = frameMap[tabs[0].id];
        var x = f !== frameMap[-1];
        var e = preferences.get('prefs.enabled') == 1;
        var a = preferences.get('prefs.optionsview') > 0;
        var v = x && e;
        var b = f.status === 'deny';
        var w = f.status === 'allow';
        var h = (a ? f.url.host : 'this site') || '...';
        chrome.contextMenus.update('page', {
            enabled: v && !b && !w,
            checked: x && !f.blocked,
            title: a ? 'Allow this page' : 'Allow Flash on this page'
        });
        chrome.contextMenus.update('whitelist', {
            enabled: v && !b,
            checked: x && w,
            title: utils.format('{0} {1}', a ? 'Allow' : 'Always allow Flash on', h)
        });
        if (a) {
            chrome.contextMenus.update('session', {
                enabled: v && !w && !b,
                checked: x && sessions.get(f.url)
            });
            chrome.contextMenus.update('blacklist', {
                enabled: v && !w,
                checked: x && b,
                title: utils.format('{0} {1}', 'Forbid', h)
            });
            chrome.contextMenus.update('inspector', {
                enabled: x
            });
        }
        chrome.contextMenus.update('extension', {
            checked: !e
        });
    });
}

function generateIconImagedata(canvas, details) {
    var size = canvas.width = canvas.height = details.size;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(details.image, 0, 0, size, size);
    if (details.text) {
        var padding = 2;
        var height = details.font + padding * 2;
        var width = Math.min(size, ctx.measureText(details.text).width + padding * 2);
        var left = size - width;
        var top = size - height + 3;// (Lnx) 3px adjustment
        var fill = ctx.createLinearGradient(0, 9, 0, 13);
        fill.addColorStop(0, '#888');
        fill.addColorStop(1, '#333');
        ctx.fillStyle = fill;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(left, top, width, height);
        ctx.fillRect(left, top, width, height);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold ' + details.font + 'px Arial';
        ctx.fillText(details.text, left + padding, size - padding, size);
    }
    return ctx.getImageData(0, 0, size, size);
}

function createIconImagedata(frame) {
    var name = (frame.blocked ? frame.status : (frame.status == 'capture' ? 'allow' : frame.status)) + '.svg';
    var image = pageactionImages[name];
    var text = (preferences.get('prefs.plugincounter') && (frame.found > 0)) ? frame.found : '';
    return {
        19: generateIconImagedata(frame.icon, {size: 19, image: image, text: text, font: 10}),
        38: generateIconImagedata(frame.icon, {size: 38, image: image, text: text, font: 20})
    };
}

function updateOmniboxMenu(tab) {
    var tabId = tab.id;
    var frame = frameMap[tabId];
    if (frame === frameMap[-1] || !preferences.get('prefs.omniicon')) {
        tabId !== -1 && chrome.pageAction.hide(tabId);
        return;
    }
    if (!preferences.get('prefs.enabled') || preferences.get('prefs.omnialways') || frame.found) {
        chrome.pageAction.setIcon({
            tabId: tabId,
            imageData: createIconImagedata(frame)
        });
        chrome.pageAction.setPopup({
            tabId: tabId,
            popup: preferences.get('prefs.optionsview') == 0 ? 'omnisimple.html' : 'omniadvanced.html'
        });
        chrome.pageAction.show(tabId);
    }
    else
        chrome.pageAction.hide(tabId);
}

function updateIsolatedWorldConfig() {
    sharedFrameConfig.toolbar = preferences.get('prefs.toolbar');
    sharedFrameConfig.toolbarposition = preferences.get('prefs.toolbarposition');
    sharedFrameConfig.paneltooltip = preferences.get('prefs.paneltooltip');
    sharedFrameConfig.flashquality =
        ['', 'low', 'autolow', 'autohigh', 'medium', 'high', 'best'][preferences.get('prefs.flashquality')];
    sharedFrameConfig.placeholder = createPlaceholder(preferences.getChanges());
    sharedFrameConfig.panelclick = preferences.get('prefs.panelclick');
}

function updateUserAccount() {
    sync.pull(utils.merge(filters.get(), preferences.get()));
    sync.push(utils.merge(filters.getChanges(), preferences.getChanges()));
}

function createPlaceholder(config) {
    var css = {panel: '', toolbar: ''};
    if ('prefs.panelcolor' in config) {
        var color = config['prefs.panelcolor'];
        css.panel += utils.format('background-color:rgba({0},{1},{2},{3});',
            color[0], color[1], color[2], color[3].toFixed(1));
    }
    if (config['prefs.showicon'] === 0)
        css.panel += 'background-image:none;';
    else {
        if ('prefs.panelbgimage' in config)
            css.panel += utils.format('background-image:url({0}/{1});',
                chrome.runtime.getURL('graph'), config['prefs.panelbgimage']);
        if ('prefs.panelbgsize' in config)
            css.panel += utils.format('background-size:{0}px;', config['prefs.panelbgsize']);
    }
    if ('prefs.flashborder' in config) {
        var color = config['prefs.panelcolor'] || ['0', '0', '0'];
        css.panel += utils.format('outline:rgb({0},{1},{2}) solid 1px;',
            color[0], color[1], color[2]);
    }
    switch (config['prefs.toolbarposition']) {
        case 3: css.toolbar += 'right:0;bottom:0;'; break;
        case 2: css.toolbar += 'left:0;bottom:0;'; break;
        case 1: css.toolbar += 'top:0;right:0;'; break;
    }
    return css;
}

function onTabCreated(tab) {
    frameMap[tab.id] = frameMap[-1];
}

function onTabUpdated(tabId, info, tab) {
    switch (info.status) {
        case 'loading':
            if (getFrame(tabId).url.href != tab.url) {
                updateFrame(tab);
                runTabScript(tabId, {code: CHECK, allFrames: false});
            }
            getFrame(tabId).found = 0;
            updateOmniboxMenu(tab);
            break;
        case 'complete':
            updateContextMenu(tab);
            break;
        case 'replaced':
            updateIsolatedWorlds(tab);
            updateOmniboxMenu(tab);
            updateContextMenu(tab);
            break;
    }
}

function onTabReplaced(newTabId, oldTabId) {
    onTabRemoved(oldTabId, {});
    chrome.tabs.get(newTabId, function(tab) {
        onTabUpdated(tab.id, {status: 'replaced'}, tab);
    });
}

function onTabRemoved(tabId, details) {
    delete frameMap[tabId];
    if (tabId == currentTabId)
        currentTabId = -1;
}

function onTabActivated(details) {
    var info = {id: details.tabId};
    if (frameMap[info.id]) {
        var flags = preferences.get('prefs.tabfocus');
        if (flags & 0x01) {
            blockIsolatedWorlds(info.id, false);
            updateOmniboxMenu(info);
        }
        if (flags & 0x02) {
            blockIsolatedWorlds(currentTabId, true);
            updateOmniboxMenu(info);
        }
        currentTabId = info.id;
        updateContextMenu(info);
    }
}

function onWindowFocused(winId) {
    if (winId != chrome.windows.WINDOW_ID_NONE) {
        currentWindowId = winId;
        updateContextMenu();
    }
}

function onStorageChanged(data, area) {
    if (area === 'sync')
        sync.merge(data);
}

function onRuntimeMessage(request, sender, response) {
    var tab = sender.tab;
    if (tab) {
        switch (request.type) {
            case 'status':
                response(frameMap[tab.id]);
                break;
            case 'audit':
                if (frameMap[tab.id]) {
                    frameMap[tab.id].found += !request.info.indexed;
                    updateOmniboxMenu(tab);
                }
                break;
            case 'update':
                loadIsolatedWorlds(tab);
                updateContextMenu(tab);
                break;
        }
    }
}

function onRuntimeInstalled() {
    chrome.tabs.query({url: '*://*/*'}, function(tabs) {
        tabs.forEach(function(tab) {
            runTabScript(tab.id, {file: 'panel.css'}, true);
            runTabScript(tab.id, {file: 'content.js'});
        });
    });
}

function onRuntimeUpdated(v) {
}

function onSettingsChanged(changes) {
    var values = changes.values;
    for (var key in values) {
        switch (key) {
            case 'prefs.enabled':
                chrome.tabs.query({url: '*://*/*'}, function(tabs) {
                    tabs.forEach(function(tab) {
                        var embedCount = getFrame(tab.id).found;
                        updateIsolatedWorlds(tab);
                        getFrame(tab.id).found = embedCount;
                    });
                    tabs.forEach(updateOmniboxMenu);
                    loadContextMenu();
                });
                break;
            case 'prefs.omniicon':
            case 'prefs.omnialways':
            case 'prefs.plugincounter':
                chrome.tabs.query({url: '*://*/*'}, function(tabs) {
                    tabs.forEach(updateOmniboxMenu);
                });
                break;
            case 'prefs.optionsview':
                chrome.tabs.query({url: '*://*/*'}, function(tabs) {
                    tabs.forEach(updateOmniboxMenu);
                });
            case 'prefs.contextmenu':
                loadContextMenu();
                break;
            case 'prefs.toolbar':
            case 'prefs.toolbarposition':
            case 'prefs.flashborder':
            case 'prefs.panelcolor':
            case 'prefs.showicon':
            case 'prefs.panelbgimage':
            case 'prefs.panelbgsize':
            case 'prefs.paneltooltip':
            case 'prefs.panelclick':
            case 'prefs.flashquality':
                updateIsolatedWorldConfig();
                break;
            case 'prefs.idleseconds':
                waitForIdleState(values[key]);
                break;
            case 'data.patternlistA':
            case 'data.patternlistB':
            case 'data.patternlistC':
            case 'data.patternlistD':
            case 'data.patternlistE':
            case 'data.patternlistF':
            case 'prefs.defaultmode':
                chrome.tabs.query({url: '*://*/*'}, function(tabs) {
                    tabs.forEach(function(tab) {
                        var embedCount = getFrame(tab.id).found;
                        updateFrame(tab).found = embedCount;
                    });
                });
                break;
            case 'sync.enabled':
            case 'sync.settings':
            case 'sync.filters':
                updateUserAccount();
                break;
        }
    }
}

function onContextMenu(info, tab) {
    switch (info.menuItemId) {
        case 'page':
        case 'session':
        case 'whitelist':
        case 'blacklist':
            setFramePermission({
                id: tab.id,
                url: info.pageUrl,
                type: info.menuItemId,
                enabled: info.checked
            });
            break;
        case 'extension':
            setFramePermission({
                id: tab.id,
                url: info.pageUrl,
                type: info.menuItemId,
                enabled: info.wasChecked
            });
            break;
        case 'inspector':
            openTabInspector(tab);
            break;
        case 'options':
            openOptionsPage();
            break;
    }
}

chrome.runtime.onInstalled.addListener(function(details) {
    extensionReady.addListener(function() {
        if (details.reason === 'install')
            messages.send('install-runtime');
        if (details.reason === 'update')
            messages.send('update-runtime');
    });
});

utils.series([
    function(pass) {
        utils.process([
            function(pass) {
                storage.local.get(preferences.get(), function(data) {
                    preferences.set(data);
                    pass();
                });
            },
            function(pass) {
                storage.local.get(filters.get(), function(data) {
                    filters.set(data);
                    pass();
                });
            },
            function(pass) {
                storage.local.get(sync.get(), function(data) {
                    sync.set(data);
                    pass();
                });
            }],
            pass
        );
    },
    function(pass) {
        var loadImg = function(path, size) {
            return function(pass) {
                var image = pageactionImages[path] = new Image(size, size);
                image.src = 'graph/' + path;
                image.onload = pass;
            }
        };
        utils.process([
            loadImg('capture.svg', 48),
            loadImg('allow.svg', 48),
            loadImg('deny.svg', 48),
            loadImg('destroy.svg', 48)],
            pass
        );
    },
    function(pass) {
        utils.process([
            function(pass) {
                updateIsolatedWorldConfig();
                chrome.tabs.query({}, function(tabs) {
                    tabs.forEach(updateIsolatedWorlds);
                    tabs.forEach(updateOmniboxMenu);
                    pass();
                });
            },
            function(pass) {
                chrome.tabs.query({lastFocusedWindow: true, active: true}, function(tabs) {
                    if (tabs.length > 0) {
                        currentWindowId = tabs[0].windowId;
                        currentTabId = tabs[0].id;
                    }
                    pass();
                });
            }],
            pass
        );
    }],
    function() {
        chrome.tabs.onCreated.addListener(onTabCreated);
        chrome.tabs.onUpdated.addListener(onTabUpdated);
        chrome.tabs.onReplaced.addListener(onTabReplaced);
        chrome.tabs.onRemoved.addListener(onTabRemoved);
        chrome.tabs.onActivated.addListener(onTabActivated);
        chrome.windows.onFocusChanged.addListener(onWindowFocused);
        chrome.storage.onChanged.addListener(onStorageChanged);
        chrome.runtime.onMessage.addListener(onRuntimeMessage);

        storage.bind();
        preferences.bind();
        filters.bind();
        sync.bind();
        messages.listen({
            'change-settings': onSettingsChanged,
            'install-runtime': onRuntimeInstalled,
            'update-runtime': onRuntimeUpdated
        });

        loadContextMenu();
        updateUserAccount();
        waitForIdleState(preferences.get('prefs.idleseconds'));

        extension.exports = {
            setPermissions: setFramePermission,
            getFrameInfo: getFrameDetails,
            getSettings: getSettingsAdapter,
            getFilters: getFiltersAdapter,
            getSync: getSyncAdapter,
            openInspectorTool: openTabInspector,
            openOptionsPage: openOptionsPage,
            mergeAccountData: updateUserAccount
        };

        extensionReady.fire();
    }
);

extension.ready = extensionReady;

})();
