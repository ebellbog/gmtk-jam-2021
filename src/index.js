import _ from 'lodash';
import './index.less';

const $game = $('#game');

const colorDict = {
    red: 0,
    orange: 1,
    yellow: 2,
    green: 3,
    blue: 4,
    purple: 5
}
const colorList = Object.keys(colorDict);
let multipliers;

const CIRCLE_SIZE = 20;
const CIRCLE_SPACING = 30;

const GAME_COLS = 10;
const GAME_ROWS = 8;

let $newConnection, $startPt;
let allowedColors, currentColor;
let $connections = [];

const messageQueue = [];
let isFlashing = false;

let isPlaying = false;
let level;

const goalScores = [160, 200, 260];
let totalScore = 0;

$(document).ready(() => {
    setupFlag();
    setupGame();
    hookEvents();
});

function hookEvents() {
    $game
        .on('mousedown', 'circle', (e) => {
            if (!isPlaying) return;
            if (!(e.which === 1)) return;

            $startPt = $(e.target);
            const coords = {x: $startPt.attr('cx'), y: $startPt.attr('cy')};
            currentColor = getColor($startPt);

            $newConnection = drawLine(coords, coords)
                .addClass(`${currentColor} dragging`);

            allowedColors = getAdjacentColors(currentColor);
        })
        .on('mousemove', (e) => {
            if (!$newConnection || $newConnection.hasClass('connecting')) return;

            const parentOffset = $game.offset();
            const x = e.pageX - parentOffset.left;
            const y = e.pageY - parentOffset.top;

            updateLine($newConnection, {x, y});
            testIntersections();
        })
        .on('mouseover', 'circle', (e) => {
            if (!isPlaying) return;

            const $circle = $(e.target);
            if ($newConnection) {
                if (
                    $newConnection.hasClass('illegal') ||
                    getColor($circle) !== getColor($newConnection) ||
                    getLength($newConnection) < CIRCLE_SIZE * 2
                ) return;
                [$newConnection, $circle, $startPt].forEach(($el) => $el.addClass('connecting'));
                updateLine($newConnection, {x: $circle.attr('cx'), y: $circle.attr('cy')});
                return;
            }

            $circle.animate(
                {r: CIRCLE_SIZE * 1.3},
                {
                    duration: 100,
                    step: (now) => $circle.attr('r', now)
                });
        })
        .on('mouseout', 'circle', (e) => {
            if (!isPlaying) return;

            const $circle = $(e.target);
            if ($newConnection) {
                [$newConnection, $startPt, $circle].forEach(($el) => $el.removeClass('connecting'));
            }

            $circle.animate(
                {r: CIRCLE_SIZE},
                {
                    duration: 100,
                    step: (now) => $circle.attr('r', now)
                });
        });

    $(document).on('mouseup', (e) => {
        if ($newConnection) {
            if ($newConnection.hasClass('connecting')) {
                $newConnection.removeClass('dragging');

                // Remove any illegally crossed connections & disconnect their endpoints
                $connections = $connections.filter(($connection) => {
                    if ($connection.hasClass('illegal')) {
                        $connection.remove();
                        $(`circle.connected.${getColor($connection)}`).removeClass('connecting connected');
                        return false;
                    }
                    return true;
                });
                $connections.push($newConnection);

                $startPt.add($(e.target)).addClass('connected');

                updateScores(getColor($newConnection));
            } else {
                // Connection never reached a matching endpoint
                $newConnection.remove();
            }

            $newConnection = null;
            $startPt = null;
            $('.illegal').removeClass('illegal');
        }
    });

    $('#start-btn').on('click', () => {
        $('#summary').animate({maxHeight: 0}, 400, () => {
            $('#level-info').animate({maxHeight: 350}, 400);
        });
        $('#start-btn').animate({opacity: 0}, 400, () => $('#start-btn').css({display: 'none'}));
        $('body').addClass('playing');

        setLevel(1);
        resetMultipliers();
        randomizeBoard(true);

        isPlaying = true;
    });

    $('#restart-level').on('click', resetGame);
    $('#restart-game').on('click', () => {
        setLevel(1);
        resetGame();
        randomizeBoard();
    });
}

function setupGame() {
    const spacing = CIRCLE_SPACING + CIRCLE_SIZE * 2;
    $game.css({
        height: spacing * (GAME_ROWS + 1),
        width : spacing * (GAME_COLS + 1)
    })

    for (let row = 0; row < GAME_ROWS; row++) {
        const height = spacing * (row + 1);
        for (let col = 0; col < GAME_COLS; col++) {
            drawCircle(
                spacing * (col + 1),
                height,
                CIRCLE_SIZE,
            ).addClass(colorList[row % colorList.length]);
        }
    }
}

function resetGame() {
    $connections = [];

    $('line').remove();
    $('.connected, .connecting').removeClass('connected connecting');

    resetMultipliers();
    resetScores();
}

function setLevel(newLevel, doHighlight) {
    level = newLevel;
    const _updateDOM = () => {
        $('#level').html(`Level ${level}`);
        $('#score-goal').html(goalScores[level - 1]);
    }

    if (doHighlight) {
        $('#level-info').addClass('highlight');
        const duration = parseInt($('#level').css('animation-duration')) * 1000;
        setTimeout(_updateDOM, duration / 2);
        setTimeout(() => $('#level-info').removeClass('highlight'), duration);
    } else {
        _updateDOM();
    }
}

function advanceLevel() {
    if (level === goalScores.length) {
        return;
    }

    setLevel(level + 1, true);

    resetGame();
    randomizeBoard(true);
}

function randomizeBoard(doAnimate) {
    let iterations = doAnimate ? 8 : 1;
    const _randomize = () => {
        $('circle').each((idx, el) => $(el).attr('class', randColor()));
        iterations--;
        if (iterations) setTimeout(_randomize, 75);
    };
    _randomize();
}

/* Flag methods */

function setupFlag() {
    const $flag = $('#flag');
    colorList.forEach((color) => {
        $(`<div class="stripe outline ${color}"><span class="score">0 pts</span><span class="multiplier"></span></div`).appendTo($flag);
    });
}

function colorStripe(stripeColor, isColored) {
    $(`.stripe.${stripeColor}`).toggleClass('outline', !isColored);
}

function setMultiplier(color, value) {
    $(`.${color} .multiplier`).html(value > 1 ? `x${value}` : '');
}

function setConnectsForward(color, doesConnect) {
    $(`.stripe.${color}`).toggleClass('connected', doesConnect);
}

/* Scoring methods */

const formatScore = (score, color) => (color) ? `${Math.round(score)} pts` : `Total: ${score}`;
const setScore = (score, color) => (color) ? $(`.${color} .score`).html(formatScore(score, color)) : $('#flag').attr('data-total-score', formatScore(score));
const calcScore = ($connection) => Math.round(getLength($connection) / (CIRCLE_SPACING + 2 * CIRCLE_SIZE));

function resetScores() {
    colorList.forEach((color) => {
        setScore(0, color);
        colorStripe(color, false);
    });
    setScore(0);
    totalScore = 0;
}

function updateScores(lastColorAdded) {
    const prevScore = totalScore;
    const prevMultiplier = multipliers[lastColorAdded];

    updateMultipliers();
    resetScores();

    totalScore = $connections.reduce((total, $connection) => {
        const colorScore = calcScore($connection);
        const color = getColor($connection);

        setScore(colorScore, color);
        colorStripe(color, true);

        return total + colorScore * multipliers[color];
    }, 0);
    setScore(totalScore);

    if (totalScore >= goalScores[level - 1]) {
        setTimeout(() => {
            alert(`Great job! You passed Level ${level} 🌈`);
            advanceLevel();
        }, 500);
        return;
    }

    // Flash scores

    const netScore = totalScore - prevScore;
    const netMultiplier = multipliers[lastColorAdded] - prevMultiplier;
    const messages = [];
    if (netScore) {
        messages.push([`${netScore > 0 ? '+' : ''}${netScore}`,
            netScore > 0 ? 'success' : 'failure',
            lastColorAdded]);
    }
    if (netMultiplier && (netMultiplier > 0) == (netScore > 0)) { // Only flash multiplier if changes in same direction as score
        const isSuccess = netMultiplier > 0;
        messages.push([`${isSuccess ? '↑' : '↓'} x${multipliers[lastColorAdded]}${isSuccess ? '!' : ''}`,
            isSuccess ? 'success' : 'failure',
            lastColorAdded]);
    }
    if (messages.length) flashMessages(messages);
}

function resetMultipliers() {
    multipliers = _.mapValues(colorDict, () => 1);
    colorList.forEach((color) => {
        setMultiplier(color, 1);
        setConnectsForward(color, false);
    });
}

function updateMultipliers() {
    if ($connections.length <= 1) return;

    const connectsForward = _.mapValues(colorDict, () => false);
    $connections.forEach(($connection) => {
        const color = getColor($connection);
        const nextColor = getNextColor(color);
        if (!nextColor) return;
        $connections.forEach(($otherConnection) => {
            if ($connection == $otherConnection) return;
            if (doIntersect($connection, $otherConnection) && nextColor == getColor($otherConnection)) {
                connectsForward[color] = true;
            }
        })
    })

    let idx = 0;
    while (idx < colorList.length) {
        const connectedColors = [];
        while (idx < colorList.length && connectsForward[colorList[idx]]) {
            connectedColors.push(colorList[idx]);
            idx++;
        }
        connectedColors.push(colorList[idx]);
        connectedColors.forEach((color) => {
            multipliers[color] = connectedColors.length;
        })
        idx++;
    }

    Object.entries(connectsForward).map(([color, doesConnect]) => setConnectsForward(color, doesConnect));
    Object.entries(multipliers).map(([color, value]) => setMultiplier(color, value));
}

// Valid types: success, failure
function _flashMessage(message, type, color, cb) {
    isFlashing = true;

    const $message = $(`<div class="text-${type}">${message}</div>`);
    $('#footer').append($message);

    if (type === 'success') {
        $message.addClass(color);
        const actualColor = $message.css('stroke');
        $message.removeClass(color).css('text-shadow', `4px 3px ${actualColor}`);
    }

    const duration = parseFloat($message.css('animation-duration'));
    setTimeout(() => {
        $message.remove();
        isFlashing = false;
        if (cb) cb();
    }, duration * 1000);
}

function flashMessages(messages) {
    if (messages) messageQueue.push(...messages);
    if (isFlashing) return;

    let message = messageQueue.shift();
    if (!message) return;

    _flashMessage(...message, () => flashMessages());
}

/* Color methods */

function getColor($el) {
    return $el.attr('class').split(' ')[0];
}
function getPrevColor(color) {
    const idx = colorDict[color]
    return (idx) ? colorList[idx - 1] : null;
}
function getNextColor(color) {
    const idx = colorDict[color]
    return (idx < colorList.length -1) ? colorList[idx + 1] : null;
}
function getAdjacentColors(color) {
    return _.filter([getPrevColor(color), getNextColor(color)]);
}

/* Geometric methods */

function doIntersect($line1, $line2) {
    const getCoords = ($line) => [
        {x: parseInt($line.attr('x1')), y: parseInt($line.attr('y1'))},
        {x: parseInt($line.attr('x2')), y: parseInt($line.attr('y2'))}
    ];

    const extendLine = ([start, end]) => {
        const amount = 5;
        if (start.x === end.x) { // for vertical slope
            if (start.y > end.y) {
                start.y += amount;
                end.y -= amount;
            } else {
                start.y -= amount;
                end.y += amount;
            }
            return [start, end];
        }
        const slope = (end.y - start.y) / (end.x - start.x);
        const deltaX = Math.sqrt(Math.pow(amount, 2) / (Math.pow(slope, 2) + 1));
        if (end.x > start.x) {
            end.x += deltaX;
            end.y += deltaX * slope;
            start.x -= deltaX;
            start.y -= deltaX * slope;
        } else {
            end.x -= deltaX;
            end.y -= deltaX * slope;
            start.x += deltaX;
            start.y += deltaX * slope;
        }
        return [start, end];
    }

    const [start1, end1] = extendLine(getCoords($line1));
    const [start2, end2] = extendLine(getCoords($line2));

    const ccw = (a, b, c) => (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
    return ccw(start1, start2, end2) !== ccw(end1, start2, end2) &&
        ccw(start1, end1, start2) !== ccw(start1, end1, end2);
}

const testIntersections = _.throttle(() => {
    if (!$newConnection || !$connections.length) return;
    $connections.forEach(($connection) => {
        $connection.toggleClass('illegal',
            getColor($connection) === currentColor ||
            doIntersect($connection, $newConnection) &&
            !allowedColors.includes(getColor($connection)));
    });
}, 100);

function getLength($line) {
    const start = {x: $line.attr('x1'), y: $line.attr('y1')};
    const end = {x: $line.attr('x2'), y: $line.attr('y2')};
    return getDist(start, end);
}

function getDist(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

function distToLine(l1, l2, p) {
    const m1 = (l2.y - l1.y) / (l2.x - l1.x);
    const b1 = l1.y - l1.x * m1;

    const m2 = -1 / m1;
    const b2 = p.y - p.x * m2;

    const cX = (b2 - b1) / (m1 - m2);
    const cY = m1 * cX + b1;
    let closest = {x: cX, y: cY};

    if (getDist(l1 , closest) > getDist(l1, l2)) closest = l2;
    else if (getDist(l2, closest) > getDist(l1, l2)) closest = l1;

    return getDist(closest, p);
}


/* Utility methods */

function randInt(min, max) {
    return Math.round(Math.random() * (max - min) + min);
}
function randColor() {
    return ['red', 'orange', 'yellow', 'green', 'blue', 'purple'][randInt(0, 5)];
}

/* SVG methods */

function clearSvg() {
    $game.empty();
}

function createSvg(element) {
    return document.createElementNS('http://www.w3.org/2000/svg', element);
}

function drawCircle(cx, cy, r, fill) {
    return $(createSvg('circle'))
        .attr({cx, cy, r, fill})
        .appendTo($game);
}

function drawLine({x: x1, y: y1}, {x: x2, y: y2}) {
    return $(createSvg('line'))
        .attr({x1, y1, x2, y2})
        .appendTo($game);
}
function updateLine($line, {x: x2, y: y2}) {
    $line.attr({x2, y2});
}