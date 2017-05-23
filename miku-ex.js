var MAX_LEVELS = 333;
var REFRESH_INTERVAL = 1000 * 60 * 10;

var api, checkInterval, ffz;
var enabled = {};
var levels = {};

var brightColors = ['#d2d500', '#b3ee00', '#00ffff'];
var colorThresholds = [
    [10, '#d2d500'],
    [20, '#b3ee00'],
    [30, '#ff9600'],
    [40, '#ff0000'],
    [50, '#00ffff'],
    [60, '#009fff'],
    [70, '#7a62d3'],
    [80, '#fc00ff'],
    [90, '#7700a9'],
    [100, '#00a938']
];

// stolen from mau
var invalidHosts = ['api.', 'api-akamai.', 'chatdepot.', 'im.', 'spade.', 'tmi.'];
var isInvalidHost = () => {
    for(let hostname of invalidHosts) {
        if(window.location.host.indexOf(hostname) != -1) {
            return true;
        }
    }
    return false;
}

var determineBackgroundColor = (level) => {
    if(level < 100) {
        return 'transparent';
    } else {
        return determineColor(level);
    }
}

var determineColor = (level) => {
    var color = '#777';

    for(var i in colorThresholds) {
        if((level % 100) >= colorThresholds[i][0]) {
            color = colorThresholds[i][1];
        }
    }

    return color;
}

var determineTextColor = (level, dark) => {
    if(level < 100 && !dark) {
        return 'black';
    } if(level < 100 && dark) {
        return 'white';
    } else {
        if(brightColors.indexOf(determineColor(level)) > -1) {
            return 'black';
        } else {
            return 'white';
        }
    }
}

var getExperience = (level) => {
    if(level > 0) {
        return (((level * 20) * level * 0.8) + level * 100) - 16;
    } else {
        return 0;
    }
}

var getLevel = (experience) => {
    var level = 0;
    while(experience >= getExperience(level)) {
        level++;
    }
    return level - 1;
}

var check = () => {
    if(isInvalidHost()) {
        console.log('Miku: Invalid host: ' + window.location.host);
        return;
    }

    if(window.FrankerFaceZ !== undefined && window.App !== undefined) {
        console.log('Miku: Found FFZ.');
        init();
    } else {
        console.log('Miku: Found nothing.');
        setTimeout(() => { check(); }, 100);
    }
}

var doCSS = () => {
    var css = '<style>div[class^="ffz-badge-ffzmiku-level-"], div[class*=" ffz-badge-ffzmiku-level-"] { \
        border-radius: 50px; \
        line-height: 12px; \
        text-align: center; \
    } \
    div[class^="ffz-badge-ffzmiku-level-"]:after, div[class*=" ffz-badge-ffzmiku-level-"]:after { \
        font-size: 8px; \
        top: 5px; \
        width: 14px; \
    }';

    for(var i = 0; i < MAX_LEVELS; i++) {
        css += '.ffz-badge-ffzmiku-level-' + i + ' { \
            border: 2px solid ' + determineColor(i) + '; \
            color: ' + determineTextColor(i, false) + '; \
        } \
        .ffz-badge-ffzmiku-level-' + i + ':after { \
            content: "' + i + '"; \
        } \
        .dark .ffz-badge-ffzmiku-level-' + i + ' { \
            color: ' + determineTextColor(i, true) + '; \
        }';
    }

    css += '</style>';

    $('head').append(css);
}

var updateLevel = (roomId, username) => {
    $.get('https://mikuia.tv/api/user/' + username + '/levels/' + roomId).done((stats) => {
        var level = getLevel(stats.experience ? stats.experience : 0);

        if(stats.experience == null || stats.experience == 0) {
            return;
        }

        if(levels[roomId][username] != null && levels[roomId][username].level != level) {
            api.room_remove_user_badge(roomId, username, 7);
        }

        levels[roomId][username] = {
            level: level,
            timestamp: new Date
        }

        api.room_add_user_badge(roomId, username, 7, {
            color: determineBackgroundColor(level),
            id: 'level-' + level,
            name: 'level-' + level,
            title: 'Mikuia Level ' + level,
            click_url: 'https://mikuia.tv/levels/' + roomId
        });
        api.retokenize_messages(roomId, username, null, true);

        // console.log(levels);
    });
}

var init = () => {
    ffz = FrankerFaceZ.get();
    api = ffz.api('FFZ: Mikuia Extras', 'https://placekitten.com/18/18', '0.0.1', 'ffzmiku');

    api.add_badge('idiot', {
        color: '#7a62d3',
        image: 'https://extras.mikuia.tv/icon/18.png',
        name: 'idiot',
        title: 'Mikuia Developer',
        click_url: 'https://mikuia.tv',
        urls: {
            1: 'https://extras.mikuia.tv/icon/18.png',
            2: 'https://extras.mikuia.tv/icon/36.png',
            4: 'https://extras.mikuia.tv/icon/72.png'
        }
    });

    api.add_badge('mikuia', {
        color: '#7a62d3',
        image: 'https://extras.mikuia.tv/icon/18.png',
        name: 'mikuia',
        title: 'Mikuia',
        click_url: 'https://mikuia.tv',
        urls: {
            1: 'https://extras.mikuia.tv/icon/18.png',
            2: 'https://extras.mikuia.tv/icon/36.png',
            4: 'https://extras.mikuia.tv/icon/72.png'
        }
    });

    // api.remove_user_badge('hatsuney', 6);
    api.user_add_badge('hatsuney', 5, 'idiot');
    api.user_add_badge('mikuia', 5, 'mikuia');

    api.on('room-add', (roomId) => {
        console.log('Miku: Joined room: ' + roomId);
        if(levels[roomId] == null) {
            enabled[roomId] = false;
            levels[roomId] = {};

            $.get('https://mikuia.tv/api/levels/' + roomId).done((levels) => {
                if(levels.total != null && levels.total > 0) {
                    enabled[roomId] = true;
                }
            })
        }
    });

    api.on('room-message', (data) => {
        if(!data.room || !data.from) return;
        if(!enabled[data.room]) return;
        if(data.from == 'jtv' || data.from == data.room || data.room.indexOf('_frankerfacez') == 0) return;

        var roomId = data.room;
        var username = data.from;

        if(levels[roomId][username] == null) {
            // console.log('Miku: No levels for ' + username + ' on room ' + roomId);
            updateLevel(roomId, username);
        } else {
            var now = new Date
            if(now - levels[roomId][username].timestamp > REFRESH_INTERVAL) {
                updateLevel(roomId, username);
            }
        }

        // console.log(data);
    })

    api.iterate_rooms();

    doCSS();
}

check();