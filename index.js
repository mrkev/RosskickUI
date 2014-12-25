'use strict';
/* global require, console, process, alert */
var path = require('path');
var __rosshouse = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'] + '/.rosskick';


var $project_name    = document.querySelector('#project_name');
var $project_version = document.querySelector('#project_version');

var p;
var project;
var keys = null;

/**
 * Loads the project for the directory selected by the user.
 * @return [Side effect] variable p points to the preferences object for the 
 * project selected.
 */
var project_changed = function (e) {
  if (e.target.files.length === 0) return;
  project = e.target.files[0];

  try { p = require(path.join(project.path, 'package.json')); } 
  catch (e) { return; }

  got_project(true);

  $project_name.innerHTML = p.name;
  $project_version.innerHTML = p.version;

  if (!p.update) p.update = {};
  if (!p.update.endpoint) {
    p.update.endpoint = '<< SET ME >>';
    console.log('You should set the enpoint.');
  }

  var k = check_keys(p);
  got_keys(k);
  if (!k) return;
  keys = k;

};

document.querySelector('#project_directory')
  .addEventListener('change', project_changed);



var format = require('format-json');

/**
 * Saves [p] as the open project's package.json
 * @param  {package.json} p Project file to save
 * @return {boolean}        True if save was successful. False otherwise.
 */
var save_p = function (p) {
  try {
    fs.outputFileSync
    (path.join(project.path, 'package.json'), format.plain(p));
    return true;
  } catch (e) {
    console.log('Error saving project.json');
    console.log(e);
    return false;
  }
};

/**
 * Checks if keys exist for project [p]. Compares the public key in [p] against
 * the one saved on disk.
 * @param  {package.json} p Project's package.json to find the keys for.
 * @return {keys}           {pub_key, priv_key}. null if keys don't exist,
 *                          or don't match.
 */
var check_keys = function (p) {
  var priv_key, pub_key;
  try {
    priv_key = fs.readFileSync(__rosshouse + '/' + p.name + '/update_rsa', 'utf8');
    pub_key  = fs.readFileSync(__rosshouse + '/' + p.name + '/update_rsa.pub', 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') {
      alert('Couldn\'t ' + e.syscall + ' ' + e.path);
    } 
    else { alert(e); }
    return null;
  }

  if (pub_key !== p.update.pubkey) {
    alert('Project update.pubkey and saved pubkey don\'t match');
    return null;
  }


  return {
    priv_key : priv_key,
    pub_key : pub_key
  };
};


// Generate keys 


var keygen = require('ssh-keygen');
var fs = require('fs-extra');

/**
 * Generates public and private keys for current project.
 * @return [Side Effect] creates public and private RSA key files at 
 *                       ~/.rosskick/<projectname>/update_rsa[.pub]
 * @fix    Warning if files exist? No overwrite?
 */
var generate_keys = function () {
  var __kickhouse = __rosshouse + '/' + p.name;
  fs.ensureDir(__kickhouse, function (err) {
    if (err) return;
    keygen({
      location: __kickhouse + '/update_rsa',
      comment:  '',
      password: false,
      destroy: false,
      force: true,
      read: true
    }, function(err, out){
        if (err) return console.log('Something went wrong: ' + err);
        console.log('Keys created!');
        console.log('private key: '+ out.key);
        console.log('public key: '+ out.pubKey);
        p.update.pubkey = out.pubKey;
        if (save_p(p)) {got_keys(true);}
        else {alert('there was an error saving the keys.');}
    });
  });
};


// Sign

require('coffee-script/register');
var Kick = require('./scripts/sign.coffee');
var Promise = require('es6-promise').Promise;

var $sign_result = document.querySelector('#sign_result');

/**
 * Sign files for specified paths. Display result on HTML.
 */
var sign_updates = function (paths) {
  var signer = new Kick(__rosshouse + '/' + p.name + '/update_rsa');
  if (paths.length === 0) return;
  
  var promises = Array.prototype.map.call(paths, function (path) {
    return signer.sign(path).catch(console.trace);
  });

  Promise.all(promises)
  .then(function (results) {
    var i = 0;
    results = results.reduce(function (acc, res) {
      res['url'] = '<< SET ME >>';
      acc[path.basename(paths[i++], path.extname(paths[i-1]))] = res;
      return acc;
    }, {});
    $sign_result.value = format.plain(results);
  }).catch(console.trace);
};


var do_sign_updates = function (e) {
  sign_updates(Array.prototype.map.call(e.target.files, function (x) {
    return x.path;
  }));
};

document.querySelector('#update_to_sign')
  .addEventListener('change', do_sign_updates);


// Build
var Builder = require('./scripts/build.coffee');

/**
 * Builds project on [p.path]/build, for platforms selected on teh UI.
 * @return {[type]} [description]
 */
var build_project = function () {
  var platforms = get_build_platforms();
  if (platforms.length === 0) throw new Error('No platforms selected');

  var nw = new Builder(project.path, platforms);
  return nw.build();
};


// Zip
// 
var archiver = require('archiver');

/**
 * Zips directories in [project.path]/build into archives in the same directory.
 * @return {Promsie} resolves to array of created zip files once all files have
 * been zipped.
 */
var zip_builds = function () {
  return new Promise(function (resolve) {
    var build_dir = path.join(project.path, '/build/' + p.name);

    var zips = [];
    getDirectories(build_dir).forEach(function (dir, i, arr) {
      
      var out = fs.createWriteStream(dir + '.zip');
      var archive = archiver('zip');
      
      out.on('close', function () {
          console.log(archive.pointer() + ' total bytes');
          console.log('archiver has been finalized and the output file descriptor has closed.');
          zips.push(dir + '.zip');
          if (zips.length === arr.length) resolve(zips);
      });

      archive.on('error', function(err){ throw err; });

      archive.pipe(out);

      archive.bulk([{ src: ['**'], expand: true, cwd: dir, dest: path.basename(dir) }]);
      archive.finalize();
    });
  });
};

var do_the_thing = function () {
  build_project().then(function () {
    console.log('zip');
    return zip_builds();
  }).then(function (zips) {
    return sign_updates(zips);
  }).catch(console.log);
};


/**
 * @return Array of all direct subdirectories for the specified path.
 * From: http://stackoverflow.com/questions/18112204/get-all-directories-within-directory-nodejs
 */
function getDirectories(srcpath) {
  return fs.readdirSync(srcpath).filter(function(file) {
    return fs.statSync(path.join(srcpath, file)).isDirectory();
  }).map(function (dir) {
    return srcpath + '/' + dir;
  });
}





var $ = require('jquery');
$(function() {
    var $ = require('jquery');
    $('.needed').hide();
});


//
// UI
// 


/**
 * Update UI based on wether we have keys or not.
 * @param  {boolean} yes do we have RSA keys for signing?
 */
var got_keys = function (yes) {
  if (yes) {
    $('.keys.needed').show();
    $('.nokeys.needed').hide();
  } else {
    $('.keys.needed').hide();
    $('.nokeys.needed').show();
  }
  return undefined;
};

/**
 * Update UI based on wether we have a project or not.
 * @param  {boolean} yes do we have a project to work on?
 */
var got_project = function (yes) {
  if (yes) {
    $('.project.needed').show();
  } else {
    $('.project.needed').hide();
  }
};

/**
 * Returns array of selected build platforms for build.
 * @return {Array} Platforms selected as build targets.
 */
var get_build_platforms = function () {
  return ['osx64','osx32','win64','win32','linux64','linux32']
    .reduce(function (prev, curr) {
      if (document.getElementById(curr).checked) {
        prev.push(curr);
      }
      return prev;
    }, []);
};





