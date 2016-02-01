function postParentMessage(msg) {
    window.parent.postMessage(msg, chrome.runtime.getURL(''));
}

function postChildMessage(iframeName, msg) {
    var iframe = $q('iframe[name=' + iframeName + ']');
    if (iframe)
        iframe.contentWindow.postMessage(msg, chrome.runtime.getURL(''));
}

function showPage(id, src) {
    var container = $(id);
    var selected = $q('.view > .selected');

    if (container === selected)
        return;

    if (src) {
        var iframe = container.querySelector('iframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.src = src;
            iframe.name = getFilename(src);
            container.appendChild(iframe);
        }
        else
            iframe.contentWindow.location.replace(src);
    }

    if (selected)
        selected.classList.remove('selected');

    container.style.display = 'block';

    setTimeout(function() {
        container.classList.add('selected');
    }, 50);

    setTimeout(function() {
        var containers = document.querySelectorAll('.view > :not(.selected)');
        for (var i = 0; i < containers.length; i++)
            containers[i].style.display = 'none';
    }, 100);
}

function getFilename(path) {
    var p = chrome.runtime.getURL(path);
    return p.substr(p.lastIndexOf('/') + 1).replace(/\..*/, '');
}
