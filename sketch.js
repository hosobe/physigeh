/*
 * Physigeh: A Physics-Based Action Puzzle Game
 *
 * Copyright (C) 2016 Hiroshi HOSOBE
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; version 2 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>
 */

/****************************************************************
 * CONSTANTS AND GLOBAL VARIABLES
 ****************************************************************/

const FRAME_RATE = 30;

const GAMEPAD_THRESHOLD = .2;

const COOKIE_TOP_LINE_COUNT = 'physigehTop';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 10;

const M_CREATION = 0;
const M_CHANGE_PIECE = 1;
const M_CONTACT = 2;
const M_DELETION = 3;
const M_ADD_TO_LOST_BLOCK_COUNT = 4;
const M_GAME_OVER = 5;

const BLOCK_SIZE = 32;
const SCREEN_SIZE = new p5.Vector(BLOCK_SIZE * 10, BLOCK_SIZE * 23);

const PIECE_I = 0;
const PIECE_J = 1;
const PIECE_L = 2;
const PIECE_O = 3;
const PIECE_S = 4;
const PIECE_T = 5;
const PIECE_Z = 6;

const BLOCK_CENTERS = [
  [new p5.Vector(-1.5, 0), new p5.Vector(-.5, 0),
  new p5.Vector(.5, 0), new p5.Vector(1.5, 0)],
  [new p5.Vector(-.75, .75), new p5.Vector(-.75, -.25),
  new p5.Vector(.25, -.25), new p5.Vector(1.25, -.25)],
  [new p5.Vector(-1.25, -.25), new p5.Vector(-.25, -.25),
  new p5.Vector(.75, -.25), new p5.Vector(.75, .75)],
  [new p5.Vector(-.5, -.5), new p5.Vector(.5, -.5),
  new p5.Vector(.5, .5), new p5.Vector(-.5, .5)],
  [new p5.Vector(-1, -.5), new p5.Vector(0, -.5),
  new p5.Vector(0, .5), new p5.Vector(1, .5)],
  [new p5.Vector(0, -.25), new p5.Vector(-1, -.25),
  new p5.Vector(0, .75), new p5.Vector(1, -.25)],
  [new p5.Vector(-1, .5), new p5.Vector(0, .5),
  new p5.Vector(0, -.5), new p5.Vector(1, -.5)]];

const DELETION_EFFECT_DURATION = 15;
const DELETION_SOUND_DELAY_MAX = 5;

var userReadyFlag = false;
var pauseFlag = false;

var gamepad = null;
var gamepadInterval = 0;

var topLineCount = Number(getCookie(COOKIE_TOP_LINE_COUNT, 0));

var blockIndex = new IndexGenerator();

var engine = null;
var world = null;
var agents = null;
var supervisor = null;
var player = null;

var bgm = null;
var deletionSound = null;
var deletionSoundPlayFlag = false;
var gameOverSound = null;
var gameOverSoundPlayFlag = false;

/****************************************************************
 * GENERIC MODULES
 ****************************************************************/

/*
 * Agent
 */

function Agent() {
  this.activeFlag = true;
}

Agent.prototype.isActive = function() {
  return this.activeFlag;
};

Agent.prototype.deactivate = function() {
  this.activeFlag = false;
};

Agent.prototype.isPiece = function() {
  return false;
};

Agent.prototype.isCurrent = function() {
  return false;
};

Agent.prototype.control = function(newMessages) {
  return true;
};

Agent.prototype.move = function() {
};

Agent.prototype.judge = function() {
  return [];
};

Agent.prototype.react = function(message, newMessages) {
  return true;
};

Agent.prototype.render = function() {
};

Agent.prototype.renderForeground = function() {
};

/*
 * Generic game engine
 */

function Engine() {
}

Engine.prototype.initialize = function() {
};

Engine.prototype.control = function() {
  var i, j;
  var oldAgents = agents.concat();
  var messages = [];
  var ms = [];
  for (i = 0; i < oldAgents.length; i++) {
    if (!oldAgents[i].control(ms)) {
      agents.splice(agents.indexOf(oldAgents[i]), 1);
      oldAgents[i].deactivate();
    }
    for (j = 0; j < ms.length; j++) {
      if (ms[j].tag === M_CREATION) {
        agents.push(ms[j].to);
      } else {
        messages.push(ms[j]);
      }
    }
    ms.length = 0;
  }
  return messages;
};

Engine.prototype.move = function() {
  var i;
  for (i = 0; i < agents.length; i++) {
    agents[i].move();
  }
  return [];
};

Engine.prototype.judge = function() {
  return supervisor.judge();
};

Engine.prototype.react = function(messages) {
  var i, j;
  var ms = [];
  for (i = 0; i < messages.length; i++) {
    var agent = messages[i].to;
    if (!agent.isActive()) {
      continue;
    }
    if (!agent.react(messages[i], ms)) {
      agents.splice(agents.indexOf(agent), 1);
      agent.deactivate();
    }
    for (j = 0; j < ms.length; j++) {
      if (ms[j].tag === M_CREATION) {
        agents.push(ms[j].to);
      } else {
        messages.push(ms[j]);
      }
    }
    ms.length = 0;
  }
};

Engine.prototype.render = function() {
  var i;
  background(0);
  for (i = 0; i < agents.length; i++) {
    agents[i].render();
  }
  supervisor.renderForeground();
};

/*
 * Engine state management
 */

function start() {
  engine = new Physigeh();
  engine.initialize();
  pauseFlag = false;
}

function switchPause() {
  pauseFlag = !pauseFlag;
  if (!supervisor.isGameOver()) {
    if (pauseFlag) {
      bgm.pause();
    } else {
      bgm.play();
    }
  }
}

function handleGamepadInput() {
  gamepad = getGamepad(GAMEPAD_THRESHOLD);
  gamepadInterval--;
  if (gamepad.buttons.length >= 10) {
    if (gamepadInterval <= 0 && gamepad.buttons[9] === 1) {
      if (supervisor.isGameOver()) {
        start();
      } else {
        switchPause();
      }
      gamepadInterval = FRAME_RATE / 2;
    }
  }
}

/*
 * Canvas management
 */

function checkGoogleSites() {
  return typeof gadgets !== 'undefined';
}

function getCanvasSize() {
  if (checkGoogleSites()) {
    return new p5.Vector(windowWidth, .8 * screen.availHeight);
  } else {
    return new p5.Vector(windowWidth, windowHeight);
  }
}

function canvasTransform(width, height) {
  translate((width - height * SCREEN_SIZE.x / SCREEN_SIZE.y) / 2, 0);
  scale(height / SCREEN_SIZE.y);
}

function setupCanvas() {
  var cs = getCanvasSize();
  createCanvas(cs.x, cs.y);
  if (checkGoogleSites()) {
    gadgets.window.adjustHeight();
  }
  canvasTransform(cs.x, cs.y);
  frameRate(FRAME_RATE);
  noCursor();
}

function windowResized() {
  var cs = getCanvasSize();
  resizeCanvas(cs.x, cs.y);
  if (checkGoogleSites()) {
    gadgets.window.adjustHeight();
  }
  canvasTransform(cs.x, cs.y);
}

/*
 * Start screen
 */

function promptMouseClick() {
  background(0);
  strokeWeight(4);
  stroke(128);
  fill(255);
  textFont('sans-serif');
  textSize(32);
  textAlign(CENTER, TOP);
  var x = BLOCK_SIZE * 5;
  text('CLICK SCREEN', x, BLOCK_SIZE * 9);
  text('TO PLAY', x, BLOCK_SIZE * 13);
}

function mouseClicked() {
  userReadyFlag = true;
}

/*
 * Sound play (for Chrome's bug)
 */

function stopSound(sound) {
  sound.stop();
}

function playSound(sound, duration) {
  var ua = window.navigator.userAgent.toLowerCase();
  if (ua.indexOf('chrome') !== -1) {
    sound.loop();
    sound.addCue(.3 * duration, stopSound, sound);
  } else {
    sound.play();
  }
}

/*
 * Main functions
 */

function setup() {
  bgm = select('#bgm');
  deletionSound = select('#deletionSound');
  gameOverSound = select('#gameOverSound');
  setupCanvas();
}

function draw() {
  if (!userReadyFlag) {
    promptMouseClick();
  } else {
    handleGamepadInput();
    if (engine === null) {
      start();
    }
    if (!pauseFlag) {
      var messages = engine.control();
      messages = messages.concat(engine.move());
      messages = messages.concat(engine.judge());
      engine.react(messages);
    }
    engine.render();
  }
  cursor(ARROW);
}

/****************************************************************
 * SPECIFIC MODULES
 ****************************************************************/

/*
 * Player
 */

function Player() {
  this.direction = new p5.Vector();
  this.rotation = 0;
  this.keyDirection = new p5.Vector();
  this.keyRotation = 0;
  this.changePieceFlag = true;
}

Player.prototype = new Agent();

Player.prototype.control = function(newMessages) {
  this.direction.x = this.keyDirection.x;
  this.direction.y = this.keyDirection.y;
  this.rotation = this.keyRotation;
  if (gamepad.axes.length >= 3) {
    this.direction.x += gamepad.axes[0];
    this.direction.y += -max(gamepad.axes[1], 0);
    this.rotation += -gamepad.axes[2];
    constrain(this.direction.y, -1, 0);
    constrain(this.direction.x, -1, 1);
    constrain(this.rotation, -1, 1);
  }
  if (this.changePieceFlag) {
    if (supervisor.getHeight() <= 0) {
      newMessages.push({to: supervisor, tag: M_GAME_OVER});
    } else {
      var p = new Piece(supervisor.nextPiece.get(), null, 0, 0, 0);
      p.currentFlag = true;
      newMessages.push({to: p, tag: M_CREATION});
    }
    this.changePieceFlag = false;
  }
  return true;
};

Player.prototype.react = function(message, newMessages) {
  if (message.tag === M_CHANGE_PIECE) {
    this.changePieceFlag = true;
  }
  return true;
};

Player.prototype.render = function() {
};

function keyPressed() {
  if (player === null) {
    return;
  }
  if (keyCode === LEFT_ARROW || key === 'a' || key === 'A') {
    player.keyDirection.x = -1;
  } else if (keyCode === RIGHT_ARROW || key === 'd' || key === 'D') {
    player.keyDirection.x = 1;
  } else if (keyCode === DOWN_ARROW || key === 's' || key === 'S') {
    player.keyDirection.y = -1;
  } else if (key === ' ' || key === 'z' || key === 'Z' ||
      key === ',' || keyCode === 188) {
    player.keyRotation = 1;
  } else if (key === 'x' || key === 'X' || key === '.' || keyCode === 190) {
    player.keyRotation = -1;
  } else if (key === 'p' || key === 'P') {
    switchPause();
  } else if (keyCode === ENTER) {
    if (supervisor.isGameOver()) {
      start();
    }
  }
}

function keyReleased() {
  if (player === null) {
    return;
  }
  if (keyCode === LEFT_ARROW || key === 'a' || key === 'A' ||
      keyCode === RIGHT_ARROW || key === 'd' || key === 'D') {
    player.keyDirection.x = 0;
  } else if (keyCode === DOWN_ARROW || key === 's' || key === 'S') {
    player.keyDirection.y = 0;
  } else if (key === ' ' || key === 'z' || key === 'Z' ||
      key === ',' || keyCode === 188 ||
      key === 'x' || key === 'X' || key === '.' || keyCode === 190) {
    player.keyRotation = 0;
  }
}

/*
 * Block
 */

function Block(center, neighbors) {
  this.center = center;
  if (arguments.length > 1) {
    this.neighbors = neighbors;
  } else {
    this.neighbors = [];
  }
  this.index = 0;
}

Block.prototype.toArraySub = function(oldIndex, array) {
  var i;
  this.index = blockIndex.getNext();
  array.push(this);
  for (i = 0; i < this.neighbors.length; i++) {
    var ni = this.neighbors[i];
    if (ni.index <= oldIndex) {
      ni.toArraySub(oldIndex, array);
    }
  }
};

Block.prototype.toArray = function() {
  var array = [];
  this.toArraySub(blockIndex.getCurrent(), array);
  return array;
};

Block.prototype.deleteBlocks = function(toDelete) {
  var i, j;
  var oldBlocks = this.toArray();
  var blocks = getArrayDifference(oldBlocks, toDelete);
  for (i = 0; i < blocks.length; i++) {
    var bi = blocks[i];
    bi.neighbors = getArrayDifference(bi.neighbors, toDelete);
  }
  var roots = blocks.concat();
  for (i = 0; i < blocks.length; i++) {
    roots = getArrayDifference(roots, blocks[i].neighbors);
  }
  return roots;
};

/*
 * Piece
 */

function Piece(type, blocks, x, y, angle) {
  var i, j;
  this.type = type;
  if (blocks !== null) {
    this.blocks = blocks;
  } else {
    var cs = BLOCK_CENTERS[type];
    if (type === PIECE_O) {
      var last = new Block(cs[3]);
      this.blocks = new Block(cs[0], [
          new Block(cs[1], [new Block(cs[2], [last])])]);
      last.neighbors = [this.blocks];

    } else if (type === PIECE_T) {
      this.blocks = new Block(cs[0], [
          new Block(cs[1]), new Block(cs[2]), new Block(cs[3])]);
    } else {
      this.blocks = new Block(cs[0], [
          new Block(cs[1], [new Block(cs[2], [new Block(cs[3])])])]);
    }
    x = type === PIECE_J ? 4.75 : type === PIECE_L ? 5.25 : 5;
    y = supervisor.getHeight() + 1 + (type === PIECE_I ? .5 :
        (type === PIECE_J || type === PIECE_L || type === PIECE_T) ? .75 : 1);
    angle = 0;
  }
  var bd = new box2d.b2BodyDef();
  bd.type = box2d.b2BodyType.b2_dynamicBody;
  bd.linearDamping = 2;
  bd.angularDamping = 10;
  bd.position = new box2d.b2Vec2(x, y);
  bd.angle = angle;
  this.body = world.CreateBody(bd);
  var bs = this.blocks.toArray();
  for (i = 0; i < bs.length; i++) {
    var c = bs[i].center;
    var vs = [];
    for (j = 0; j < 4; j++) {
      var vx = (j === 0 || j === 3) ? -.49 : .49;
      var vy = j < 2 ? -.49 : .49;
      vs.push(new box2d.b2Vec2(c.x + vx, c.y + vy));
    }
    var fd = new box2d.b2FixtureDef();
    fd.shape = new box2d.b2PolygonShape();
    fd.shape.Set(vs, 4);
    fd.density = 1;
    fd.friction = .5;
    fd.restitution = .2;
    this.body.CreateFixture(fd);
  }
  this.body.SetUserData(this);
  this.currentFlag = false;
}

Piece.prototype = new Agent();

Piece.prototype.isPiece = function() {
  return true;
};

Piece.prototype.isCurrent = function() {
  return this.currentFlag;
};

Piece.prototype.control = function(newMessages) {
  var pos = this.body.GetPosition()
  if (pos.y < -2) {
    if (this.currentFlag) {
      newMessages.push({to: player, tag: M_CHANGE_PIECE});
    }
    world.DestroyBody(this.body);
    newMessages.push({to: supervisor, tag: M_ADD_TO_LOST_BLOCK_COUNT,
      addend: this.blocks.toArray().length});
    return false;
  }
  if (this.currentFlag) {
    var f = new box2d.b2Vec2(
        100 * player.direction.x, 100 * player.direction.y);
    this.body.ApplyForce(f, pos);
    this.body.ApplyTorque(200 * player.rotation);
  }
  return true;
};

Piece.prototype.react = function(message, newMessages) {
  var i;
  if (message.tag === M_CONTACT) {
    if (this.body.GetPosition().y < supervisor.getHeight() + 1) {
      newMessages.push({to: player, tag: M_CHANGE_PIECE});
      this.currentFlag = false;
    } else {
      newMessages.push({to: supervisor, tag: M_GAME_OVER});
      this.currentFlag = false;
    }
  } else if (message.tag === M_DELETION) {
    if (this.currentFlag) {
      newMessages.push({to: player, tag: M_CHANGE_PIECE});
    }
    var pos = this.body.GetPosition();
    var ang = this.body.GetAngle();
    var roots = this.blocks.deleteBlocks(message.blocks);
    for (i = 0; i < roots.length; i++) {
      var p = new Piece(this.type, roots[i], pos.x, pos.y, ang);
      newMessages.push({to: p, tag: M_CREATION});
    }
    for (i = 0; i < message.blocks.length; i++) {
      var p = new DeletionEffect(this.type, message.blocks[i].center,
          pos.x, pos.y, ang);
      newMessages.push({to: p, tag: M_CREATION});
    }
    world.DestroyBody(this.body);
    return false;
  }
  return true;
};

function renderPiece(type, centers, x, y, angle) {
  var i;
  push();
  scale(BLOCK_SIZE, -BLOCK_SIZE);
  translate(x, y - 23);
  rotate(angle);
  colorMode(HSB, 360, 100, 100);
  var h = (360 * (3 * type + 1) / 21) % 360;
  strokeWeight(4 / BLOCK_SIZE);
  stroke(h, 100, 75);
  fill(h, 100, 100);
  rectMode(CENTER);
  for (i = 0; i < centers.length; i++) {
    var c = centers[i];
    rect(c.x, c.y, 1 - 4 / BLOCK_SIZE, 1 - 4 / BLOCK_SIZE);
  }
  pop();
}

Piece.prototype.render = function() {
  var i;
  var bs = this.blocks.toArray();
  var cs = [];
  for (i = 0; i < bs.length; i++) {
    cs.push(bs[i].center);
  }
  var pos = this.body.GetPosition();
  renderPiece(this.type, cs, pos.x, pos.y, this.body.GetAngle());
};

/*
 * Deletion effect
 */

function DeletionEffect(type, center, x, y, angle) {
  this.type = type;
  this.center = center;
  this.x = x;
  this.y = y;
  this.angle = angle;
  this.time = 0;
}

DeletionEffect.prototype = new Agent();

DeletionEffect.prototype.control = function(newMessages) {
  this.time++;
  return this.time <= DELETION_EFFECT_DURATION;
};

DeletionEffect.prototype.render = function() {
  push();
  scale(BLOCK_SIZE, -BLOCK_SIZE);
  translate(this.x,  this.y - 23);
  rotate(this.angle);
  var g = 255 * (DELETION_EFFECT_DURATION + 1 - this.time)
    / DELETION_EFFECT_DURATION;
  strokeWeight(4 / BLOCK_SIZE);
  stroke(.75 * g);
  fill(g);
  rectMode(CENTER);
  rect(this.center.x, this.center.y, 1 - 4 / BLOCK_SIZE, 1 - 4 / BLOCK_SIZE);
  pop();
  if (!pauseFlag && !deletionSoundPlayFlag && this.time === 0) {
    deletionSound.volume(.8);
    playSound(deletionSound, .94);
    deletionSoundPlayFlag = true;
  }
};

/*
 * Ground
 */

function Ground() {
  var bd = new box2d.b2BodyDef();
  bd.type = box2d.b2BodyType.b2_staticBody;
  bd.position = new box2d.b2Vec2(5, .5);
  this.body = world.CreateBody(bd);
  var fd = new box2d.b2FixtureDef();
  fd.shape = new box2d.b2PolygonShape();
  fd.shape.SetAsBox(5, .5);
  fd.density = 1;
  fd.friction = .5;
  fd.restitution = .2;
  this.body.CreateFixture(fd);
}

Ground.prototype = new Agent();

Ground.prototype.render = function() {
  noStroke();
  fill(192);
  rectMode(CORNER);
  rect(0, BLOCK_SIZE * 22, BLOCK_SIZE * 10, BLOCK_SIZE);
};

/*
 * Supervisor
 */

function Supervisor() {
  this.nextPiece = new PermutationGenerator(7);
  this.lineCount = 0;
  this.lostBlockCount = 0;
  this.heighteningEffectFlag = false;
  this.heighteningEffectTime = 0;
  this.loweringEffectFlag = false;
  this.loweringEffectTime = 0;
  this.gameOverFlag = false;
  gameOverSoundPlayFlag = false;
}

Supervisor.prototype = new Agent();

Supervisor.prototype.getHeight = function() {
  return 20 - max(0, this.lostBlockCount - this.lineCount);
};

Supervisor.prototype.isGameOver = function() {
  return this.gameOverFlag;
};

Supervisor.prototype.control = function(newMessages) {
  this.heighteningEffectTime++;
  this.loweringEffectTime++;
  return true;
};

Supervisor.prototype.judge = function() {
  var i, j, k;
  var rows = [];
  for (i = 0; i < 20; i++) {
    rows.push([]);
  }
  for (i = 0; i < agents.length; i++) {
    var ai = agents[i];
    if (!ai.isPiece()) {
      continue;
    }
    var pos = ai.body.GetPosition();
    var ang = ai.body.GetAngle();
    var sa = sin(ang);
    var ca = cos(ang);
    var bs = ai.blocks.toArray();
    for (j = 0; j < bs.length; j++) {
      var bj = bs[j];
      var c = bj.center;
      var y = sa * c.x + ca * c.y + pos.y - 1;
      if (y >= 0 && y < 20) {
        var fp = y % 1;
        if (fp >= .25 && fp <= .75) {
          rows[floor(y)].push({piece: ai, block: bj});
        }
      }
    }
  }
  var messages = [];
  for (i = 0; i < 20; i++) {
    var ri = rows[i];
    if (ri.length < 10) {
      continue;
    }
    for (j = 0; j < ri.length; j++) {
      var rij = ri[j];
      for (k = 0; k < messages.length; k++) {
        if (messages[k].to === rij.piece) {
          messages[k].blocks.push(rij.block);
          break;
        }
      }
      if (k === messages.length) {
        messages.push({to: rij.piece, tag: M_DELETION, blocks: [rij.block]});
      }
    }
    var ph = this.getHeight();
    this.lineCount++;
    if (this.lineCount > topLineCount) {
      topLineCount = this.lineCount;
      setCookie(COOKIE_TOP_LINE_COUNT, topLineCount, COOKIE_MAX_AGE);
    }
    if (this.getHeight() > ph) {
      this.loweringEffectFlag = false;
      this.heighteningEffectFlag = true;
      this.heighteningEffectTime = 0;
    }
    break;
  }
  return messages;
};

Supervisor.prototype.react = function(message, newMessages) {
  if (message.tag === M_ADD_TO_LOST_BLOCK_COUNT) {
    var ph = this.getHeight();
    this.lostBlockCount += message.addend;
    if (this.getHeight() < ph) {
      this.heighteningEffectFlag = false;
      this.loweringEffectFlag = true;
      this.loweringEffectTime = 0;
    }
  } else if (message.tag === M_GAME_OVER) {
    this.gameOverFlag = true;
  }
  return true;
};

Supervisor.prototype.render = function() {
  var i;
  if (this.heighteningEffectFlag || this.loweringEffectFlag) {
    var h = this.getHeight();
    var ry;
    if (this.heighteningEffectFlag) {
      ry = BLOCK_SIZE * (21 - this.heighteningEffectTime);
      if (this.heighteningEffectTime === h - 1) {
        this.heighteningEffectFlag = false;
      }
    } else {
      ry = BLOCK_SIZE * (22 - h + this.loweringEffectTime);
      if (this.loweringEffectTime === h - 1) {
        this.loweringEffectFlag = false;
      }
    }
    noStroke();
    fill(64);
    rectMode(CORNER);
    rect(0, ry, BLOCK_SIZE * 10, BLOCK_SIZE);
  }
  for (i = 0; i < this.getHeight(); i++) {
    var y = BLOCK_SIZE * (21 - i);
    strokeWeight(2);
    stroke(128);
    line(0, y, BLOCK_SIZE * 10 - 1, y);
  }
  deletionSoundPlayFlag = false;
};

Supervisor.prototype.renderForeground = function() {
  strokeWeight(4);
  stroke(128);
  fill(192);
  textFont('sans-serif');
  textSize(32);
  textAlign(CENTER, TOP);
  var x = BLOCK_SIZE * 15;
  text('NEXT', x, BLOCK_SIZE * 2);
  var next = this.nextPiece.peek(0);
  renderPiece(next, BLOCK_CENTERS[next], 15, 18, 0);
  text('LINES', x, BLOCK_SIZE * 8);
  text(this.lineCount, x, BLOCK_SIZE * 10);
  text('LOST', x, BLOCK_SIZE * 14);
  text(this.lostBlockCount, x, BLOCK_SIZE * 16);
  x = BLOCK_SIZE * -5;
  text('TOP', x, BLOCK_SIZE * 8);
  text(topLineCount, x, BLOCK_SIZE * 10);
  if (this.gameOverFlag) {
    text('HIT ENTER', x, BLOCK_SIZE * 2);
    text('TO REPLAY', x, BLOCK_SIZE * 4);
    fill(255);
    textSize(64);
    x = BLOCK_SIZE * 5;
    text('GAME', x, BLOCK_SIZE * 9);
    text('OVER', x, BLOCK_SIZE * 13);
    if (!gameOverSoundPlayFlag) {
      bgm.stop();
      gameOverSound.volume(1);
      playSound(gameOverSound, 3.02);
      gameOverSoundPlayFlag = true;
    }
  } else {
    text('ZX \u2190\u2193\u2192', x, BLOCK_SIZE * 2);
    text('OR  ASD , .', x, BLOCK_SIZE * 4);
  }
  if (pauseFlag) {
    fill(255);
    textSize(32);
    text('PAUSE', BLOCK_SIZE * 5, BLOCK_SIZE * 4);
  }
};

/*
 * Specific game engine
 */

function Physigeh() {
}

Physigeh.prototype = new Engine();

Physigeh.prototype.initialize = function() {
  world = new box2d.b2World(new box2d.b2Vec2(0, -2.5), true);
  agents = [];
  supervisor = new Supervisor();
  agents.push(supervisor);
  player = new Player();
  agents.push(player);
  agents.push(new Ground());
  bgm.volume(.5);
  bgm.loop();
};

Physigeh.prototype.move = function() {
  world.Step(1 / FRAME_RATE, 8, 3);
  var messages = [];
  for (var c = world.GetContactList(); c !== null; c = c.GetNext()) {
    if (!c.IsTouching()) {
      continue;
    }
    var pa = c.GetFixtureA().GetBody().GetUserData();
    if (pa !== null && pa.isCurrent()) {
      messages.push({to: pa, tag: M_CONTACT});
    } else {
      var pb = c.GetFixtureB().GetBody().GetUserData();
      if (pb !== null && pb.isCurrent()) {
        messages.push({to: pb, tag: M_CONTACT});
      }
    }
  }
  return messages;
};
