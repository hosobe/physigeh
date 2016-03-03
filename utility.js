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

/*
 * Array manipulation
 */

function getArrayDifference(origin, toDelete) {
  var i;
  var diff = [];
  for (i = 0; i < origin.length; i++) {
    var oi = origin[i];
    if (toDelete.indexOf(oi) === -1) {
      diff.push(oi);
    }
  }
  return diff;
}

/*
 * Index generation
 */

function IndexGenerator() {
  this.current = 0;
}

IndexGenerator.prototype.getCurrent = function() {
  return this.current;
};

IndexGenerator.prototype.getNext = function() {
  return ++this.current;
};

/*
 * Permutation generation
 */

function PermutationGenerator(max) {
  this.max = max;
  this.permutation = [];
  this.fill();
}

PermutationGenerator.prototype.fill = function() {
  var i;
  var s = [];
  for (i = 0; i < this.max; i++) {
    s.push(i);
  }
  for (i = 0; i < this.max; i++) {
    var p = Math.floor(Math.random() * (this.max - i));
    this.permutation.push(s[p]);
    s.splice(p, 1);
  }
};

PermutationGenerator.prototype.peek = function(index) {
  if (this.permutation.length < this.max) {
    this.fill();
  }
  return this.permutation[index];
};

PermutationGenerator.prototype.get = function() {
  if (this.permutation.length < this.max) {
    this.fill();
  }
  return this.permutation.shift();
};

/*
 * Cookie management
 */

function setCookie(variable, value, maxAge) {
  document.cookie = variable + '=' + value + '; max-age=' + maxAge + ';';
}

function getCookie(variable, defaultValue) {
  var i;
  var value = defaultValue;
  var eqs = document.cookie.split(';');
  for (i = 0; i < eqs.length; i++) {
    var eq = eqs[i].split('=');
    if (eq[0].trim() === variable) {
      value = eq[1];
    }
  }
  return value;
}

/*
 * Gamepad management
 */

function getGamepad(threshold) {
  var i, j;
  var pads = navigator.getGamepads ? navigator.getGamepads() :
    (navigator.webkitGetGamepads ? navigator.webkitGetGamepads : []);
  var buttons = [];
  var axes = [];
  for (i = 0; i < pads.length; i++) {
    var pad = pads[i];
    if (pad === null || pad === undefined) {
      continue;
    }
    for (j = 0; j < pad.buttons.length; j++) {
      var b = pad.buttons[j];
      var bv = typeof(b) === 'object' ? b.value : b;
      if (bv < threshold) {
        bv = 0;
      }
      buttons[j] = bv;
    }
    for (j = 0; j < pad.axes.length; j++) {
      var a = pad.axes[j];
      if (a > -threshold && a < threshold) {
        a = 0;
      }
      axes[j] = a;
    }
  }
  return {buttons: buttons, axes: axes};
}
