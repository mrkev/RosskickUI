#!/usr/bin/env coffee
crypto    = require("crypto")
Promise   = require("es6-promise").Promise
fs        = require("fs")

class Kick
  ##
  # Requires: Path to PEM encoded private key string
  constructor : (@priv_key_path) ->

  sign : (file) ->
    self = this
    return new Promise (resolve) ->
      priv_key = fs.readFileSync(self.priv_key_path, "utf8")

      hash = crypto.createHash("SHA1")
      sign = crypto.createSign("RSA-SHA256")
      
      read_stream = fs.createReadStream(file)
      read_stream.pipe hash
      read_stream.pipe sign
      
      read_stream.on "end", ->
        hash.end()
        
        resolve
          checksum  : hash.read().toString("hex")
          signature : sign.sign(priv_key, "hex")

module.exports = Kick

if require.main is module
  program = require('commander');
  program
    .version('0.0.1')
    .option('-k, --key <key>', 'PEM-encoded private RSA key to use')
    .option('-f, --file <file>', 'File to sign')
  
  program.parse(process.argv)

  if not program.file
    program.file = "./sign.coffee"

  if not program.key
    program.key = './sample/server/key'

  signer = new Kick(program.key)
  signer.sign(program.file).then console.log

