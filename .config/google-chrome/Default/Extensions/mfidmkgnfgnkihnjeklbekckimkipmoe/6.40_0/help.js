$('report').onclick = function() {
    chrome.tabs.create({
        url: 'https://chrome.google.com/webstore/support/' + chrome.runtime.id + '#bug'
    });
};

var manifest = chrome.runtime.getManifest();
$('product-version').textContent = manifest.version;
$('extension-description').textContent = manifest.description;

var info = window.navigator.plugins['Shockwave Flash'];
$('flash-version').textContent = !info ? 'disabled' : info.description + ' ' + info.filename;

initExtensionNames([$q('#product-description > h2')]);
