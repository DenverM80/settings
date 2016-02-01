function $(id) {
    return document.getElementById(id);
}

function $q(str) {
    return document.querySelector(str);
}

function $a(str) {
    return document.querySelectorAll(str);
}

function $x(str) {
    var n = $q('template.' + str);
    if (n)
        return n.content.cloneNode(true);
}

function relayEvent(elm, evt, sel, fn, capt) {
    var callback = function(e) {
        var i = 0;
        var el;
        var target = e.target;
        var children = e.currentTarget.querySelectorAll(sel);
        while ((el = children[i++])) {
            if (el === target || el.contains(target)) {
                var ret = fn.call(el, {
                    target: target,
                    relayTarget: el,
                    currentTarget: e.currentTarget,
                    keyIdentifier: e.keyIdentifier,
                    keyCode: e.keyCode,
                    preventDefault: function() {e.preventDefault();},
                    stopPropagation: function() {e.stopPropagation();}
                });
                if (!ret)
                    e.preventDefault();
                return ret;
            }
        }
    }
    var elms = typeof elm === 'string' ? $a(elm) : [elm];
    for (var i = 0; i < elms.length; i++)
        elms[i].addEventListener(evt, callback, !!capt);
}

function getChildPosition(element) {
    var i = 0, e = element;
    while (e = e.previousElementSibling) i++;
    return i;
}

function showGlassPane() {
    var node = document.createElement('div');
    node.className = 'glasspane';
    document.body.appendChild(node);
}

function initExtensionNames(qlist) {
    var n = chrome.runtime.getManifest().name;
    var f = function() {
        var v = Array.prototype.slice.call(arguments, 1);
        return arguments[0].replace(/{(\d+)}/g, function(s, x) {
            return v[x];
        });
    }
    for (var i = 0; i < qlist.length; i++)
        qlist[i].textContent = f(qlist[i].textContent, n);
}
