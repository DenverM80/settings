window.ext = (function(parent) {

function namespace(name) {
    var obj = parent;
    var parts = name.split('.');
    while (parts[0]) {
        var ns = parts.shift();
        obj = ns in obj ? obj[ns] : obj[ns] = {};
    }
    return obj;
}

function define(name, fn) {
    var component = namespace(name);
    var exports = fn();
    for (var prop in exports) {
        if (prop in component)
            continue;
        component[prop] = exports[prop];
    }
}

return {
    define: define
};

})(window);
ext.define('extension.messages', function() {

var components = [];
var runtime = {
    send: function(message, fn) {
        chrome.runtime.sendMessage(chrome.runtime.id, message, fn);
    }
};

function listen(component) {
    components.push(component);
}

function ignore(component) {
    var i = components.indexOf(component);
    if (i != -1)
        components.splice(i, 1);
}

function send() {
    var event = arguments[0];
    var args = Array.prototype.slice.call(arguments, 1);
    components.forEach(function(component) {
        if (component.hasOwnProperty(event))
            component[event].apply(component, args);
    });
}

return {
    listen: listen,
    ignore: ignore,
    send: send,
    runtime: runtime
};

});
ext.define('extension.utils', function() {

var rxmeta = /([.*:;'"!@#$%^&?\-+=<>\\\/~`|(){}\[\]])/g;
var rxmetachars = /(\\[bcdfnrtvsw])/ig;
var rxregx = /^\/.*\/$/;

function escapeMetachars(str) {
    return str.replace(rxmeta, '\\$1').replace(rxmetachars, '\\\\$1');
}

function expandWildcards(str) {
    return rxregx.test(str) ? str.substr(1, str.length - 2) : (str.indexOf('*') != -1 ?
        str.split('*').map(escapeMetachars).join('(.*?)') : escapeMetachars(str));
}

function filter(obj, keys) {
    var d = {}, e = Object.getOwnPropertyNames(obj);
    var k = Array.isArray(keys) ? keys : Object.keys(keys);
    for (var i = 0; i < e.length; i++) {
        if (k.indexOf(e[i]) != -1)
            Object.defineProperty(d, e[i],
                Object.getOwnPropertyDescriptor(obj, e[i]));
    }
    return d;
}

function format() {
    var v = Array.prototype.slice.call(arguments, 1);
    return arguments[0].replace(/{(\d+)}/g, function(s, x) {
        return v[x];
    });
}

function grep(str, obj) {
    var r = regexp(str), a = Array.isArray(obj), t = [];
    var d = !a ? Object.getOwnPropertyNames(obj) : obj;
    for (var i = 0; i < d.length; i++) {
        if (r.test(d[i]))
            t.push(d[i]);
    }
    return a ? t : filter(obj, t);
}

function regexp(str) {
    return new RegExp(expandWildcards(str));
}

function url(p, b) {
    return b ? new window.URL(p, b) : new window.URL(p);
}

return {
    filter: filter,
    format: format,
    grep: grep,
    regexp: regexp,
    url: url
};

});
ext.define('extension.utils', function() {

var rxswf = /\.swf\b/i;
var rxsrc = /src|movie/i;
var rxclsid = /D27CDB6E-?AE6D-?11cf-?96B8-?444553540000/i;
var rxtype = /application\/(x-shockwave-flash|futuresplash)/i;

function isNestedObjectElement(element) {
    var parent = element.parentNode;
    return !(parent instanceof HTMLObjectElement && isObjectElement(parent));
}

function isObjectElement(element) {
    if (!isNestedObjectElement(element)) return false;
    if (rxclsid.test(element.getAttribute('classid'))) return false;
    return rxtype.test(element.type) || rxswf.test(element.data) || isObjectParams(element);
}

function isEmbedElement(element) {
    if (!isNestedObjectElement(element)) return false;
    return rxtype.test(element.type) || rxswf.test(element.src);
}

function isObjectParams(element) {
    if (element.firstChild) {
        var rxs = rxswf, rxt = rxtype;
        for (var child = element.lastElementChild; child; child = child.previousElementSibling) {
            if (child instanceof HTMLParamElement) {
                var name = child.name;
                if ((name == 'type' && rxt.test(child.value)) ||
                    ((name == 'movie' || name == 'src') && rxs.test(child.value)) ||
                    (name == 'flashvars')) {
                    return true;
                }
            }
        }
    }
    return false;
}

function getParamElement(element, name) {
    var param = element.querySelectorAll('param[name=' + name + ']');
    return param[param.length - 1];
}

function copyBoundingBox(target, source) {
    var view = window.getComputedStyle(target, null);
    source.style.width = view.width;
    source.style.height = view.height;
}

function createPlaceholderToolbar(element, config) {
    var div = document.createElement('div');
    div.style.cssText = config.toolbar;
    return element.appendChild(div);
}

function createElementPlaceholder(element, config) {
    var view = window.getComputedStyle(element, null);
    var style = {
        'width': view.width,
        'height': view.height,
        'top': view.top,
        'left': view.left
    };
    if (view.position !== 'static')
        style.position = view.position;
    var cssText = '';
    for (var k in style)
        cssText += k + ':' + style[k] + ';';
    var div = document.createElement('div');
    div.style.cssText = cssText + config.panel;
    if (!config.panelclick)
        div.style.cursor = 'default';
    return div;
}

function getPluginSRC(element) {
    var src = '';
    if (element instanceof HTMLEmbedElement)
        src = element.src;
    else if (element instanceof HTMLObjectElement) {
        if (element.data)
            src = element.data;
        else {
            for (var child = element.lastElementChild; child; child = child.previousElementSibling) {
                if (child instanceof HTMLParamElement)
                    if (src = getPluginSRC(child)) break;
            }
        }
    }
    else if (element instanceof HTMLParamElement) {
        if (rxsrc.test(element.name))
            src = element.value;
    }
    return src.trim();
}

function getPluginParam(element, name) {
    var value = '', temp;
    if (element instanceof HTMLObjectElement) {
        for (var child = element.lastElementChild; child; child = child.previousElementSibling) {
            if (child instanceof HTMLParamElement) {
                if (temp = getPluginParam(child, name)) {
                    value = temp;
                    break;
                }
            }
        }
    }
    else if (element instanceof HTMLEmbedElement)
        element.hasAttribute(name) && (value = element.getAttribute(name));
    else if (element instanceof HTMLParamElement)
        value = name.toLowerCase() == element.name.toLowerCase() ? element.value : '';
    return value.trim();
}

function isElement(element) {
    return element instanceof HTMLElement;
}

function isValidPlugin(element) {
    if (element instanceof HTMLObjectElement)
        return isObjectElement(element);
    if (element instanceof HTMLEmbedElement)
        return isEmbedElement(element);
    return false;
}

function removePluginParam(element, name) {
    if (element instanceof HTMLObjectElement) {
        var param = getParamElement(element, name);
        if (param)
            element.removeChild(param);
    }
    else if (element instanceof HTMLEmbedElement)
        element.removeAttribute(name);
}

function setPluginParam(element, test, name, value) {
    if (element instanceof HTMLObjectElement) {
        var param = getParamElement(element, name);
        if (param ? !extension.utils.regexp(test).test(param.value) : true) {
            param = document.createElement('param');
            param.name = name;
            param.value = value;
            element.appendChild(param);
            return true;
        }
    }
    else if (element instanceof HTMLEmbedElement) {
        if (!extension.utils.regexp(test).test(element.getAttribute(name))) {
            element.setAttribute(name, value);
            return true;
        }
    }
    return false;
}

return {
    copyBoundingBox: copyBoundingBox,
    createPlaceholderToolbar: createPlaceholderToolbar,
    createElementPlaceholder: createElementPlaceholder,
    getPluginSRC: getPluginSRC,
    getPluginParam: getPluginParam,
    isElement: isElement,
    isValidPlugin: isValidPlugin,
    removePluginParam: removePluginParam,
    setPluginParam: setPluginParam
};

});
ext.define('extension.preferences', function() {

var prefs = {};

function getPref(k) {
    return prefs[k];
}

function setPref(o) {
    prefs = o['preferences'] || {};
}

return {
    get: getPref,
    set: setPref
};

});
ext.define('extension.mutations', function() {

var utils = extension.utils;
var messages = extension.messages;
var tags = 'object,embed';
var currentDocument = document.documentElement;
var htmlObserver = new window.MutationObserver(onHTMLMutation);
var documentObserver = new window.MutationObserver(onDocumentMutation);

function collectFlashElements(element) {
    var result = [], elms = element.querySelectorAll(tags);
    for (var i = 0; i < elms.length; i++) {
        if (utils.isValidPlugin(elms[i]))
            result.push(elms[i]);
    }
    return result;
}

function concatFlashElements(array, element) {
    if (utils.isElement(element)) {
        if (utils.isValidPlugin(element))
            return array.push(element);
        return Array.prototype.push.apply(array, collectFlashElements(element));
    }
}

function removeArrayDuplicate(item, position, array) {
    return array.indexOf(item) == position;
}

function onInsert(element) {
    messages.send('insert', element);
}

function onRemove(element) {
    messages.send('remove', element);
}

function onHTMLMutation(records) {
    var addedNodes = [], removedNodes = [];
    for (var i = 0, nodes; i < records.length; i++) {
        nodes = records[i].addedNodes;
        for (var j = 0; j < nodes.length; j++) {
            if (nodes[j].parentNode != null)
                concatFlashElements(addedNodes, nodes[j]);
        }
        nodes = records[i].removedNodes;
        for (var j = 0; j < nodes.length; j++) {
            if (nodes[j].parentNode == null)
                concatFlashElements(removedNodes, nodes[j]);
        }
    }
    addedNodes.filter(removeArrayDuplicate).forEach(onInsert);
    removedNodes.filter(removeArrayDuplicate).forEach(onRemove);
}

function onDocumentMutation(records) {
    if (currentDocument !== document.documentElement) {
        var prevDoc = currentDocument;
        currentDocument = document.documentElement;
        messages.send('document-replaced', prevDoc);
    }
}

function connectObserver() {
    htmlObserver.observe(currentDocument,
        {'childList': true, 'subtree': true});
}

function disconnectObserver() {
    htmlObserver.disconnect();
}

function scanDocument() {
    collectFlashElements(currentDocument).forEach(onInsert);
}

return {
    bind: function() {
        documentObserver.observe(document, {'childList': true});
    },
    observe: connectObserver,
    disconnect: disconnectObserver,
    scan: scanDocument
};

});
ext.define('extension.display', function() {

var utils = extension.utils;
var messages = extension.messages;
var preferences = extension.preferences;

function onInsert(e) {
    var q = preferences.get('flashquality');
    if (q)
        utils.setPluginParam(e, q, 'quality', q);
}

return {
    bind: function() {
        messages.listen({
            'insert': onInsert
        });
    }
};

});
ext.define('extension.filters', function() {

var utils = extension.utils;
var messages = extension.messages;
var UNBLOCKED = 1;
var BLOCKED = 2;
var ALLOWED = 4;
var DENIED = 8;
var GLOBAL = 16;
var frame_blocked = 0;
var flag_override = 0;
var meta_data = {};
var target_filters = {};
var source_filters = {};

function FilterMatcher(url) {
    var host = utils.url(url, document.documentElement.baseURI).host;
    var targetMatcher = function(rx) {
        return rx.test(url);
    };
    var sourceMatcher = function(filter) {
        return filter.origin.test(host) && filter.patterns.some(targetMatcher);
    };
    this.matchTarget = targetMatcher;
    this.matchSource = sourceMatcher;
}

function blockMutation(records) {
    if (records[0].target.style.display !== 'none') {
        var metadata = getMetadata(records[0].target);
        allowMutation(metadata);
        blockElement(metadata);
    }
}

function preventMutation(metadata) {
    metadata.observer.observe(metadata.element,
        { 'attributes': true, 'attributeFilter': ['style'] });
}

function allowMutation(metadata) {
    metadata.observer.disconnect();
}

function createMetadata(element) {
    var metadata = {
        id: Math.random().toString(16),
        flags: 0,
        element: element,
        observer: new window.MutationObserver(blockMutation)
    };
    return meta_data[metadata.id] = metadata;
}

function getMetadata(element) {
    return searchMetadata('element', element) || createMetadata(element);
}

function removeMetadata(element) {
    var metadata = getMetadata(element);
    allowMutation(metadata);
    deleteMetadata(metadata);
    return metadata;
}

function deleteMetadata(metadataArg) {
    var metadata = meta_data;
    for (var k in metadata) {
        if (metadata[k].id == metadataArg.id)
            return delete metadata[k];
    }
}

function searchMetadata(argA, argB) {
    var metadata = meta_data;
    if (arguments.length == 2) {
        for (var k in metadata) {
            if (metadata[k][argA] === argB)
                return metadata[k];
        }
        return;
    }
    for (var k in metadata) {
        if (metadata[k] === argA)
            return metadata[k];
    }
}

function patternMatcher(str) {
    return function(rx) {
        return rx.source != str;
    }
}

function matchTargetFilter(type, matcher) {
    var filter = target_filters[type];
    return filter ? filter.some(matcher.matchTarget) : false;
}

function matchSourceFilter(type, matcher) {
    var filter = source_filters[type];
    return filter ? filter.some(matcher.matchSource) : false;
}

function loadSourceFilters(type, data) {
    var filters = source_filters[type] = [];
    data.forEach(function(data) {
        filters.push({
            origin: utils.regexp(data.root),
            patterns: data.patterns.map(utils.regexp)
        });
    });
}

function loadTargetFilters(type, data) {
    target_filters[type] = data.map(utils.regexp);
}

function updateTargetFilters(type, str, enabled) {
    var targets = target_filters[type] || [];
    var pattern = utils.regexp(str);
    var matcher = patternMatcher(pattern.source);
    if (!enabled)
        targets = targets.filter(matcher);
    else if (targets.every(matcher))
        targets.push(pattern);
    target_filters[type] = targets;
}

function updateTarget(data) {
    updateTargetFilters(data.type, data.pattern, data.enabled);
}

function getInfo(metadata) {
    var element = metadata.element;
    var url = utils.getPluginSRC(element);
    var flags = flag_override || metadata.flags;
    var view = window.getComputedStyle(element, null);
    var info = {
        'id': metadata.id,
        'src': url,
        'status': '',
        'type': element.type,
        'vars': utils.getPluginParam(element, 'flashvars'),
        'access': utils.getPluginParam(element, 'allowscriptaccess') || 'sameDomain',
        'height': view.height,
        'width': view.width
    };
    if (flags & DENIED)
        info.status = 'blacklisted';
    if (flags & ALLOWED)
        info.status = 'whitelisted';
    if (flags & GLOBAL)
        info.status = 'g' + info.status;
    if (flags & BLOCKED)
        info.status = 'blocked';
    if (flags & UNBLOCKED)
        info.status = 'unblocked';
    return info;
}

function getElementFlags(element) {
    var url = utils.getPluginSRC(element);
    var matcher = new FilterMatcher(url);
    if (matchTargetFilter('black', matcher))
        return DENIED;
    if (matchTargetFilter('white', matcher))
        return ALLOWED;
    if (matchSourceFilter('black', matcher))
        return DENIED | GLOBAL;
    if (matchSourceFilter('white', matcher))
        return ALLOWED | GLOBAL;
    return frame_blocked;
}

function onInsert(element) {
    var metadata = getMetadata(element);
    var flags = metadata.flags = flag_override || getElementFlags(element);
    if (flags & DENIED) {
        blockElement(metadata);
        messages.send('cancel', metadata);
        return;
    }
    if (flags & ALLOWED) {
        unblockElement(metadata);
        messages.send('allow', metadata);
        return;
    }
    if (flags & BLOCKED) {
        blockElement(metadata);
        messages.send('restrict', metadata);
        return;
    }
    if (flags & UNBLOCKED) {
        unblockElement(metadata);
        messages.send('allow', metadata);
        return;
    }
}

function onRemove(element) {
    var metadata = removeMetadata(element);
    messages.send('cancel', metadata);
}

function onBlock(metadata) {
    blockElement(searchMetadata('id', metadata.id));
}

function onUnblock(metadata) {
    unblockElement(searchMetadata('id', metadata.id));
}

function unblockElement(metadata) {
    allowMutation(metadata);
    metadata.element.style.setProperty('display', 'block', 'important');
}

function blockElement(metadata) {
    metadata.element.style.setProperty('display', 'none', 'important');
    preventMutation(metadata);
}

function destroyFilters() {
    target_filters = {};
    source_filters = {};
}

function updateFilters(data) {
    if (Array.isArray(data))
        data.forEach(updateTarget);
    else
        updateTarget(data);
}

function getElementInfo(element) {
    var data = [];
    if (element)
        data.push(getInfo(getMetadata(element)));
    else {
        for (var k in meta_data)
            data.push(getInfo(meta_data[k]));
    }
    return data;
}

function blockContent(block) {
    frame_blocked = block ? BLOCKED : UNBLOCKED;
}

function denyContent() {
    flag_override = DENIED;
    destroyFilters();
}

function allowContent() {
    flag_override = ALLOWED;
    destroyFilters();
}

function captureContent(config) {
    flag_override = 0;
    blockContent(config['blocked']);
    var filterset = config['filterset'];
    loadTargetFilters('white', filterset[0]);
    loadTargetFilters('black', filterset[1]);
    loadSourceFilters('white', filterset[2]);
    loadSourceFilters('black', filterset[3]);
}

function searchMetadataById(id) {
    return searchMetadata('id', id);
}

return {
    bind: function() {
        messages.listen({
            'insert': onInsert,
            'remove': onRemove,
            'block': onBlock,
            'unblock': onUnblock
        });
    },
    search: searchMetadataById,
    capture: captureContent,
    allow: allowContent,
    deny: denyContent,
    block: blockContent,
    info: getElementInfo,
    update: updateFilters
};

});
ext.define('extension.placeholders', function() {

var utils = extension.utils;
var messages = extension.messages;
var filters = extension.filters;
var mutations = extension.mutations;
var preferences = extension.preferences;
var place_holders = {};

function updateBoundingBox(records, observer) {
    var info = getPlaceholderByObserver(observer);
    if (info)
        utils.copyBoundingBox(records[0].target, info.container);
}

function createPlaceholder(id,  element) {
    if (place_holders[id])
        return place_holders[id];

    var container = utils.createElementPlaceholder(element, {
        panel: preferences.get('placeholder').panel,
        panelclick: preferences.get('panelclick')
    });
    container.className = 'flc-panel';
    return place_holders[id] = {
        key: id,
        wmode: false,
        container: container,
        observer: new window.MutationObserver(updateBoundingBox)
    };
}

function getPlaceholderById(id) {
    return place_holders[id];
}

function getPlaceholderByChild(child) {
    var placeholders = place_holders;
    for (var k in placeholders) {
        var container = placeholders[k].container;
        if (container === child || container.contains(child))
            return placeholders[k];
    }
}

function getPlaceholderByObserver(observer) {
    var placeholders = place_holders;
    for (var k in placeholders) {
        if (observer === placeholders[k].observer)
            return placeholders[k];
    }
}

function insertPlaceholder(info, element) {
    var container = info.container;
    if (element.nextSibling && element.nextSibling !== container)
        element.parentNode.insertBefore(container, element.nextSibling);
    else
        element.parentNode.appendChild(container);
    info.observer.observe(element,
        {'attributes': true, 'attributeFilter': ['style', 'width', 'height']});
}

function destroyPlaceholder(id) {
    return delete place_holders[id];
}

function removePlaceholder(id, element) {
    var info = getPlaceholderById(id);
    if (info) {
        var container = info.container;
        if (container.parentNode) {
            if (container.contains(element))
                releaseElement(info, element);
            container.parentNode.removeChild(container);
        }
        info.observer.disconnect();
    }
}

function captureElement(info, element) {
    mutations.disconnect();
    info.wmode = utils.setPluginParam(element, '/opaque|transparent/', 'wmode', 'opaque');
    info.container.appendChild(element);
    mutations.observe();
}

function releaseElement(info, element) {
    mutations.disconnect();
    if (info.wmode) {
        utils.removePluginParam(element, 'wmode');
        info.wmode = false;
    }
    var container = info.container;
    container.parentNode.insertBefore(element, container);
    mutations.observe();
}

function setPlaceholderTitle(info, element) {
    if (preferences.get('paneltooltip'))
        info.container.title = utils.getPluginSRC(element);
    else if (preferences.get('panelclick'))
        info.container.title = 'Click to load Flash content';
}

function removePlaceholderTitle(info) {
    info.container.removeAttribute('title');
}

function onPlaceholderClicked(event) {
    if ('isTrusted' in event && !event.isTrusted) return;
    
    var info = getPlaceholderByChild(event.target);
    if (!info) return;

    var metadata = filters.search(info.key);
    if (!metadata) return;

    event.preventDefault();
    event.stopPropagation();

    if (event.target === info.container) {
        if (!preferences.get('panelclick'))
            return;
        if (!info.container.contains(metadata.element)) {
            if (preferences.get('toolbar')) {
                info.container.classList.add('flc-trans');
                info.toolbar = utils.createPlaceholderToolbar(info.container, {
                    toolbar: preferences.get('placeholder').toolbar
                });
                info.toolbar.className = 'flc-toolbar';
                captureElement(info, metadata.element);
                removePlaceholderTitle(info);
            }
            else
                info.container.style.setProperty('display', 'none', 'important');
            messages.send('unblock', metadata);
        }
    }
    else if (event.target === info.toolbar) {
        if (info.container.contains(metadata.element)) {
            undoElementCapture(info, metadata.element);
            setPlaceholderTitle(info, metadata.element);
            messages.send('block', metadata);
        }
    }
}

function undoElementCapture(info, element) {
    releaseElement(info, element);
    var container = info.container;
    container.textContent = '';
    container.classList.remove('flc-trans');
}

function onCapture(metadata) {
    var element = metadata.element;
    var info = createPlaceholder(metadata.id, metadata.element);
    var container = info.container;

    container.style.setProperty('display', metadata.flags & 2 ?
        'block' : 'none', 'important');
    setPlaceholderTitle(info, element);

    if (container.contains(element)) {
        undoElementCapture(info, element);
        insertPlaceholder(info, element);
        return;
    }

    insertPlaceholder(info, element);
}

function onCancel(metadata) {
    removePlaceholder(metadata.id, metadata.element);
    destroyPlaceholder(metadata.id);
}

return {
    bind: function() {
        document.addEventListener('click', onPlaceholderClicked, true);
        messages.listen({
            'restrict': onCapture,
            'allow': onCancel,
            'cancel': onCancel
        });
    }
};

});
ext.define('ext', function() {

var display = extension.display;
var filters = extension.filters;
var messages = extension.messages;
var mutations = extension.mutations;
var placeholders = extension.placeholders;
var preferences = extension.preferences;
var documentURL;
var ids = [];

function sendMessage(type, data) {
    messages.runtime.send({type: type, info: data}, function(message) {
        if (message)
            API(message['status'], message);
    });
}

function receiveMessage(message) {
    switch (message.type) {
        case 'inspect':
            sendMessage('audit', {
                indexed: true,
                plugin: filters.info()
            });
            break;
        case 'filter':
            filters.update(message.info);
            mutations.scan();
            break;
    }
}

function run() {
    documentURL = document.URL;
    mutations.observe();
    sendMessage('status');
}

function audit(element) {
    if (documentURL == document.URL) {
        var metadata = filters.info(element);
        var info = {
            indexed: ids.indexOf(metadata[0].id) !== -1,
            plugin: metadata
        };
        if (!info.indexed)
            ids.push(metadata[0].id);
        sendMessage('audit', info);
    }
}

function API(var_args) {
    switch (arguments[0]) {
        case 'capture':
            preferences.set(arguments[1]);
            filters.capture(arguments[1]);
            mutations.scan();
            break;
        case 'allow':
            preferences.set(arguments[1]);
            filters.allow();
            mutations.scan();
            break;
        case 'deny':
            filters.deny();
            mutations.scan();
            break;
        case 'destroy':
            filters.allow();
            mutations.scan();
            break;
        case 'block':
            filters.block(arguments[1]);
            mutations.scan();
            break;
        case 'validate':
            if (documentURL != document.URL) {
                documentURL = document.URL;
                sendMessage('update');
            }
            break;
    }
}

return {
    initialize: function() {
        if (window.FlashControl == null) {
            window.FlashControl = API;
            chrome.runtime.onMessage.addListener(receiveMessage);
            mutations.bind();
            display.bind();
            filters.bind();
            placeholders.bind();
            messages.listen({
                'document-replaced': run,
                'insert': audit
            });
            run();
        }
    }
};

});

ext.initialize();
