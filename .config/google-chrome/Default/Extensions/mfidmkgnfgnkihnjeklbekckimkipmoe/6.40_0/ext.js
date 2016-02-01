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
