var gui = require('nw.gui');

/* Quit */
var shortcut = new gui.Shortcut({
  key : 'Ctrl+Q',
  active : function() { gui.App.quit(); },
  failed : function(msg) { console.log('Couldn\'t register shortcut:', msg); }
});
gui.App.registerGlobalHotKey(shortcut);

/* Native menu bar (Inclues Edit with copy and paste)*/
var win = gui.Window.get();
var nativeMenuBar = new gui.Menu({ type: "menubar" });
nativeMenuBar.createMacBuiltin("My App");
win.menu = nativeMenuBar;