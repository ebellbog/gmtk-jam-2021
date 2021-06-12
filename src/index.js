import _ from 'lodash';
import './index.less';

const $game = $('#game');
const $score = $('#score');

const CIRCLE_SIZE = 20;
const CIRCLE_SPACING = 30;

const GAME_COLS = 10;
const GAME_ROWS = 8;

let $newConnection, allowedColors;
const $connections = [];

$(document).ready(() => {
    setupGame();
    $game
        .on('mousedown', 'circle', (e) => {
            const $startPt = $(e.target);
            const coords = {x: $startPt.attr('cx'), y: $startPt.attr('cy')};
            $newConnection = drawLine(coords, coords)
                .addClass(`${$startPt.attr('class')} dragging`);
            allowedColors = getAdjacentColors(getColor($newConnection));
        })
        .on('mousemove', (e) => {
            if (!$newConnection || $newConnection.hasClass('connecting')) return;

            const parentOffset = $game.offset();
            const x = e.pageX - parentOffset.left;
            const y = e.pageY - parentOffset.top;

            updateLine($newConnection, {x, y});
            testIntersections();
        })
        .on('mousemover')
        .on('mouseover', 'circle', (e) => {
            const $circle = $(e.target);
            if ($newConnection) {
                if (
                    $newConnection.hasClass('illegal') ||
                    getColor($circle) !== getColor($newConnection) ||
                    getLength($newConnection) < CIRCLE_SIZE * 2
                ) return;
                $newConnection.addClass('connecting');
                updateLine($newConnection, {x: $circle.attr('cx'), y: $circle.attr('cy')});
            }

            $circle.animate(
                {r: CIRCLE_SIZE * 1.3},
                {
                    duration: 100,
                    step: (now) => $circle.attr('r', now)
                });
        })
        .on('mouseout', 'circle', (e) => {
            if ($newConnection) {
                $newConnection.removeClass('connecting');
            }

            const $circle = $(e.target);
            $circle.animate(
                {r: CIRCLE_SIZE},
                {
                    duration: 100,
                    step: (now) => $circle.attr('r', now)
                });
        });

    $('#undo-btn').on('click', () => {
        if ($connections.length) {
            $connections.pop().remove();
            updateScore();
        }
    })

    $(document).on('mouseup', (e) => {
        if ($newConnection) {
            if ($newConnection.hasClass('connecting')) {
                const $target = $(e.target);
                updateLine($newConnection, {x: $target.attr('cx'), y: $target.attr('cy')});

                $newConnection.removeClass('dragging');
                $connections.push($newConnection);

                updateScore();
            } else {
                $newConnection.remove();
            }
            $newConnection = null;
        }
    });
});

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

function updateScore() {
    const spacing = CIRCLE_SPACING + 2 * CIRCLE_SIZE
    const score = $connections.reduce((total, $connection) => total += getLength($connection) / spacing, 0);
    $score.html(Math.round(score));
}

// Color methods

const colorDict = {
    red: 0,
    orange: 1,
    yellow: 2,
    green: 3,
    blue: 4,
    purple: 5
}
const colorList = Object.keys(colorDict);

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
        {x: $line.attr('x1'), y: $line.attr('y1')},
        {x: $line.attr('x2'), y: $line.attr('y2')}
    ];

    const [start1, end1] = getCoords($line1);
    const [start2, end2] = getCoords($line2);

    const ccw = (a, b, c) => (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
    return ccw(start1, start2, end2) !== ccw(end1, start2, end2) &&
        ccw(start1, end1, start2) !== ccw(start1, end1, end2);
}

const testIntersections = _.throttle(() => {
    if (!$newConnection || !$connections.length) return;
    const intersections = $connections.filter(($connection) => doIntersect($connection, $newConnection));
    const isLegal = intersections.every((i) => allowedColors.includes(getColor(i)));
    $newConnection.toggleClass('illegal', !isLegal);
}, 100);

function getLength($line) {
    const deltaX = $line.attr('x2') - $line.attr('x1');
    const deltaY = $line.attr('y2') - $line.attr('y1');
    return Math.sqrt(Math.pow(deltaX, 2) + Math.pow(deltaY, 2));
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