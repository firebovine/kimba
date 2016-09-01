#!/usr/bin/node

var fs = require('fs');
var request = require('request');
var crypto =  require('crypto');
var Promise = require('promise');
var HolidayAPI = require('node-holidayapi');
var Vibrant = require('node-vibrant');
var im = require("imagemagick");

var input_file = process.argv[2]
var output_file = process.argv[3]
var mask_file = process.argv[4]
var API_KEY_FILE='.apikey'
var SEARX_INSTANCE='https://searx.specops.network/'
var COUNTRY='US'
var TMP_DIR="/tmp"


function usage() {
  console.log("Usage: kimba.js input_file output_file [mask_file]");
}

function fileExists(filePath)
{
  try { 
    return fs.statSync(filePath).isFile();
  } catch (err) {
    return false;
  }
}

function testWriteFile(filePath)
{
  try {
    fs.writeFileSync(output_file, "");
    return true;
  } catch (err) {
    return false;
  }
}

function processArgs() {
  if ( ! fileExists(API_KEY_FILE) ) {
    console.log("Need HolidayAPI key in file: " + API_KEY_FILE)
    process.exit(1);
  } else {
    try {
      API_KEY = fs.readFileSync(API_KEY_FILE, 'utf8').trim();
    } catch (err) {
      console.log("Can't read file: " + API_KEY_FILE)
      process.exit(1);
    }
  }
  if ( ( ! input_file ) || ( ! output_file ) ) {
    usage();
    process.exit(1);
  }
  if ( ! fileExists(input_file) ) {
    console.log("File not found: " + input_file);
    process.exit(1);
  }
  if ( typeof mask_file !== 'undefined' ) {
    if ( ! fileExists(mask_file) ) {
      console.log("Mask file not found, but specified: " + mask_file);
      process.exit(1);
    };
  } else {
    mask_file = false
  }
  if ( ! testWriteFile(output_file) ) {
    console.log("File not writable: " + output_file);
    process.exit(1);
  }
}

function getHoliday(upcoming, callback) {
  if ( typeof callback === 'undefined' ) {
    callback = upcoming;
    upcoming = false;
  }
  var hapi = new HolidayAPI(API_KEY).v1;
  var date = new Date();
  var parameters = {
    country: COUNTRY,
    year: date.getFullYear(),
    month: date.getMonth()+1,
    day: date.getDate(),
    upcoming: upcoming,
  }
  hapi.holidays(parameters, function(err, data) {
    if (data.holidays.length == 0) {
      getHoliday(true, callback)
    } else {
      callback(data.holidays[0]);
    }
  });
}

function getImagePalette(url) {
  return new Promise(function(resolve, reject) {
    request({url: url, encoding: 'binary'}, function(error, response, body) { 
      if ( error ) {
        //return reject(error);
        return resolve(null);
      } else if ( response.statusCode !== 200 ) {
        err = new Error("Unexpected status code: " = response.statusCode);
        err.response = response;
        //return reject(error);
        return resolve(null);
      }
      filenameHash = crypto.createHash('md5').update(url).digest("hex")
      outputFile = TMP_DIR + "/kimba_" + filenameHash
      fs.writeFile(outputFile, body, 'binary', function(err) {
        if (err) {
          console.log("Error writing file: " + err);
        } else {
          v = new Vibrant(outputFile, {quality: 1})
          v.getPalette(function(err, palette) {
            if ( ! err ) {
              resolve(palette);
            } else {
              reject(err);
            }
          });
        }
      });
    });
  });
}

function createFrame(color) {
  return new Promise(function(resolve, reject) {
    var frameNameHash = crypto.createHash('md5').update(color).digest("hex")
    var frameName = TMP_DIR + "/kimbalayer_" + frameNameHash
    var conversionOpts = [input_file]
    if ( mask_file ) {
      conversionOpts.push("-mask")
      conversionOpts.push(mask_file)
    }
    conversionOpts.push("(")
    conversionOpts.push("+clone")
    conversionOpts.push("+matte")
    conversionOpts.push("-fill")
    conversionOpts.push(color)
    conversionOpts.push("-colorize")
    conversionOpts.push("100%")
    conversionOpts.push("+clone")
    conversionOpts.push("+swap")
    conversionOpts.push("-compose")
    conversionOpts.push("overlay")
    conversionOpts.push("-composite")
    conversionOpts.push(")")
    conversionOpts.push("-compose")
    conversionOpts.push("SrcIn")
    conversionOpts.push("-composite")
    if ( mask_file ) {
      conversionOpts.push("+mask")
    }
    conversionOpts.push(frameName)
/*
    im.convert(conversionOpts, function(err, stdout) {
      if (err) {
        console.log('err: ', err);
        console.log('stdout: ', stdout);
        return reject(frameName);
      }
      return resolve(frameName);
    }); */
  });
}

function createGif(callback) {
  var conversionOpts = []
  conversionOpts.push('-delay')
  conversionOpts.push('20')
  conversionOpts.push('-dispose')
  conversionOpts.push('previous')
  conversionOpts.push(TMP_DIR + "/kimbalayer_*")
  if ( mask_file ) {
    conversionOpts.push('-mask')
    conversionOpts.push(mask_file)
    conversionOpts.push('+mask')
  }
  conversionOpts.push('-loop')
  conversionOpts.push('0')
  conversionOpts.push('-layers')
  conversionOpts.push('Optimize')
  conversionOpts.push(output_file)
  im.convert(conversionOpts, function(err, stdout) {
    if (err) {
      console.log('err: ', err);
      console.log('stdout: ', stdout);
      process.exit(1)
    }
    callback();
  });
}

function createFrames(colors, callback) {
  var sequence = Promise.resolve();
  colors.forEach(function(gifLayer) {
    sequence = sequence.then(function() {
      return createFrame(gifLayer)
    }).then(function(url) {
      console.log("What: " + url);
    }).catch(function(err) {
      console.log("Error: " + err);
    });
  });
  sequence = sequence.then(function() {
    callback()
  }).catch(function(err) {
    console.log("Error: " + err);
  });
}


function processColors(palettes) {
  colors = []
  for (var i=0; i<palettes.length; i++) {
    if ( palettes[i] !== null ) {
      for ( var key in palettes[i] ) {
        colors.push("rgb("+palettes[i][key].rgb.join(",")+")");
      }
    }
  }
  return colors
}

function cleanup() {
  fs.readdir(TMP_DIR, function(error, files)
  {
    if (error) throw error;
    files.filter(function(fileName)
    {
      return /kimba.*_.*/.test(fileName)
    })
    .forEach(function(file) {
      fs.unlink(TMP_DIR+"/"+file, function(err) {
       if(err) return console.log(err);
      });
    });
  });
}

function main()
{
  processArgs();
  getHoliday(function(holiday) {
    search_query = "?q=" + encodeURIComponent(holiday.name) + "+holiday+colors&engines=google+images&categories=images&format=json";
    search_url = SEARX_INSTANCE + search_query;
    request(search_url, function(error, response, body) {
      if (!error && response.statusCode == 200) {
        var body = JSON.parse(body);
        var first_nine = body.results.slice(0, 1);
        var images = [];
        for ( var key in first_nine ) {
          images.push(first_nine[key].img_src);
        }
        var imagePromises = images.map(getImagePalette)
        Promise.all(imagePromises).then(function(palettes) {
          colors = processColors(palettes);
          createFrames(colors, function() {
            createGif(function() {
              cleanup();
            });
          });
        }).catch(function(urls) {
          console.log("Error fetching some images: " + urls)
        })       
      } else {
        if ( error ) {
          console.log(error);
        } else {
          console.log(SEARX_INSTANCE + " returned: " + response.statusCode);
        }
        process.exit(1);
      }
    });
  });
}

main()
