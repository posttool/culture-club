// [o]

function $(d) {
  return document.getElementById(d);
}

function $$(o) {
  if (o == null)
    o = {};
  if (o.el == null)
    o.el = 'div';
  var $t = document.createElement(o.el);
  if (o.text)
    $t.appendChild(document.createTextNode(o.text));
  if (o.className)
    $t.setAttribute('class', o.className);
  if (o.id)
    $t.setAttribute('id', o.id);
  if (o.type)
    $t.setAttribute('type', o.type);
  if (o.value)
    $t.setAttribute('value', o.value);
  if (o.click)
    $t.addEventListener('click', o.click);
  if (o.$parent)
    o.$parent.appendChild($t);
  return $t;
}

// $
// function $elify(self, className) {
//   var $el = $$({className: className});
//   self.$el = $el;
//   $el._self = self;
//   return $el;
// }
//
// // listen
// function eventify(self) {
//   var listeners = {};
//   self.addListener = function (name, f) {
//     if (!f)
//       return;
//     if (listeners[name])
//       listeners[name].push(f);
//     else
//       listeners[name] = [f];
//   }
//   self.on = self.addListener;
//   self.removeListeners = function (name) {
//     delete listeners[name];
//   }
//   self.emit = function (name, value) {
//     if (listeners[name])
//       for (var i = 0; i < listeners[name].length; i++)
//         listeners[name][i](value);
//   }
// }
//
// // with value
// function valuable(self, update, init) {
//   self._data = init;
//   Object.defineProperty(self, 'data', {
//     get: function () {
//       return self._data;
//     },
//     set: function (value) {
//       self._data = value;
//       update();
//     }
//   });
// }
//
// // form field utility
// function attributable(form, c, name) {
//   if (form._vals == null)
//     form._vals = {};
//   if (form._update == null)
//     form._update = function () {
//       for (var p in form._vals)
//         form._vals[p].data == form._data[p];
//     }
//   form._vals[name] = c;
//   c.on('change', function () {
//     form._data[name] = c.data;
//     form.emit('change');
//   });
// }

// utils

function createElementFromHTML(htmlString) {
  var div = document.createElement('div');
  div.innerHTML = htmlString.trim();
  return div.firstChild;
}

function show($el) {
  $el.style.display = 'block';
}
function hide($el) {
  $el.style.display = 'none';
}
