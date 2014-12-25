spawn = require("child_process").spawn
Promise = require("es6-promise").Promise

class Buildier
  constructor: (@path, @platforms) ->
  
  build: () ->
    self = this
    return new Promise (resolve) ->
      nwbuild = spawn("nwbuild", 
        ["--platforms", self.platforms.join(","),
         "--buildDir", self.path + '/build'
         self.path])
      
      nwbuild.stdout.on "data", (data) ->
        console.log "stdout: " + data
        return
  
      nwbuild.stderr.on "data", (data) ->
        console.log "stderr: " + data
        return
  
      nwbuild.on "exit", (code) ->
        console.log "child process exited with code " + code
        resolve(code)
        return

module.exports = Buildier