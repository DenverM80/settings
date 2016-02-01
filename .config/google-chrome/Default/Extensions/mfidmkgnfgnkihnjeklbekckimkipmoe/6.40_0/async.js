ext.define('extension.utils', function() {

var OpQueue = {
    measureLag: function() {
        var now = Date.now();
        var interval = now - this.tick;
        if (interval >= this.unit) this.tick = now, this.operations = 0;
        if (this.operations < this.maxops) {
            this.operations += 1;
            return 0;
        }
        return this.unit - interval;
    },
    run: function() {
        this.timeout = null;
        var x = Math.min(this.queue.length, this.maxops);
        while (x--)
            this.put(this.queue.pop());
        if (this.queue.length)
            this.put(this.queue.pop());
    },
    put: function(func) {
        this.queue.push(func);
        var lag = this.measureLag();
        if (lag > 0 && this.timeout == null)
            this.timeout = window.setTimeout(this.run.bind(this), lag);
        if (lag === 0)
            this.queue.shift()();
    },
    clear: function() {
        window.clearTimeout(this.timeout);
        this.timeout = null;
        this.queue.splice(0, this.queue.length);
    }
};

function iterate(tasks, progress, complete) {
    if (tasks.length) {
        var f = Array.prototype.slice.call(tasks), l = f.length;
        window.setTimeout(function() {
            var p = function() {arguments.length && progress.apply(null, arguments); !(--l) && complete && complete();};
            while (f[0]) { f.shift()(p); }
        }, 0);
    }
    else complete && complete();
}

function opqueue(unit, maxops) {
    return Object.create(OpQueue, {
        queue: {value: []},
        operations: {value: 0, writable: true},
        timeout: {value: null, writable: true},
        tick: {value: 0, writable: true, enumerable: true},
        unit: {value: unit},
        maxops: {value: maxops}
    });
}

function process(tasks, complete) {
    if (tasks.length) {
        var f = Array.prototype.slice.call(tasks), l = f.length;
        window.setTimeout(function() {
            var p = function() { !(--l) && complete && complete(); };
            while (f[0]) { f.shift()(p); }
        }, 0);
    }
    else complete && complete();
}

function series(tasks, complete) {
    if (tasks.length) {
        var f = Array.prototype.slice.call(tasks);
        var p = function() { f.length ? f.shift()(p) : complete && complete(); };
        window.setTimeout(p, 0);
    }
    else complete && complete();
}

return {
    iterate: iterate,
    opqueue: opqueue,
    process: process,
    series: series
};

});
