relayEvent('.menu', 'click', 'li', function(e) {
    var selected = e.currentTarget.querySelector('.selected');
    if (selected)
        selected.classList.remove('selected');

    e.relayTarget.classList.add('selected');

    var where = e.relayTarget.querySelector('button').value;
    postParentMessage({event: 'navigation', id: where});
});

window.addEventListener('message', function(e) {
    if (e.data.event == 'changeSelection')
        $q('button[value="' + e.data.id + '"]').click();
});

postParentMessage({event: 'navigationLoaded'});
