import _ from 'lodash';
import './index.less';

const $game = $('#game');
let $totalScore;

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

$(document).ready(() => {
    setupFlag();
    setupGame();
    hookEvents();
});

function hookEvents() {
    $game
        .on('mousedown', 'circle', (e) => {
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

                updateScores();
            } else {
                // Connection never reached a matching endpoint
                $newConnection.remove();
            }

            $newConnection = null;
            $startPt = null;
            $('.illegal').removeClass('illegal');
        }
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
            ).addClass(randColor());
        }
    }
}

// Flag methods

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

// Scoring methods

const formatScore = (score, color) => (color) ? `${Math.round(score)} pts` : `Total: ${score}`;
const setScore = (score, color) => (color) ? $(`.${color} .score`).html(formatScore(score, color)) : $('#flag').attr('data-total-score', formatScore(score));
const calcScore = ($connection) => Math.round(getLength($connection) / (CIRCLE_SPACING + 2 * CIRCLE_SIZE));

function updateScores() {
    updateMultipliers();
    colorList.forEach((color) => {
        setScore(0, color);
        colorStripe(color, false);
    });
    const totalScore = $connections.reduce((total, $connection) => {
        const colorScore = calcScore($connection);
        const color = getColor($connection);

        setScore(colorScore, color);
        colorStripe(color, true);

        return total + colorScore * multipliers[color];
    }, 0);
    setScore(totalScore);
}

function updateMultipliers() {
    if ($connections.length <= 1) {
        return multipliers = _.mapValues(colorDict, () => 1);
    }

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

    Object.entries(multipliers).map(([color, value]) => setMultiplier(color, value));
}

// Color methods

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

// Geometric methods

function doIntersect($line1, $line2) {
    const getCoords = ($line) => [
        {x: parseInt($line.attr('x1')), y: parseInt($line.attr('y1'))},
        {x: parseInt($line.attr('x2')), y: parseInt($line.attr('y2'))}
    ];

    const extendLine = ([start, end]) => {
        const amount = CIRCLE_SIZE / 2;
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


// Utility methods

function randInt(min, max) {
    return Math.round(Math.random() * (max - min) + min);
}
function randColor() {
    return ['red', 'orange', 'yellow', 'green', 'blue', 'purple'][randInt(0, 5)];
}

// SVG methods

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