ext.define('extension.utils', function() {

var rxaccept = /^https?:\/\/(?!(chrome\.google\.com\/webstore))/;

var Event = {
    addListener: function(func) {
        this.removeListener(func);
        this.listeners.push(func);
    },
    removeListener: function(func) {
        var i = this.listeners.indexOf(func);
        if (i != -1) this.listeners.splice(i, 1);
    },
    fire: function() {
        while (this.listeners.length)
            this.listeners.shift()();
        this.addListener = echo();
    }
};

var Queue = {
    put: function(item) {
        this.list.push(item);
    },
    get: function() {
        if (this.list.length) {
            var item = this.list[this.cursor];
            this.list[this.cursor] = null;
            if (++this.cursor * 2 >= this.list.length) {
                this.list.splice(0, this.cursor);
                this.cursor = 0;
            }
            return item;
        }
    },
    size: function() {
        return this.list.length - this.cursor;
    },
    peek: function(index) {
        if (this.list.length)
            return this.list[index || this.cursor];
    },
    clear: function() {
        this.list = [];
        this.cursor = 0;
    }
};

function adapter(store, prefix) {
    return {
        set: function(key, value) {
            if (typeof key === 'string') store.set(prefix + key, copy(value));
            else store.set(key);
        },
        get: function(key) {
            return copy(store.get(key ? prefix + key : null));
        }
    };
}

function copy(obj) {
    return typeof obj === 'object' && obj != null ? JSON.parse(JSON.stringify(obj)) : obj;
}

function diff(changes, obj) {
    var c = {added: {}, removed: [], values: {}};
    for (var k in changes) {
        if (changes[k].newValue != null) {
            c.added[k] = changes[k].newValue;
            c.values[k] = changes[k].newValue;
            continue;
        }
        c.values[k] = obj[k];
        c.removed.push(k);
    }
    return c;
}

function echo() {
    return function(func) { func(); }
}

function equals(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

function event() {
    return Object.create(Event, {listeners: {value: []}});
}

function merge(a, b) {
    for (var k in b) a[k] = b[k]; return a;
}

function object(key, value) {
    if (typeof key === 'string') {
        var o = {}; o[key] = value;
        return o;
    }
    return key;
}

function permitted(str) {
    return rxaccept.test(str);
}

function queue() {
    return Object.create(Queue, {
        list: {value: []},
        cursor: {value: 0, writable: true}
    });
}

function scan(a, b) {
    var o = {};
    for (var k in b) o[k] = k in a ? a[k] : b[k];
    return o;
}

function time() {
    var t = new Date();
    return t.getHours() + ':' + t.getMinutes() + ':' +
        ('00' + t.getSeconds()).slice(-2);
}

return {
    adapter: adapter,
    copy: copy,
    diff: diff,
    echo: echo,
    equals: equals,
    event: event,
    merge: merge,
    object: object,
    permitted: permitted,
    queue: queue,
    scan: scan,
    time: time
};

});
