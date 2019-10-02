/*!
 * express-responsive-images
 * Copyright(c) 2019 Murat Karaca
 * MIT Licensed
 * https://github.com/xkmgt/express-responsive-images
 */

'use strict'

/**
 * Module dependencies
 * @private
 */

var chalk     = require('chalk')
var fs        = require('fs-extra')
var imageSize = require('image-size')
var path      = require('path')
var sharp     = require('sharp')
var url       = require('url')

/**
 * Module variables
 * @private
 */

var moduleName = 'express-responsive-images'

/**
 * Module
 */

module.exports = function (opts = {}) {
  // options documented under https://github.com/xkmgt/express-responsive-images
  var options = {
    staticDir           : '',
    watchedDirectories  : ['/images'],
    fileTypes           : ['webp', 'jpg', 'jpeg', 'png', 'gif'],
    fileTypeConversion  : '',
    cacheSuffix         : '-cache',
    cookieName          : 'screen',
    scaleBy             : 'breakpoint',
    breakpoints         : [320, 480, 640, 800, 1024, 1280, 1366, 1440, 1600, 1920, 2048, 2560, 3440, 4096],
    directScaling       : false,
    directScalingParam  : 'w',
    directScaleSizes    : [],
    debug               : false,
    ...opts // assign user options to default options
  }

  // log errors and events to console
  var debug = (color, message) => {
    if (options.debug)
      console.log(`${moduleName}: ${chalk.keyword(color)(message)}`)
  }

  return (req, res, next) => {

    // declare requested url parts
    var urlObj        = url.parse(req.url, true)      // e.g. req.url = /media/subdir/image.jpg?w=200
    var requestUrl    = urlObj.pathname               // e.g. /media/subdir/image.jpg
    var requestPath   = path.dirname(urlObj.pathname) // e.g. /media/subdir
    var requestQueryW = parseInt(urlObj.query[options.directScalingParam]) || 0 // e.g. 200

    // at least one watched directory has to be specified
    if (!options.watchedDirectories.length) {
      debug(`red`, `there is not any directory specified to watch!`)
      return next()
    }

    // is requested path in list of watching directories ?
    var validPath = false
    for (var dir of options.watchedDirectories) {
      // wildcards in pattern
      if (dir.includes('*'))
        dir = dir.replace(/\*/g, '[^/].*')
      if (new RegExp('^' + dir + '$').test(requestPath)) {
        validPath = true
        debug(`green`, `requested directory is in watchlist: ${requestPath}`)
        break
      }
    }
    if (!validPath) {
      // request is something else, get out of this module !
      debug(`orange`, `requested directory is not in watchlist: ${requestPath}`)
      return next()
    }

    debug(`green`, `requested file: ${path.basename(requestUrl)}`)

    // declare some vars
    var newImageWidth     = 1                             // will become e.g. '1280'
    var originFilePath    = path.join(process.cwd(), options.staticDir + requestUrl) // e.g. '<FILESYSTEMPATH>/<PROJECT>/public/images/subdir/image.jpg'
    var reqFileName       = path.basename(requestUrl)     // e.g. 'image.jpg'
    var reqFileType       = reqFileName.split('.').pop()  // e.g. 'jpg'
    var newFileType       = ''                            // can become e.g. '.webp'
    var cacheFilePath     = ''                            // will become e.g. '<FILESYSTEMPATH>/<PROJECT>/images-cache/1280/image.jpg'
    var cacheFileWidth    = 1                             // will become e.g. '1280'
    var cacheDirPath      = path.join(process.cwd(), options.staticDir + path.dirname(requestUrl) + options.cacheSuffix) // e.g. '<FILESYSTEMPATH>/<PROJECT>/public/images-cache', will become e.g.: '<FILESYSTEMPATH>/<PROJECT>/public/images-cache/1280'

    // change requested url and return
    var sendCachedFile = () => {
      req.url = path.dirname(requestUrl) + options.cacheSuffix + '/' + cacheFileWidth.toString() + '/' + reqFileName + newFileType
      debug(`green`, `requested url updated to ${req.url}`)
      return next()
    }

    // create scaled image
    var createCacheFile = () => {
      // create directory if needed
      fs.ensureDir(cacheDirPath, err => {
        if (err) {
          debug(`red`, `failed to create caching directory: ${cacheFilePath}`)
          return next()
        }
        // disable sharp to cache files
        sharp.cache(false)
        // create and cache image
        sharp(originFilePath)
          .resize(cacheFileWidth)
          .toFile(cacheFilePath, (err, info) => {
            if (err) {
              debug(`red`, `sharp faild to create file: ${err}`)
              return next()
            }
            else {
              debug(`green`, `image scaled and created: ${cacheFilePath}`)
              return sendCachedFile()
            }
          })
      })
    }

    // is filetype supported ?
    options.fileTypes = options.fileTypes.map(x => x.toLowerCase())
    if (options.fileTypes.includes(reqFileType.toLowerCase())) {
      debug(`green`, `filetype is supported: ${reqFileType}`)
    }
    else {
      debug(`orange`, `filetype is not supported: ${reqFileType}`)
      return next()
    }

    // does origin image exists ?
    if (!fs.existsSync(originFilePath)) {
      debug(`red`, `origin image does not exists`)
      return next()
    }

    // does cookie exists ?
    if (req.headers.cookie) {
      var cookies = req.headers.cookie + ';'
      var deviceParameters = cookies.match(new RegExp(`(^|;| )${options.cookieName}=([^,]+),([^;]+)`))
      // deviceParameters[2] = density, deviceParameters[3] = width
    }
    else {
      debug(`red`, `no cookie in requested headers`)
      return next()
    }
    if (deviceParameters) {
      // calculate new image width
      newImageWidth = Math.round(deviceParameters[2] * deviceParameters[3])
      debug(`green`, `cookie "${options.cookieName}" is set: density=${deviceParameters[2]}, width=${deviceParameters[3]}`)
    }
    else {
      debug(`red`, `cookie "${options.cookieName}" does not exists`)
      return next()
    }

    // check for directScaling
    var directScale = false
    if (options.directScaling && requestQueryW > 0) {
      if (!options.directScaleSizes.length || (options.directScaleSizes.length && options.directScaleSizes.includes(requestQueryW))) {
        // calculate new image width
        newImageWidth = Math.round(requestQueryW * deviceParameters[2])
        directScale = true
      }
      else {
        debug(`orange`, `image size not listed in directScaleSizes: ${requestQueryW}`)
        return next()
      }
    }
    if (!options.directScaling && requestQueryW > 0) {
      debug(`orange`, `direct scaling is not enabled`)
    }

    // be sure new image width is a legal number
    if (typeof newImageWidth !== 'number' || isNaN(newImageWidth) || newImageWidth < 1) {
      debug(`red`, `calculated image width is not a legal number`)
      return next()
    }

    debug(`green`, `new image width is probably ${newImageWidth}`)

    // return if image is smaller than newImageWidth
    if (newImageWidth >= imageSize(originFilePath).width) {
      debug(`orange`, `origin image is smaller than new image width`)
      return next()
    }

    // direct scaling
    if (directScale) {
      debug(`green`, `scale by: directScale`)
      cacheFileWidth = newImageWidth
    }
    // scaleBy viewport
    else if (options.scaleBy === 'viewport') {
      debug(`green`, `scale by: viewport`)
      cacheFileWidth = newImageWidth
    }
    // scaleBy breakpoint
    else if (options.scaleBy === 'breakpoint') {
      debug(`green`, `scale by: breakpoint`)
      var breakpointMax = Math.max(...options.breakpoints)
      // breakpoints in ascending order
      options.breakpoints = options.breakpoints.sort((a, b) => a - b)
      // check if device is greater than highest breakpoint
      if (newImageWidth > breakpointMax) {
        debug(`orange`, `highest breakpoint (${breakpointMax}) is smaller than new image width (${newImageWidth})`)
        return next()
      }
      else {
        // take the matching breakpoint or the next higher one
        cacheFileWidth = options.breakpoints.find(e => { return e >= newImageWidth })
        // if cacheFileWidth is undefined get out
        if (!cacheFileWidth) {
          debug(`red`, `cacheFileWidth is undefined, can't define a breakpoint`)
          return next()
        }
      }
    }

    debug(`green`, `image width should be: ${cacheFileWidth}`)

    // set cache directory
    cacheDirPath = path.join(cacheDirPath, cacheFileWidth.toString())
    debug(`green`, `cache directory: ${cacheDirPath}`)

    // convert filetypes
    if (options.fileTypeConversion !== '' && options.fileTypeConversion !== reqFileType) {
      var fileTypeAccepted = true
      // check if client accepts webp
      if (options.fileTypeConversion === 'webp' && req.headers.accept.toLowerCase().indexOf('image/webp') === -1) {
        fileTypeAccepted = false
        debug(`orange`, `filetype "webp" is not accepted by client`)
      }
      // set new filetype
      if (fileTypeAccepted) {
        newFileType = `.${options.fileTypeConversion}`
        debug(`green`, `new filetype will be: ${newFileType}`)
      }
    }

    // does cached image exists and is it up to date ?
    cacheFilePath = path.join(cacheDirPath, reqFileName + newFileType)
    if (fs.existsSync(cacheFilePath)) {
      if (fs.statSync(originFilePath).mtime.getTime() > fs.statSync(cacheFilePath).mtime.getTime()) {
        debug(`orange`, `cached image is stale and will be removed: ${cacheFilePath}`)
        // origin image was modified, delete cached image`)
        fs.unlinkSync(cacheFilePath)
        // and create it again
        return createCacheFile()
      }
      else {
        // cached image exists, send it!
        debug(`green`, `requested image is in cache: ${cacheFilePath}`)
        return sendCachedFile()
      }
    }
    else {
      // cached image does not exists, create it!
      debug(`orange`, `requested image is not in cache: ${cacheFilePath}`)
      return createCacheFile()
    }
  }

}