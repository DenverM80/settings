var PLACEHOLDER_PATHNAME = '*/example.swf';
var PLACEHOLDER_HREF = 'www.example.com';
var PLACEHOLDER_ENTER = 'Enter name';

var filters;
var filterKeyMap = {};
if (getFilename(window.location.pathname) == 'whitelist') {
    filterKeyMap['page'] = 'patternlistA';
    filterKeyMap['selective'] = 'patternlistB';
    filterKeyMap['global'] = 'patternlistE';
}
else if (getFilename(window.location.pathname) == 'blacklist') {
    filterKeyMap['page'] = 'patternlistC';
    filterKeyMap['selective'] = 'patternlistD';
    filterKeyMap['global'] = 'patternlistF';
}

function createListboxItem(text, enabled, placeholder) {
    var e = $x('listitem').querySelector('.list-item');
    e.querySelector('.text').textContent = text;
    e.querySelector('.action').textContent = enabled ? 'disable' : 'enable';
    if (!enabled) e.classList.add('disabled');
    e.querySelector('.editable input').placeholder = placeholder;
    return e;
}

function clearListbox(listbox) {
    var e = listbox.querySelectorAll('.list-item');
    for (var i = 0; i < e.length; i++)
        listbox.removeChild(e[i]);
}

function addListboxItem(listbox, text, enabled, placeholder) {
    var item = createListboxItem(text, enabled, placeholder);
    listbox.appendChild(item);
    if (listbox.classList.contains('filter-names')) {
        item.removeAttribute('placeholder');
        highlightListboxItem(listbox, item);
    }
}

function highlightListboxItem(listbox, item) {
    var e = listbox.querySelector('li.highlighted');
    if (e) e.classList.remove('highlighted');
    if (item && listbox.contains(item)) item.classList.add('highlighted');
}

function selectListboxItem(listbox, item) {
    var e = listbox.querySelector('li[selected]');
    if (e) e.removeAttribute('selected');
    if (item && listbox.contains(item)) item.setAttribute('selected', '');
}

function focusListboxItem(item) {
    var input = item.querySelector('input');
    input.value = item.querySelector('.text').textContent;
    input.focus();
}

function renameListboxItem(item, text) {
    item.querySelector('.text').textContent = text;
}

function populateListbox(listbox, items) {
    var placeholder = PLACEHOLDER_PATHNAME;
    items.forEach(function(item) {
        listbox.appendChild(createListboxItem(item.pattern, item.enabled, placeholder));
    });
}

function getSelectedGroup() {
    return $q('.view > .selected');
}

function getSelectedFilter(group) {
    return group.querySelector('.filter-names .list-item[selected]') ||
        group.querySelector('.filter-names .list-item.highlighted');
}

var selectiveHandler = {
    onKeyup: function(e) {
        var at = e.target, from = e.relayTarget, where = e.currentTarget;
        if (e.keyIdentifier === 'Enter') {
            var group = getSelectedGroup();
            var key = filterKeyMap[group.id];
            var patternlist = filters.get(key);
            var selecteditem = getSelectedFilter(group);
            var selectedfilter = selecteditem ? patternlist[getChildPosition(selecteditem) - 1] : null;
            var text = at.value.trim();
            if (from.classList.contains('template-list-item')) {
                if (!text) return;
                var disabled = from.querySelector('.action').textContent !== 'enable';
                if (where.classList.contains('filter-names')) {
                    patternlist.push({
                        root: '',
                        name: text,
                        enabled: +disabled,
                        patterns: []
                    });
                    filters.set(key, patternlist);
                    addListboxItem(where, text, disabled, PLACEHOLDER_ENTER);
                    selectListboxItem(where, null);
                    var elm = group.querySelector('.filter-patterns');
                    clearListbox(elm.querySelector('.filter-group'));
                    elm.querySelector('.filter-group-host').value = '';
                    elm.classList.remove('hidden');
                    setTimeout(function() {
                        elm.classList.add('visible');
                    }, 0);
                }
                else if (where.classList.contains('filter-group')) {
                    selectedfilter.patterns.push({
                        enabled: +disabled,
                        pattern: text
                    });
                    filters.set(key, patternlist);
                    addListboxItem(where, text, disabled, PLACEHOLDER_PATHNAME);
                }
                at.value = '';
            }
            else if (from.classList.contains('list-item')) {
                if (where.classList.contains('filter-names'))
                    selectedfilter.name = text;
                else if (where.classList.contains('filter-group'))
                    selectedfilter.patterns[getChildPosition(from) - 1].pattern = text;
                filters.set(key, patternlist);
                renameListboxItem(from, text);
                at.value = '';
            }
            else if (from.classList.contains('filter-group-host')) {
                selectedfilter.root = text;
                filters.set(key, patternlist);
            }
            at.blur();
        }
        else if (e.keyIdentifier === 'U+001B')
            at.blur();
    },

    onMousedown: function(e) {
        var at = e.target, from = e.relayTarget, where = e.currentTarget;
        if (at.classList.contains('text')) {
            highlightListboxItem(where, null);
            selectListboxItem(where, from);
            focusListboxItem(from);
            if (where.classList.contains('filter-names')) {
                var group = getSelectedGroup();
                var elm = group.querySelector('.filter-patterns');
                var patterngroup = filters.get(filterKeyMap[group.id])[getChildPosition(from) - 1];
                var l = elm.querySelector('.filter-group');
                clearListbox(l);
                populateListbox(l, patterngroup.patterns);
                elm.querySelector('.filter-group-host').value = patterngroup.root;
                elm.classList.remove('hidden');
                setTimeout(function() {
                    elm.classList.add('visible');
                }, 0);
            }
        }
        else
            return true;
    },

    onClick: function(e) {
        var at = e.target, from = e.relayTarget, where = e.currentTarget;
        if (from.classList.contains('template-list-item')) {
            if (at.classList.contains('action'))
                at.textContent = at.textContent === 'disable' ? 'enable' : 'disable';
        }
        else if (from.classList.contains('list-item')) {
            var group = getSelectedGroup();
            var selecteditem = getSelectedFilter(group);
            var key = filterKeyMap[group.id];
            var patterngroup = filters.get(key);
            if (at.classList.contains('delete')) {
                if (where.classList.contains('filter-names')) {
                    patterngroup.splice(getChildPosition(from) - 1, 1);
                    filters.set(key, patterngroup);
                    if (from.hasAttribute('selected') || from.classList.contains('highlighted')) {
                        var elm = group.querySelector('.filter-patterns');
                        elm.classList.remove('visible');
                        setTimeout(function() {
                            elm.classList.add('hidden');
                        }, 200);
                    }
                }
                else if (where.classList.contains('filter-group')) {
                    patterngroup[getChildPosition(selecteditem) - 1].patterns.splice(getChildPosition(from) - 1, 1);
                    filters.set(key, patterngroup);
                }
                where.removeChild(from);
            }
            else if (at.classList.contains('action')) {
                var disabled = at.textContent !== 'enable';
                if (where.classList.contains('filter-names')) {
                    patterngroup[getChildPosition(from) - 1].enabled = +!disabled;
                    filters.set(key, patterngroup);
                }
                else if (where.classList.contains('filter-group')) {
                    patterngroup[getChildPosition(selecteditem) - 1].patterns[getChildPosition(from) - 1].enabled = +!disabled;
                    filters.set(key, patterngroup);
                }
                at.textContent = disabled ? 'enable' : 'disable';
                from.classList.toggle('disabled', disabled);
            }
        }
    },

    onBlur: function(e) {
        var from = e.relayTarget, where = e.currentTarget;
        if (from.classList.contains('list-item')) {
            from.removeAttribute('selected');
            if (!e.currentTarget.querySelector('.list-item[selected]'))
                highlightListboxItem(e.currentTarget, from);
        }
        if (from.classList.contains('filter-group-host')) {
            var group = getSelectedGroup();
            var key = filterKeyMap[group.id];
            var patterngroup = filters.get(key);
            var selecteditem = getSelectedFilter(group);
            patterngroup[getChildPosition(selecteditem) - 1].root = from.value.trim();
            filters.set(key, patterngroup);
        }
    }
};

var pageHandler = {
    onClick: function(e) {
        var at = e.target, from = e.relayTarget, where = e.currentTarget;
        if (from.classList.contains('template-list-item')) {
            if (at.classList.contains('action'))
                at.textContent = at.textContent === 'disable' ? 'enable' : 'disable';
        }
        else if (from.classList.contains('list-item')) {
            var key = filterKeyMap[where.parentNode.id];
            var patternlist = filters.get(key);
            if (at.classList.contains('delete')) {
                patternlist.splice(getChildPosition(from) - 1, 1);
                filters.set(key, patternlist);
                where.removeChild(from);
            }
            else if (at.classList.contains('action')) {
                var enabled = at.textContent === 'enable';
                patternlist[getChildPosition(from) - 1].enabled = +enabled;
                at.textContent = enabled ? 'disable' : 'enable';
                from.classList.toggle('disabled', !enabled);
                filters.set(key, patternlist);
            }
        }
    },

    onKeyup: function(e) {
        if (e.keyIdentifier === 'Enter') {
            var at = e.target, from = e.relayTarget, where = e.currentTarget;
            var text = at.value.trim();
            if (!text) return;
            var key = filterKeyMap[where.parentNode.id];
            var patternlist = filters.get(key);
            if (from.classList.contains('template-list-item')) {
                var disabled = from.querySelector('.action').textContent !== 'enable';
                patternlist.push({
                    pattern: text,
                    enabled: +disabled
                });
                addListboxItem(where, text, disabled, PLACEHOLDER_HREF);
            }
            else {
                patternlist[getChildPosition(from) - 1].pattern = text;
                renameListboxItem(from, text);
            }
            filters.set(key, patternlist);
            at.value = '';
            at.blur();
        }
        else if (e.keyIdentifier === 'U+001B')
            at.blur();
    },

    onMousedown: function(e) {
        var at = e.target, from = e.relayTarget, where = e.currentTarget;
        if (at.classList.contains('text')) {
            selectListboxItem(where, from);
            focusListboxItem(from);
        }
        else
            return true;
    },

    onBlur: function(e) {
        e.relayTarget.removeAttribute('selected');
    }
};

function initEvents() {
    relayEvent('.filter-set .listbox', 'keyup', 'li', pageHandler.onKeyup);
    relayEvent('.filter-set .listbox', 'mousedown', '.list-item', pageHandler.onMousedown);
    relayEvent('.filter-set .listbox', 'blur', '.list-item', pageHandler.onBlur, true);
    relayEvent('.filter-set .listbox', 'click', 'li', pageHandler.onClick);
    relayEvent('.group-filter-set', 'keyup', '.filter-group-host', selectiveHandler.onKeyup);
    relayEvent('.group-filter-set', 'blur', '.filter-group-host', selectiveHandler.onBlur, true);
    relayEvent('.group-filter-set .listbox', 'keyup', 'li', selectiveHandler.onKeyup);
    relayEvent('.group-filter-set .listbox', 'blur', '.list-item', selectiveHandler.onBlur, true);
    relayEvent('.group-filter-set .listbox', 'mousedown', '.list-item', selectiveHandler.onMousedown);
    relayEvent('.group-filter-set .listbox', 'click', 'li', selectiveHandler.onClick);
}

function initFiltersUI() {
    initPageFiltersUI($('page'));
    initGroupFiltersUI($('selective'));
    initGroupFiltersUI($('global'));
}

function updateFiltersUI() {
    updatePageFiltersUI($('page'));
    updateGroupFiltersUI($('selective'));
    updateGroupFiltersUI($('global'));
}

function initPageFiltersUI(group) {
    var templateitem = createListboxItem('', true, PLACEHOLDER_HREF);
    templateitem.className = 'template-list-item';
    group.querySelector('.listbox').appendChild(templateitem);
}

function initGroupFiltersUI(group) {
    var templateitem = createListboxItem('', true, PLACEHOLDER_ENTER);
    templateitem.className = 'template-list-item';
    group.querySelector('.filter-names').appendChild(templateitem);
    templateitem = createListboxItem('', true, PLACEHOLDER_PATHNAME);
    templateitem.className = 'template-list-item';
    group.querySelector('.filter-group').appendChild(templateitem);
}

function updatePageFiltersUI(group) {
    var elm = group.querySelector('.listbox');
    clearListbox(elm);
    filters.get(filterKeyMap[group.id]).forEach(function(item) {
        elm.appendChild(createListboxItem(item.pattern, item.enabled, PLACEHOLDER_HREF));
    });
}

function updateGroupFiltersUI(group) {
    var elm = group.querySelector('.filter-names');
    clearListbox(elm);
    clearListbox(group.querySelector('.filter-group'));
    filters.get(filterKeyMap[group.id]).forEach(function(item) {
        elm.appendChild(createListboxItem(item.name, item.enabled, PLACEHOLDER_ENTER));
    });
    elm = group.querySelector('.filter-patterns');
    elm.classList.remove('visible');
    elm.classList.add('hidden');
}

function onMessage(e) {
    if (e.data.event == 'navigation')
        showPage(e.data.id);
    else if (e.data.event == 'navigationLoaded')
        postChildMessage('submenu', {event: 'changeSelection', id: 'page'});
    else if (e.data.event == 'reset')
        updateFiltersUI();
}

window.addEventListener('message', onMessage);
chrome.runtime.getBackgroundPage(function(background) {
    filters = background.extension.exports.getFilters();
    initEvents();
    initFiltersUI();
    updateFiltersUI();
});
