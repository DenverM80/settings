var settings, filters, sync;
var manifest = chrome.runtime.getManifest();

var time = {
    components: function(sec) {
        var s = isNaN(sec) || sec < 0 ? 0 : sec;
        var h = 0 | (s / 3600);
        var m = 0 | (s / 60) - (h * 60);
        var ss = s - (h * 3600) - (m * 60);
        return [h, m, ss];
    },

    seconds: function(hrs, mins) {
        var h = isNaN(hrs) || hrs < 0 ? 0 : hrs | 0;
        var m = isNaN(mins) || mins < 0 ? 0 : mins | 0;
        return h * 3600 + m * 60;
    }
};

var colorutil = {
    components: {
        'RGB': {
            'Red': 255,
            'Green': 255,
            'Blue': 255,
            'Alpha': 100
        },
        'HSV': {
            'Hue': 360,
            'Saturation': 100,
            'Value': 100
        },
        'rgb': {
            'R': 255,
            'G': 0,
            'B': 0,
            'A': 1
        },
        'hsv': {
            'H': 0,
            'S': 100,
            'V': 100
        }
    },

    pos: function(e, r, v, i) {
        var s = (i === 'Alpha');
        var cw = e.color_canvas_width + 1;
        var n = s ? (1 - r) * 100 : r;
        e.element.querySelector('#' + i + 'Cur').style.left =
            parseInt((cw - (n / colorutil.components[v][i]) * cw - 5), 10) + 'px';
        e.element.querySelector('#' + i + 'Val').textContent =
            Math.round(s ? 100 - n : n);
    }
};

var color = (function() {

var components = /rgba\((\d+),\s?(\d+),\s?(\d+),\s?((?:\d+\.)?\d+)\)/i;
var alphanums = '0123456789ABCDEF';

var api = {
    ARR_OBJ: function(a) {
        return {
            R: a[0],
            G: a[1],
            B: a[2],
            A: a[3]
        };
    },

    RGBA_STR: function(obj) {
        return 'rgba(' + obj.R + ',' + obj.G + ',' + obj.B + ',' + obj.A.toFixed(2) + ')';
    },

    RGBA_OBJ: function(str) {
        var m = str.match(components);
        return {
            R: parseInt(m[1], 10),
            G: parseInt(m[2], 10),
            B: parseInt(m[3], 10),
            A: +parseFloat(m[4]).toFixed(2)
        };
    },

    RGBA_ARR: function(str) {
        var r = api.RGBA_OBJ(str);
        return [r.R, r.G, r.B, r.A];
    },

    HEX_OBJ: function(str) {
        return {
            R: parseInt(str.substring(0, 2), 16),
            G: parseInt(str.substring(2, 4), 16),
            B: parseInt(str.substring(4, 6), 16),
            A: 1
        };
    },

    HEX_ARR: function(str) {
        var r = api.HEX_OBJ(str);
        return [r.R, r.G, r.B, r.A];
    },

    OBJ_ARR: function(r) {
        return Array.isArray(r) ? r : [r.R, r.G, r.B, r.A];
    },

    HEX: function(num) {
        var n = Math.round(Math.min(Math.max(0, num), 255));
        return alphanums.charAt((n - n % 16) / 16) + alphanums.charAt(n % 16);
    },

    ARR_HEX: function(arr) {
        var f = api.HEX;
        return f(arr[0]) + f(arr[1]) + f(arr[2]);
    },

    RGB_HEX: function(obj) {
        var f = api.HEX;
        return f(obj.R) + f(obj.G) + f(obj.B);
    },

    RGB_HSV: function(obj) {
        var M = Math.max(obj.R, obj.G, obj.B),
            delta = M - Math.min(obj.R, obj.G, obj.B),
            H, S, V;
        if (M != 0) {
            S = Math.round(delta / M * 100);
            if (obj.R === M) H = (obj.G - obj.B) / delta;
            else if (obj.G === M) H = 2 + (obj.B - obj.R) / delta;
            else if (obj.B === M) H = 4 + (obj.R - obj.G) / delta;
            H = Math.min(Math.round(H * 60), 360);
            if (H < 0) H += 360;
        }
        return {
            H: H ? H : 0,
            S: S ? S : 0,
            V: Math.round((M / 255) * 100)
        };
    },

    HSV_RGB: function(obj) {
        var H = obj.H / 360,
            S = obj.S / 100,
            V = obj.V / 100,
            R, G, B, C, D, A;
        if (S === 0)
            R = G = B = Math.round(V * 255);
        else {
            if (H >= 1) H = 0;
            H = 6 * H;
            D = H - ~~H;
            A = Math.round(255 * V * (1 - S));
            B = Math.round(255 * V * (1 - (S * D)));
            C = Math.round(255 * V * (1 - (S * (1 - D))));
            V = Math.round(255 * V);
            switch (H | 0) {
                case 0:
                    R = V;
                    G = C;
                    B = A;
                    break;
                case 1:
                    R = B;
                    G = V;
                    B = A;
                    break;
                case 2:
                    R = A;
                    G = V;
                    B = C;
                    break;
                case 3:
                    R = A;
                    G = B;
                    B = V;
                    break;
                case 4:
                    R = C;
                    G = A;
                    B = V;
                    break;
                case 5:
                    R = V;
                    G = A;
                    B = B;
                    break;
            }
        }
        return {
            R: R,
            G: G,
            B: B
        };
    }
};

return api;

})();

var colorpicker = function(canvas) {
    this.target_canvas = canvas;
    this.color_canvas_width = 150;
    this.color_canvas_height = 18;

    this.element = document.createElement('div');
    this.element.classList.add('color-picker-box');

    var this_ = this;
    var element = this.element;
    var stop = true;
    var coords = {};

    function mousehandler(e) {
        e.preventDefault();
        var x = coords.x, y = coords.y, z = coords.z;
        var v = Math.max(x, y ? Math.min(y, (e.clientX - z) + x) : (e.clientX - z) + x);
        if (e.type === 'mousemove') {
            if (!stop)
                this_.compute(v);
        }
        else {
            stop = true;
            document.removeEventListener('mousemove', mousehandler);
            document.removeEventListener('mouseup', mousehandler);
            this_.compute(v);
        }
    }

    function cOff(e, o, x, y, F) {
        if (stop) {
            var z = 0, tf = element.querySelector('#' + o);
            if (element.offsetParent) {
                do {
                    z += tf.offsetLeft;
                } while (tf = tf.offsetParent);
            }
            stop = false;
            coords.x = x;
            coords.y = y;
            coords.z = z;
            this_.compute = F;
            document.addEventListener('mousemove', mousehandler);
            document.addEventListener('mouseup', mousehandler);
            F(Math.max(x, y ? Math.min(y, (e.clientX - z) + x) : (e.clientX - z) + x));
        }
    }

    function cSet(v, k) {
        return function(e) {
            e.preventDefault();
            e.stopPropagation();
            var glasspane = document.createElement('div');
            glasspane.classList.add('glass-pane');
            document.addEventListener('mouseup', function gphandler() {
                document.removeEventListener('mouseup', gphandler);
                glasspane.parentNode.removeChild(glasspane);
            });
            element.insertBefore(glasspane, element.firstChild);
            cOff(e, k, 0, this_.color_canvas_width + 1, function(b) {
                var m = colorutil.components[v.toUpperCase()][k];
                var n = Math.max(0, b) / (this_.color_canvas_width + 1);
                colorutil.components[v.toLowerCase()][k[0]] = (k === 'Alpha') ?
                    n : Math.round((1 - n) * m);
                this_.colorize(k, '');
            });
        }
    }

    var area = element.appendChild(document.createElement('div'));
    area.classList.add('color-picker-area');

    var R = {
        'Hue': 'HSV',
        'Saturation': 'HSV',
        'Value': 'HSV',
        'Red': 'RGB',
        'Green': 'RGB',
        'Blue': 'RGB',
        'Alpha': 'RGB'
    };
    var label, elm, box;
    for (var i in R) {
        elm = label = area.appendChild(document.createElement('div'));
        elm.title = i[0].toUpperCase() + i.substr(1);

        elm = label.appendChild(document.createElement('div'));
        elm.classList.add('west');
        elm.textContent = i.substr(0, 1).toUpperCase();

        box = label.appendChild(document.createElement('div'));
        box.classList.add('color-picker-container');

        var c = cSet(R[i], i);
        elm = box.appendChild(document.createElement('div'));
        elm.classList.add('cur');
        elm.id = i + 'Cur';
        elm.addEventListener('mousedown', c, true);

        elm = box.appendChild(document.createElement('canvas'));
        elm.classList.add('checkered');
        elm.id = i;
        elm.width = this.color_canvas_width;
        elm.height = 16;
        elm.addEventListener('mousedown', c, true);

        elm = label.appendChild(document.createElement('div'));
        elm.classList.add('east');
        elm.id = i + 'Val';
    }
};

colorpicker.prototype.colorize = function(m, a) {
    var h, r, l = 'Red';
    if (a) {
        r = colorutil.components['rgb'] = color.ARR_OBJ(a);
        h = colorutil.components['hsv'] = color.RGB_HSV(r);
    }
    else {
        r = colorutil.components['rgb'];
        h = colorutil.components['hsv'];
    }
    if (m in colorutil.components['HSV']) {
        var t = color.HSV_RGB(h);
        t['A'] = r['A'];
        r = colorutil.components['rgb'] = t;
    }
    else if (m in colorutil.components['RGB']) {
        h = colorutil.components['hsv'] = color.RGB_HSV(r);
    }
    var R = {
        'Hue': [
            [0, {'H': 0, 'S': h['S'], 'V': h['V']}],
            [0.15, {'H': 300, 'S': h['S'], 'V': h['V']}],
            [0.30, {'H': 240, 'S': h['S'], 'V': h['V']}],
            [0.50, {'H': 180, 'S': h['S'], 'V': h['V']}],
            [0.65, {'H': 120, 'S': h['S'], 'V': h['V']}],
            [0.85, {'H': 60, 'S': h['S'], 'V': h['V']}],
            [1, {'H': 0, 'S': h['S'], 'V': h['V']}]
        ],
        'Saturation': [
            [0, {'H': h['H'], 'S': 100, 'V': h['V']}],
            [1, {'H': h['H'], 'S': 0, 'V': h['V']}]
        ],
        'Value': [
            [0, {'H': h['H'], 'S': h['S'], 'V': 100}],
            [1, {'H': h['H'], 'S': h['S'], 'V': 0}]
        ],
        'Red': [
            [0, {'R': 255, 'G': r['G'], 'B': r['B'], 'A': r['A']}],
            [1, {'R': 0, 'G': r['G'], 'B': r['B'], 'A': r['A']}]
        ],
        'Green': [
            [0, {'R': r['R'], 'G': 255, 'B': r['B'], 'A': r['A']}],
            [1, {'R': r['R'], 'G': 0, 'B': r['B'], 'A': r['A']}]
        ],
        'Blue': [
            [0, {'R': r['R'], 'G': r['G'], 'B': 255, 'A': r['A']}],
            [1, {'R': r['R'], 'G': r['G'], 'B': 0, 'A': r['A']}]
        ],
        'Alpha': [
            [0, {'R': r['R'], 'G': r['G'], 'B': r['B'], 'A': 0}],
            [1, {'R': r['R'], 'G': r['G'], 'B': r['B'], 'A': 1}]
        ]
    };
    for (var i in R) {
        var c = this.element.querySelector('#' + i).getContext('2d');
        c.globalCompositeOperation = 'copy';
        var g = c.createLinearGradient(0, 0, this.color_canvas_width, this.color_canvas_height);
        var rI = R[i];
        for (var x = 0; x < rI.length; x++) {
            var y = rI[x], k = y[1];
            if (i in colorutil.components['HSV']) {
                k = color.HSV_RGB(k);
                k['A'] = r['A'];
            }
            g.addColorStop(y[0], color.RGBA_STR(k));
        }
        c.rect(0, 0, this.color_canvas_width, this.color_canvas_height);
        c.fillStyle = g;
        c.fill();
        if (colorutil.components['HSV'][i])
            colorutil.pos(this, h[i[0]], 'HSV', i);
        else
            colorutil.pos(this, r[i[0]], 'RGB', i);
    }
    var rc = this.target_canvas.getContext('2d');
    rc.globalCompositeOperation = 'copy';
    rc.fillStyle = color.RGBA_STR(r);
    rc.fillRect(0, 0, parseInt(this.target_canvas.width, 10) * 2,
        parseInt(this.target_canvas.height, 10) * 2);
};

colorpicker.prototype.value = function() {
    return this.target_canvas.getContext('2d').fillStyle;
};

var modal = (function() {
    var overlay = null;

    var dialogs = {
        'intro': function() {
            initExtensionNames([overlay.querySelector('h1')]);
            overlay.querySelector('.page').classList.add('intro');
        },

        'info': function(title, content) {
            overlay.querySelector('h1').textContent = title;
            overlay.querySelector('.content-area').textContent = content;
            overlay.querySelector('.cancel-button').addEventListener('click', hideOverlay);
            overlay.querySelector('.cancel-button').focus();
        },

        'reset': function(onSettings, onFilters) {
            relayEvent(overlay, 'click', '.button-strip button', function(e) {
                if (e.relayTarget.classList.contains('erase-button')) {
                    var s = overlay.querySelector('.settings-checkbox').checked;
                    var f = overlay.querySelector('.filters-checkbox').checked;
                    if (s || f) {
                        overlay.querySelector('.action-area span').textContent = 'Erasing data...';
                        var t = Date.now();
                        if (s)
                            onSettings();
                        if (f)
                            onFilters();
                        window.setTimeout(hideOverlay, Math.max(700 - (Date.now() - t), 0));
                        return;
                    }
                }
                hideOverlay();
            });
        },

        'sync': function(onSync, onSettings, onFilters) {
            relayEvent(overlay, 'click', '.button-strip button, input[type=checkbox]', function(e) {
                if (e.relayTarget.classList.contains('sync-checkbox')) {
                    onSync(e.relayTarget.checked);
                    return true;
                }
                if (e.relayTarget.classList.contains('settings-checkbox')) {
                    onSettings(e.relayTarget.checked);
                    return true;
                }
                if (e.relayTarget.classList.contains('filters-checkbox')) {
                    onFilters(e.relayTarget.checked);
                    return true;
                }
                hideOverlay();
            });
            overlay.querySelector('.sync-checkbox').checked = onSync();
            overlay.querySelector('.settings-checkbox').checked = onSettings();
            overlay.querySelector('.filters-checkbox').checked = onFilters();
        },

        'import': function(onImport, onExport) {
            relayEvent(overlay, 'click', '.button-strip button, .content-area button', function(e) {
                if (e.relayTarget.classList.contains('import-button')) {
                    var s = e.currentTarget.querySelector('.import-input').files[0];
                    if (s) {
                        overlay.querySelector('.action-area span').textContent = 'Importing data...';
                        var t = Date.now();
                        onImport(s);
                        window.setTimeout(hideOverlay, Math.max(700 - (Date.now() - t), 0));
                    }
                    return;
                }
                if (e.relayTarget.classList.contains('export-button')) {
                    var i = e.currentTarget.querySelector('.export-input');
                    onExport(i.value.trim() || i.placeholder);
                }
                hideOverlay();
            });
        },

        'colorpicker': function(onPick) {
            var picker = new colorpicker(overlay.querySelector('.content-area canvas'));
            picker.colorize('set', onPick());
            relayEvent(overlay, 'click', '.button-strip button', function(e) {
                if (e.relayTarget.classList.contains('reset-button')) {
                    picker.colorize('set', onPick());
                    return;
                }
                if (e.relayTarget.classList.contains('save-button')) {
                    var col = picker.value();
                    onPick(col[0] === '#' ?
                        color.HEX_ARR(col.substring(1)) : color.RGBA_ARR(col));
                }
                hideOverlay();
            });
            overlay.querySelector('.content-area').appendChild(picker.element);
        },

        'placeholdericon': function(onIcon, onSize) {
            var radio = overlay.querySelectorAll('label input[type=radio]');
            var range = overlay.querySelector('input[type=range]');
            var image = overlay.querySelectorAll('label div img');
            var icon = onIcon();
            var size = onSize();

            relayEvent(overlay, 'click', '.button-strip button, input[type=checkbox], input[type=radio]',
                function(e) {
                    if (e.relayTarget.type === 'radio') {
                        var src = e.relayTarget.previousElementSibling.firstElementChild.src;
                        onIcon(src.match(/[a-z]+\.svg$/)[0]);
                        return true;
                    }
                    hideOverlay();
                });

            range.addEventListener('mouseup', function(e) {
                onSize(e.target.value);
            });

            range.addEventListener('change', function(e) {
                for (var i = 0; i < image.length; i++)
                    image[i].width = image[i].height = e.target.valueAsNumber;
            });

            range.value = size;

            for (var i = 0; i < radio.length; i++) {
                var img = radio[i].previousElementSibling.firstElementChild;
                img.width = img.height = size;
                if (img.src.indexOf(icon) != -1)
                    radio[i].checked = true;
            }
        },

        'omniboxmenu': function(onAlways, onCounter) {
            relayEvent(overlay, 'click', '.button-strip button, input[type=checkbox]',
                function(e) {
                    if (e.relayTarget.classList.contains('always-checkbox')) {
                        onAlways(e.relayTarget.checked);
                        return true;
                    }
                    if (e.relayTarget.classList.contains('counter-checkbox')) {
                        onCounter(e.relayTarget.checked);
                        return true;
                    }
                    hideOverlay();
                });
            overlay.querySelector('.always-checkbox').checked = onAlways();
            overlay.querySelector('.counter-checkbox').checked = onCounter();
        }
    };

    function showOverlay(type) {
        if (overlay)
            return;
        var temp = $x(type);
        if (!temp)
            return;
        overlay = document.createElement('div');
        overlay.className = 'overlay';
        overlay.appendChild(temp);
        overlay.addEventListener('click', function(e) {
            if (overlay !== e.target)
                return;
            var page = overlay.querySelector('.page');
            page.classList.add('pulse');
            page.addEventListener('webkitAnimationEnd', function(e) {
                page.classList.remove('pulse');
            });
        });
        relayEvent(overlay, 'click', '.close-button', hideOverlay);
        if (type in dialogs)
            dialogs[type].apply(null, Array.prototype.slice.call(arguments, 1));
        document.body.appendChild(overlay);
        postParentMessage({event: 'sendToBackground'});
    }

    function hideOverlay() {
        if (!overlay)
            return;
        overlay.classList.add('transparent');
        window.setTimeout(function() {
            if (!overlay)
                return;
            document.body.removeChild(overlay);
            overlay = null;
            postParentMessage({event: 'sendToForeground'});
        }, 250);
    }

    return {
        show: showOverlay,
        hide: hideOverlay
    };
})();

var ui = {
    get: function(input) {
        ui.callHandler(input, true);
    },

    set: function(input) {
        ui.callHandler(input);
    },

    callHandler: function(input, retrieve) {
        var handler = ui.elmIds[input.id] || ui.elmTypes[input.type];
        if (handler)
            handler(input, retrieve);
    },

    elmTypes: {
        'text': function(input, retrieve) {
            if (retrieve)
                return input.value = settings.get(input.id);
            settings.set(input.id, input.value);
        },

        'checkbox': function(input, retrieve) {
            if (retrieve)
                return input.checked = settings.get(input.id);
            settings.set(input.id, +input.checked);
        },

        'select-one': function(input, retrieve) {
            if (retrieve)
                return input.selectedIndex = settings.get(input.id);
            settings.set(input.id, input.selectedIndex);
        }
    },

    elmIds: {
        'foreground': function(input, retrieve) {
                if (retrieve)
                    return input.checked = settings.get('tabfocus') & 0x01;
                settings.set('tabfocus', (settings.get('tabfocus') & 0x02) | input.checked);
        },
        'background': function(input, retrieve) {
                if (retrieve)
                    return input.checked = settings.get('tabfocus') & 0x02;
                settings.set('tabfocus', (settings.get('tabfocus') & 0x01) | (input.checked << 1));
        },
        'alltabs': function(input, retrieve) {
                if (retrieve)
                    return input.checked = settings.get('idletabs') == 0x00;
                settings.set('idletabs', input.checked ^ 0x01);
        },
        'bgtabs': function(input, retrieve) {
                if (retrieve)
                    return input.checked = settings.get('idletabs') == 0x01;
                settings.set('idletabs', input.checked ^ 0x00);
        },
        'idlehours': function(input, retrieve) {
                if (retrieve)
                    return input.value = time.components(settings.get('idleseconds'))[0] || '';
                var comps = time.components(settings.get('idleseconds'));
                settings.set('idleseconds', time.seconds(input.value, comps[1]));
        },
        'idleminutes': function(input, retrieve) {
                if (retrieve)
                    return input.value = time.components(settings.get('idleseconds'))[1] || '';
                var comps = time.components(settings.get('idleseconds'));
                settings.set('idleseconds', time.seconds(comps[0], input.value));
        }
    }
};

function getError(i) {
    var m = '';
    switch (i.id) {
        case 'idlehours':
        case 'idleminutes':
            var value = i.value.trim();
            if (!/^(\d+|)$/.test(value))
                m = 'Invalid number';
            else if (value < +i.min)
                m = 'Min value is ' + i.min;
            else if (value > (+i.max || Infinity))
                m = 'Max value is ' + i.max;
            break;
    }
    return m;
}

function changePlaceholderColor() {
    modal.show('colorpicker',
        function() {
            if (arguments.length === 0)
                return color.OBJ_ARR(settings.get('panelcolor'));
            settings.set('panelcolor', arguments[0]);
        }
    );
}

function selectPlaceholderIcon() {
    modal.show('placeholdericon',
        function() {
            if (arguments.length === 0)
                return settings.get('panelbgimage');
            settings.set('panelbgimage', arguments[0]);
        },
        function() {
            if (arguments.length === 0)
                return settings.get('panelbgsize');
            settings.set('panelbgsize', +arguments[0]);
        }
    );
}

function configureOmniboxMenu() {
    modal.show('omniboxmenu',
        function() {
            if (arguments.length === 0)
                return settings.get('omnialways');
            settings.set('omnialways', +arguments[0]);
        },
        function() {
            if (arguments.length === 0)
                return settings.get('plugincounter');
            settings.set('plugincounter', +arguments[0]);
        }
    );
}

function resetSettings() {
    modal.show('reset',
        function() {
            var d = settings.get();
            for (var k in d) d[k] = null;
            settings.set(d);
            initSettingsUI();
        },
        function() {
            var d = filters.get();
            for (var k in d) d[k] = null;
            filters.set(d);
            initFiltersUI();
        }
    );
}

function manageSync() {
    modal.show('sync',
        function() {
            if (arguments.length === 0)
                return sync.get('enabled');
            sync.set('enabled', +arguments[0]);
        },
        function() {
            if (arguments.length === 0)
                return sync.get('settings');
            sync.set('settings', +arguments[0]);
        },
        function() {
            if (arguments.length === 0)
                return sync.get('filters');
            sync.set('filters', +arguments[0]);
        }
    );
}

function importExportFilters() {
    modal.show('import',
        function(filename) {
            var reader = new FileReader();
            reader.onload = function(e) {
                try {
                    function stripPrefix(key) { return key.replace(/^[a-z]+\./i, ''); }
                    var data = JSON.parse(e.target.result);
                    settings.set(data);
                    var f = filters.get(), g = Object.keys(f).map(stripPrefix);
                    for (var k in data) {
                        var name = stripPrefix(k);
                        if (g.indexOf(name) != -1)
                            filters.set(name, f['data.' + name].concat(data[k]));
                    }
                    initFiltersUI();
                    initSettingsUI();
                }
                catch (err) {
                    console.error("error: couldn't read", filename);
                }
            };
            reader.readAsText(filename, 'UTF-8');
        },
        function(filename) {
            var d = filters.get(), e = settings.get();
            for (var k in e) d[k] = e[k];
            d = JSON.stringify(d, null, 4);
            var a = document.createElement('a');
            a.download = filename.replace(/(\.json)?$/i, '.json');
            a.href = window.URL.createObjectURL(new Blob([d], {type: 'application/json'}));
            a.click();
            window.setTimeout(function() {window.URL.revokeObjectURL(a.href);}, 1000);
        }
    );
}

function onUISelect(e) {
    ui.set(e.target);
    return true;
}

function onUIBlur(e) {
    var error = getError(e.target);
    if (error) {
        modal.show('info', 'Error', error);
        ui.get(e.target);
    }
    else
        ui.set(e.target);
}

function onUIKeyup(e) {
    if (e.keyIdentifier == 'U+001B') {
        ui.get(e.target);
        e.preventDefault();
    }
    else if (e.keyIdentifier == 'Enter')
        e.target.blur();
}

function onUIClick(e) {
    switch (e.target.id) {
        case 'color':
            changePlaceholderColor();
            break;
        case 'icon':
            selectPlaceholderIcon();
            break;
        case 'menu':
            configureOmniboxMenu();
            break;
        case 'reset':
            resetSettings();
            break;
        case 'sync':
            manageSync();
            break;
        case 'import':
            importExportFilters();
            break;
    }
}

function initEvents() {
    relayEvent(document.body, 'keyup', 'input[type=text]', onUIKeyup);
    relayEvent(document.body, 'blur', 'input[type=text]', onUIBlur, true);
    relayEvent(document.body, 'change', 'select, input[type=checkbox], input[type=radio]', onUISelect);
    relayEvent(document.body, 'click', 'button, a.action-link', onUIClick);
}

function initSettingsUI() {
    ui.get($('alltabs'));
    ui.get($('bgtabs'));
    ui.get($('background'));
    ui.get($('defaultmode'));
    ui.get($('contextmenu'));
    ui.get($('enabled'));
    ui.get($('flashborder'));
    ui.get($('flashquality'));
    ui.get($('foreground'));
    ui.get($('idlehours'));
    ui.get($('idleminutes'));
    ui.get($('omniicon'));
    ui.get($('optionsview'));
    ui.get($('paneltooltip'));
    ui.get($('panelclick'));
    ui.get($('showicon'));
    ui.get($('toolbar'));
    ui.get($('toolbarposition'));
}

function initFiltersUI() {
    postParentMessage({event: 'relayMessage', target: 'whitelist', message: {event: 'reset'}});
    postParentMessage({event: 'relayMessage', target: 'blacklist', message: {event: 'reset'}});
}

chrome.runtime.getBackgroundPage(function(page) {
    page.extension.ready.addListener(function() {
        settings = page.extension.exports.getSettings();
        filters = page.extension.exports.getFilters();
        sync = page.extension.exports.getSync();
        initEvents();
        initSettingsUI();
    });
});

initExtensionNames([
    $q('body > div > div > section:nth-child(2) > div.checkbox > label > span'),
    $q('body > div > div > section:nth-child(2) > span')
]);

if (!window.localStorage.firstRun) {
    window.localStorage.firstRun = 1;
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.type = 'text/css';
    css.href = 'firstrun.css';
    document.head.appendChild(css);
    modal.show('intro');
}
