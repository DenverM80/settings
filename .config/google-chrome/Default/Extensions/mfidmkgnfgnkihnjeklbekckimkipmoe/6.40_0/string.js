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
