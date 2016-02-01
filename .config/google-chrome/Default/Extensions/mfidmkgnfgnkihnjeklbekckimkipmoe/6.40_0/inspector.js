ext.define('extension.utils', function() {

var strings = {
    REQCNT: '{0} Flash resource{1} found.',
    PTRNDUP: 'Error: Duplicate pattern: {0}',
    LIVEMODE: '{0} Live Filtering',
    REGEXMODE: '{0} regex',
    CLPSMODE: '{0} console'
};

function mapKeyword(str) {
    return {
        'blacklisted': 'denied',
        'whitelisted': 'allowed',
        'gblacklisted': 'denied',
        'gwhitelisted': 'allowed',
        'sameDomain': 'same domain',
        'patternlistB': 'white',
        'patternlistD': 'black'
    }[str] || str;
}

function showOverlay(message, where) {
    var n = $q(where);
    var e = n.querySelectorAll('.message-panel');
    for (var i = 0; i < e.length; i++)
        e[i].parentNode.removeChild(e[i]);
    if (message) {
        e = $x('message');
        e.querySelector('.text').textContent = message;
        if (n.firstElementChild)
            n.insertBefore(e, n.firstElementChild);
        else
            n.appendChild(e);
    }
}

function showGlass(axis, onmousemove) {
    var g = document.createElement('div');
    g.className = 'glass-pane resize-' + axis;
    document.body.appendChild(g);
    document.addEventListener('mouseup', function _mu(e) {
        document.removeEventListener('mouseup', _mu);
        document.removeEventListener('mousemove', onmousemove);
        document.body.removeChild(g);
    });
    document.addEventListener('mousemove', onmousemove);
}

function showSummary(cls, text, query) {
    var n = $q(query);
    n.textContent = '';
    if (cls) {
        var e = document.createElement('div');
        e.className = cls;
        n.appendChild(e);
    }
    n.appendChild(document.createTextNode(text));
}

function toggleActive(element, tmpl, toggle) {
    var b = element.classList.toggle('active');
    var a = toggle || ['Disable', 'Enable'];
    element.setAttribute('title', extension.utils.format(strings[tmpl], a[+!b]));
    return b;
}

return {
    stringMap: mapKeyword,
    strings: strings,
    overlay: showOverlay,
    glass: showGlass,
    summary: showSummary,
    toggle: toggleActive
};

});
ext.define('extension.animation', function() {

function easeLinear(timediff, base, change, duration) {
    return change * timediff / duration + base;
}

function initialize(elem, time) {
    var value, attr, obj, answer = [], fromValue;
    elem.fx.start = time;
    elem.fx.from = [];
    for (attr in elem.fx.queue[0].attr) {
        value = elem.fx.queue[0].attr[attr];
        if (typeof value !== 'object') {
            obj = {};
            obj.value = value;
            obj.unit = 'px';
            value = obj;
        }
        else
            value.unit = value.unit !== undefined ? value.unit : 'px';
        fromValue = parseFloat(window.getComputedStyle(elem, null)[attr]);
        elem.fx.from[elem.fx.from.length] = isNaN(fromValue) ? 0 : fromValue;
        value.attr = attr;
        answer[answer.length] = value;
    }
    elem.fx.queue[0].attr = answer;
}

function step(elem) {
    var timediff = Date.now() - elem.fx.start,
        current = elem.fx.queue[0],
        duration = current.duration,
        style = ';',
        i = 0,
        row, value, from;
    duration < timediff && (timediff = duration);
    for (; i < elem.fx.queue[0].attr.length; i++) {
        row = elem.fx.queue[0].attr[i];
        from = elem.fx.from[i];
        value = current.easing(timediff, from, row.value - from, duration);
        style += row.attr + ':' + value + row.unit + ';';
    }
    elem.style.cssText += style;
    if (duration === timediff) {
        if (typeof elem.fx.queue[0].callback === 'function')
            elem.fx.queue[0].callback.call(elem);
        elem.fx.queue.shift();
        if (elem.fx.queue.length === 0) {
            elem.fx = false;
            return;
        }
        else
            initialize(elem, elem.fx.start + timediff);
    }
    elem.fx.timer = window.setTimeout(step, 30, elem);
};

function stop(element) {
    var elem = element;
    if (elem.fx && elem.fx.timer) {
        window.clearTimeout(elem.fx.timer);
        elem.fx = false;
    }
    return elem;
}

function start(element, attributes, options) {
    var elem = element, newRow = {};
    var opts = options || {};
    newRow.attr = attributes;
    newRow.callback = opts.callback;
    newRow.duration = opts.duration || 1000;
    newRow.easing = opts.easing || easeLinear;
    if (elem.fx)
        elem.fx.queue.push(newRow);
    else {
        elem.fx = {};
        elem.fx.queue = [newRow];
        initialize(elem, Date.now());
        elem.fx.timer = window.setTimeout(step, 30, elem);
    }
    return elem;
}

return {
    stop: stop,
    start: start
};

});
ext.define('extension.slider', function() {

var animation = extension.animation;

function easing(timediff, base, change, duration) {
    var v = (timediff === duration) ? base + change : change *
        (-Math.pow(2, -10 * timediff / duration) + 1) + base;
    return v;
}

//     bounds(x/z) based on width/height properties.
//     100% --- 0%
//      |
//      |
//      0%
function descriptor(e) {
    var o = {};
    if (e.target.classList.contains('vertical-split')) {
        var length = 0 | e.target.offsetWidth;
        o.bbox = e.target.parentNode.offsetWidth;
        o.mouse = length + e.target.offsetLeft - e.clientX;
        o.axis = 'clientX';
        o.prop = 'right';
        o.s = 'previousElementSibling';
        o.c = o.bbox;
    }
    if (e.target.classList.contains('horizontal-split')) {
        var length = 0 | e.target.offsetHeight;
        o.bbox = e.target.parentNode.offsetHeight;
        o.mouse = length + e.target.offsetTop - e.clientY;
        o.axis = 'clientY';
        o.prop = 'bottom';
        o.s = 'nextElementSibling';
        o.c = 0;
    }
    o.x = 0 | (e.target.dataset.min * o.bbox / 100);
    o.z = 0 | (e.target.dataset.max * o.bbox / 100);
    return o;
}

function slide(e, p, c) {
    var u = {};
    u['flex-basis'] = {value: p, unit: 'px'};
    animation.start(e, u, {
        duration: 300,
        callback: c,
        easing: easing
    });
}

function collapseNextSibling(e, c) {
    e.dataset.pos = e.parentNode.offsetHeight - (e.offsetTop + e.offsetHeight);
    slide(e.nextElementSibling, 0, c);
}

function expandNextSibling(e, c) {
    var d = descriptor({target: e, clientY: 0});
    var p = Math.min(d.z, Math.max(d.x, e.dataset.pos));
    slide(e.nextElementSibling, p, c);
}

function createSlider(e) {
    var n = e.target;
    var d = descriptor(e);
    var s = n[d.s].style;
    return function(e) {
        var p = Math.max(d.x, Math.min(d.z, d.bbox - e[d.axis] - d.mouse));
        s['flex-basis'] = (d.c > 0 ? d.c - p : p) + 'px';
    }
}

return {
    create: createSlider,
    expand: expandNextSibling,
    collapse: collapseNextSibling
};

});
ext.define('extension.requestview', function() {

var messages = extension.messages;
var utils = extension.utils;
var slider = extension.slider;
var requests = {};
var dirty = false;

function requestinfo(elm) {
    return function(name, value, cls) {
        var l = $x('prop');
        l.querySelector('.prop-info-name').textContent = name;
        l.querySelector('.prop-info-value').textContent = value;
        if (cls)
            l.querySelector('.prop-info-value').className += cls;
        elm.appendChild(l);
    };
}

function onReferrer(e) {
    if (e.relayTarget.classList.contains('selected'))
        return;

    updateRequestList(e.relayTarget.textContent);

    e.currentTarget.querySelector('.selected').classList.remove('selected');
    e.relayTarget.classList.add('selected');

    utils.overlay('', '#resources .view:last-child');
}

function onRequest(e) {
    var origin = $('referrer').querySelector('.selected').textContent;
    var data = requests[origin][getChildPosition(e.relayTarget)];
    var ol = $x('info');
    var info = requestinfo(ol.querySelector('ol'));
    var url = utils.url(data['src']);
    info('URL:', url.href);
    info('Status:', utils.stringMap(data['status']), ' status-icon status-' + data['status']);
    info('Host:', url.host);
    info('Referer:', data['ref']);
    info('Width:', data['width']);
    info('Height:', data['height']);
    info('Type:', data['type']);
    info('ScriptAccess:', data['access']);
    info('Flash Vars:', data['vars']);
    $('resources').querySelector('.view:last-child').appendChild(ol);
}

function onClear(e) {
    utils.overlay('', '#resources .view:last-child');
}

function onStatusbar(e) {
    if (e.relayTarget.classList.contains('statusbar-reload'))
        messages.send('requests-reload');
}

function onSlide(e) {
    e.preventDefault();
    utils.glass('x', slider.create(e));
}

function updateRefererList(origin) {
    var l = document.createElement('li');
    l.className = 'list-item';
    l.textContent = origin;
    if (getChildPosition($('referrer').appendChild(l)) === 0)
        l.classList.add('selected');
}

function updateRequestList(origin) {
    var r = $('request');
    r.textContent = '';
    var t, u, v = requests[origin];
    for (var i = 0; i < v.length; i++) {
        t = $x('request');
        l = t.querySelector('.list-item');
        l.classList.add('status-icon');
        l.classList.add('status-' + v[i]['status']);
        l.textContent = v[i]['src'] || '\u00A0';
        r.appendChild(t);
    }
    r.lastElementChild.scrollIntoView();
}

function changeSummary(count) {
    var icon = word = plural = '';
    if (!count) word = 'No', plural = 's', icon = 'warning-icon-small';
    else word = count, plural = (count > 1 ? 's' : '');
    utils.summary(icon, utils.format(utils.strings.REQCNT, word, plural), '#resources .statusbar-summary');
}

function updateViews(data) {
    if (data.info.length === 0)
        return;

    var info = data.info.map(function(i) {
        i.ref = data.url;
        return i;
    });

    var origin = utils.url(data.url).origin;
    if (origin === 'null')
        origin = data.url;
    var found = origin in requests;
    var item = requests[origin] || [];
    var ids = [];
    for (var i = 0; i < item.length; i++)
        ids.push(item[i].id);
    for (var i = 0; i < info.length; i++) {
        var index = ids.indexOf(info[i].id);
        if (index == -1)
            item.push(info[i]);
        else
            item[index] = info[i];
    }
    requests[origin] = item;

    if (!found)
        updateRefererList(origin);
    if ($('referrer').querySelector('.selected').textContent === origin)
        updateRequestList(origin);

    var count = 0;
    for (var k in requests)
        count += Object.keys(requests[k]).length;
    changeSummary(count);

    dirty = true;
}

function resetViews() {
    requests = {};
    dirty = false;
    $('referrer').textContent = '';
    $('request').textContent = '';
    utils.overlay('', '#resources .view:last-child');
    changeSummary('');
}

return {
    bind: function() {
        relayEvent($('referrer'), 'mousedown', '.list-item', onReferrer);
        relayEvent($('request'), 'click', '.list-item', onRequest);
        relayEvent($('resources').querySelector('.view:last-child'), 'click', '.delete', onClear);
        relayEvent($('resources').querySelector('.status-bar'), 'click', '.statusbar-item', onStatusbar);
        $('resources').querySelector('.splitter').addEventListener('mousedown', onSlide);
    },
    reset: resetViews,
    update: updateViews
};

});
ext.define('extension.filterview', function() {

var messages = extension.messages;
var utils = extension.utils;
var slider = extension.slider;

var filterset;
var views = {};
var inspectedURL;

function matchHostname(filter) {
    return filter.root.length ? utils.regexp(filter.root).test(inspectedURL) : false;
}

function indexofMatchingHostname(filters) {
    for (var i = 0; i < filters.length; i++) {
        if (matchHostname(filters[i]))
            return i;
    }
    return -1;
}

function createConsoleMessage(type, str) {
    var o = $x('output').cloneNode(true);
    o.querySelector('.text').textContent = str;
    o.querySelector('.text').classList.add(type);
    return o;
}

function validateRegex(str) {
    try {
        new RegExp(str);
    }
    catch(err) {
        return err.toString();
    }
}

var view = {
    init: function() {
        relayEvent($(this.id).querySelector('.listbox.patterns'), 'click', '.enable,.delete', onListbox.bind(this));
        relayEvent($(this.id).querySelector('.console'), 'keydown', '.input', onInput.bind(this));
        relayEvent($(this.id).querySelector('.status-bar'), 'click', '.statusbar-item', onStatusbar.bind(this));
        relayEvent($(this.id).querySelector('.console-statusbar'), 'click', '.statusbar-item', onStatusbar.bind(this));
        $(this.id).querySelector('.splitter').addEventListener('mousedown', onSlide);
        $(this.id).querySelector('.console-input').addEventListener('click', onConsole.bind(this));
        $(this.id).querySelector('.statusbar-console').click();
        if (this.live)
            $(this.id).querySelector('.statusbar-live').click();
    },
    update: function() {
        var i = indexofMatchingHostname(this.filters);
        if (i !== -1) {
            if (this.filters[i].patterns.length) {
                this.index = i;
                this.patterns(this.filters[i].patterns);
                return;
            }
        }
        this.clear();
    },
    pattern: function(pattern) {
        var i = indexofMatchingHostname(this.filters);
        if (i !== -1) {
            this.filters[i].patterns.push({
                enabled: 1,
                pattern: pattern
            });
        }
        else {
            this.filters.push({
                root: utils.url(inspectedURL).host,
                name: 'new group',
                enabled: true,
                patterns: [{pattern: pattern, enabled: 1}]
            });
        }
        filterset.set(this.id, this.filters);
        this.update();
    },
    load: function(filters) {
        this.filters.splice(0, this.filters.length);
        for (var i = 0; i < filters.length; i++)
            this.filters.push(filters[i]);
        this.update();
    },
    patterns: function(filters) {
        var l = $(this.id).querySelector('.listbox.patterns');
        var m = $x('pattern');
        this.clear();
        filters.forEach(function(filter) {
            var n = m.cloneNode(true);
            n.querySelector('input').checked = filter.enabled;
            n.querySelector('.text').textContent = filter.pattern;
            l.appendChild(n);
        });
        if (l.lastElementChild)
            l.lastElementChild.scrollIntoView();
    },
    clear: function() {
        $(this.id).querySelector('.listbox.patterns').textContent = '';
    }
};

function onConsole(e) {
    e.currentTarget.querySelector('.console .input').focus();
}

function onListbox(e) {
    var i = getChildPosition(e.relayTarget.parentNode);

    if (e.relayTarget.classList.contains('delete')) {
        var p = this.filters[this.index].patterns.splice(i, 1)[0];
        filterset.set(this.id, this.filters);
        if (this.live) {
            messages.send('filters-update', [{
                type: utils.stringMap(this.id),
                enabled: 0,
                pattern: p.pattern
            }]);
        }
        e.currentTarget.removeChild(e.relayTarget.parentNode);
    }

    if (e.relayTarget.classList.contains('enable')) {
        this.filters[this.index].patterns[i].enabled = +e.relayTarget.checked;
        filterset.set(this.id, this.filters);
        if (this.live) {
            messages.send('filters-update', [{
                type: utils.stringMap(this.id),
                enabled: +e.relayTarget.checked,
                pattern: e.relayTarget.parentNode.querySelector('.text').textContent
            }]);
        }
        return true;
    }
}

function onInput(e) {
    switch (e.keyIdentifier) {
        case 'Enter':
            var q = e.relayTarget.textContent.trim();
            e.preventDefault();
            e.relayTarget.textContent = '';
            e.relayTarget.focus();
            if (q) {
                var n = e.currentTarget.querySelector('.console-messages');
                var p = e.currentTarget.querySelector('.console-input');

                this.history.put(q);
                this.pointer = this.history.size();

                if (this.output == 1) {
                    var err = validateRegex(q);
                    if (err) {
                        n.insertBefore(createConsoleMessage('error', err), p);
                        p.scrollIntoView();
                        return;
                    }
                    q = q.replace(/^\/*(.+?)\/*$/, '/$1/');
                }

                var l = $(this.id).querySelectorAll('.listbox.patterns .list-item .text');
                for (var i = 0; i < l.length; i++) {
                    if (l[i].textContent === q) {
                        n.insertBefore(createConsoleMessage('command', q), p);
                        n.insertBefore(createConsoleMessage('error', utils.format(utils.strings.PTRNDUP, q)), p);
                        p.scrollIntoView();
                        return;
                    }
                }

                n.insertBefore(createConsoleMessage('command', q), p);
                p.scrollIntoView();

                this.pattern(q);
                if (this.live) {
                    messages.send('filters-update', [{
                        type: utils.stringMap(this.id),
                        enabled: 1,
                        pattern: q
                    }]);
                }
            }
            break;
        case 'Up':
        case 'Down':
            e.preventDefault();
            this.pointer += e.keyIdentifier == 'Up' ? -1 : 1;
            this.pointer = Math.max(0, Math.min(this.history.size() - 1, this.pointer));
            e.relayTarget.textContent = this.history.peek(this.pointer) || '';
            break;
    }

    return true;
}

function onStatusbar(e) {
    if (e.relayTarget.classList.contains('statusbar-console')) {
        if (this.resizing)
            return;

        this.resizing = true;

        var t = this;
        if (!this.deployed) {
            slider.expand($(this.id).querySelector('.splitter'), function() {
                $(t.id).querySelector('.console').classList.remove('collapsed');
                $(t.id).querySelector('.console .console-input').scrollIntoView();
                $(t.id).querySelector('.console .input').focus();
                delete t.resizing;
            });
        }
        else {
            $(this.id).querySelector('.console').classList.add('collapsed');
            slider.collapse($(this.id).querySelector('.splitter'), function() {
                delete t.resizing;
            });
        }

        this.deployed = utils.toggle(e.relayTarget, 'CLPSMODE', ['Collapse', 'Expand']);
    }

    if (e.relayTarget.classList.contains('statusbar-delete')) {
        var g = this.filters.splice(this.index, 1)[0];

        filterset.set(this.id, this.filters);

        if (g && g.patterns.length > 0) {
            if (this.live) {
                var k = utils.stringMap(this.id);
                messages.send('filters-update', g.patterns.map(function(filter) {
                    return {
                        type: k,
                        enabled: 0,
                        pattern: filter.pattern
                    };
                }));
            }
        }

        this.clear();
    }

    if (e.relayTarget.classList.contains('statusbar-regexp')) {
        this.output = utils.toggle(e.relayTarget, 'REGEXMODE');
    }

    if (e.relayTarget.classList.contains('statusbar-live')) {
        this.live = utils.toggle(e.relayTarget, 'LIVEMODE');
    }

    if (e.relayTarget.classList.contains('statusbar-clear')) {
        this.history.clear();
        this.pointer = this.history.size();
        var elms = $(this.id).querySelectorAll('.console-messages .text');
        for (var i = 0; i < elms.length; i++)
            elms[i].parentNode.removeChild(elms[i]);
    }
}

function onSlide(e) {
    e.preventDefault();
    utils.glass('y', slider.create(e));
}

function getFilterView(key) {
    if (views[key] == null) {
        views[key] = createFilterView(key);
        views[key].init();
    }
    return views[key];
}

function createFilterView(key) {
    return Object.create(view, {
        id: { value: key },
        index: { value: -1, writable: true },
        live: { value: true, writable: true },
        filters: { value: [] },
        history: { value: utils.queue() },
        pointer: { value: -1, writable: true },
        output: { value: 0, writable: true }
    });
}

function resetViews() {
    getFilterView('patternlistB').clear();
    getFilterView('patternlistD').clear();
}

function updateViews(data) {
    inspectedURL = data.url;
    filterset = data.filters;
    var keywordsB = getFilterView('patternlistB');
    keywordsB.load(filterset.get('patternlistB'));
    var keywordsD = getFilterView('patternlistD');
    keywordsD.load(filterset.get('patternlistD'));
}

return {
    reset: resetViews,
    update: updateViews
};

});
(function() {

var messages = extension.messages;
var utils = extension.utils;
var requests = extension.requestview;
var filters = extension.filterview;
var background;
var tab_url;
var tab_id;
var manifest = chrome.runtime.getManifest();

function toolbarClicked(e) {
    if (!e.relayTarget.classList.contains('selected')) {
        var el = e.currentTarget.querySelector('.selected');
        el.classList.remove('selected');
        el = el.children[0];
        $q(el.getAttribute('href')).classList.remove('selected');
        el = e.relayTarget;
        el.classList.add('selected');
        el = el.children[0];
        $q(el.getAttribute('href')).classList.add('selected');
    }
}

function blockContextMenu(e) {
    if (e.target.classList.contains('glass-pane'))
        e.preventDefault();
}

function checkDomainChanged(id, info, tab) {
    if (id == tab_id) {
        if (info.status == 'loading')
            startInspector();
    }
}

function checkChannelSwitched(id, closed) {
    if (closed == tab_id) {
        window.location.hash = id;
        resetInspector();
    }
}

function matchHosts(a, b) {
    var c = utils.url(a), d = utils.url(b);
    return (c.protocol + '//' + c.host) == (d.protocol + '//' + d.host);
}

function startInspector() {
    chrome.tabs.get(tab_id, function(t) {
        if (!matchHosts(t.url, tab_url)) {
            tab_url = utils.url(t.url).origin;
            document.title = manifest.name + ' Inspector - ' + tab_url;
            requests.reset();
        }
        filters.reset();
        if (utils.permitted(t.url)) {
            filters.update({
                url: t.url,
                filters: background.getFilters()
            });
            inspectIsolatedWorld();
        }
    });
}

function resetInspector() {
    tab_id = +window.location.hash.substring(1);
    tab_url = 'about:blank';
    startInspector();
}

function shutdownInspector(id) {
    if (id == tab_id)
        window.close();
}

function inspectIsolatedWorld() {
    sendMessage('inspect');
}

function filterIsolatedWorld(data) {
    sendMessage('filter', data);
}

function sendMessage(type, data) {
    chrome.tabs.sendMessage(tab_id, {type: type, info: data});
}

function receiveMessage(message, sender) {
    if (sender.tab.id == tab_id) {
        if (message.type === 'audit') {
            requests.update({
                url: sender.url,
                info: message.info.plugin
            });
        }
    }
}

chrome.runtime.getPlatformInfo(function(info) {
    document.body.classList.add('platform-' + info.os);
});

chrome.runtime.getBackgroundPage(function(page) {
    background = page.extension.exports;
    document.body.addEventListener('contextmenu', blockContextMenu);
    relayEvent('.navigation', 'mousedown', 'li', toolbarClicked);
    chrome.tabs.onRemoved.addListener(shutdownInspector);
    chrome.tabs.onUpdated.addListener(checkDomainChanged);
    chrome.tabs.onReplaced.addListener(checkChannelSwitched);
    chrome.runtime.onMessage.addListener(receiveMessage);
    requests.bind();
    messages.listen({
        'requests-reload': resetInspector,
        'filters-update': filterIsolatedWorld
    });
    resetInspector();
});

})();
