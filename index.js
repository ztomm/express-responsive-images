/*!
 * express-responsive-images
 * Copyright(c) 2023 Murat Motz
 * MIT Licensed
 * https://github.com/ztomm/express-responsive-images
 */

'use strict'

/**
 * Module dependencies
 * ----------------------------------------------------------
 */

const fs        = require('fs-extra')
const imageSize = require('image-size')
const path      = require('path')
const pc        = require('picocolors')
const sharp     = require('sharp')
const url       = require('url')


/**
 * Module
 * ----------------------------------------------------------
 */

module.exports = function expressResponsiveImages(options) {

	options = options || {}

	// Documentation for the options under https://github.com/ztomm/express-responsive-images
	options = {
		staticDir          : '',
		watchedDirectories : ['/images'],
		fileTypes          : ['webp', 'jpg', 'jpeg', 'png', 'gif'],
		fileTypeConversion : '',
		cacheSuffix        : '-cache',
		cookieName         : 'screen',
		scaleBy            : 'breakpoint',
		breakpoints        : [320, 480, 640, 800, 1024, 1280, 1366, 1440, 1600, 1920, 2048, 2560, 3440, 4096],
		directScaling      : false,
		directScalingParam : 'w',
		directScaleSizes   : [],
		debug              : false,
		...options // assign user options to default options
	}

	// log errors and events to console
	const debug = (color, message) => {
		if (options.debug)
			console.log(`'express-responsive-images': ${pc[color](message)}`)
	}

	return (req, res, next) => {

		// declare requested url parts
		let urlObj          = url.parse(req.url, true)      // e.g. req.url = /media/subdir/image.jpg?w=200
		let requestUrl      = urlObj.pathname               // e.g. /media/subdir/image.jpg
		let requestPath     = path.dirname(urlObj.pathname) // e.g. /media/subdir
		let requestFileName = path.basename(requestUrl)     // e.g. 'image.jpg'
		let requestQueryW   = parseInt(urlObj.query[options.directScalingParam]) || 0 // e.g. 200

		debug(`yellow`, `${req.url} --------------------------------------`)

		// at least one watched directory has to be specified
		if (!options.watchedDirectories.length) {
			debug(`red`, `(${requestFileName}) no directory specified in watchlist!`)
			return next()
		}

		// is requested path in list of watching directories ?
		let validPath = false
		for (let dir of options.watchedDirectories) {
			// wildcards in pattern
			if (dir.includes('*'))
				dir = dir.replace(/\*/g, '[^/].*')
			if (new RegExp('^' + dir + '$').test(requestPath)) {
				validPath = true
				debug(`green`, `(${requestFileName}) requested directory is in watchlist: ${requestPath}`)
				break
			}
		}
		if (!validPath) {
			// request is something else, get out of this module !
			debug(`magenta`, `(${requestFileName}) requested directory is not in watchlist: ${requestPath}`)
			return next()
		}

		debug(`green`, `(${requestFileName}) requested file: ${path.basename(requestUrl)}`)

		// declare some vars
		let newImageWidth    = 1                             // will become e.g. '1280'
		let originalFilePath = path.join(process.cwd(), options.staticDir + requestUrl) // e.g. '<FILESYSTEMPATH>/<PROJECT>/public/images/subdir/image.jpg'
		let reqFileName      = requestFileName               // e.g. 'image.jpg'
		let reqFileType      = reqFileName.split('.').pop()  // e.g. '.jpg'
		let newFileType      = ''                            // can become e.g. '.webp'
		let newFilePath      = ''  													 // will become e.g. '/images-cache/1280/image.jpg'
		let cacheFilePath    = ''                            // will become e.g. '<FILESYSTEMPATH>/<PROJECT>/images-cache/1280/image.jpg'
		let cacheFileWidth   = 0                             // will become e.g. '1280'
		let cacheDirPath     = path.join(process.cwd(), options.staticDir + path.dirname(requestUrl) + options.cacheSuffix) // e.g. '<FILESYSTEMPATH>/<PROJECT>/public/images-cache', will become e.g.: '<FILESYSTEMPATH>/<PROJECT>/public/images-cache/1280'
		let deviceParameters = [] 											     // array: deviceParameters[2] = device-density, deviceParameters[3] = device-width

		// is image corrupted ?
		const isImageCorrupted = (imagePath) => {
			try {
				imageSize(imagePath)
				return false
			} catch (err) {
				debug(`red`, `(${imagePath}) image is corrupted`)
				return true
			}
		}

		// change requested url and return
		const sendCachedFile = () => {
			req.url = newFilePath
			debug(`green`, `(${reqFileName}) requested url updated to ${req.url}`)
			return next()
		}

		// create scaled image
		const createCacheFile = async () => {
			// create directory if needed
			fs.ensureDirSync(cacheDirPath)
			// disable sharp to cache files
			sharp.cache(false)
			// create and cache image
			try {
				await sharp(originalFilePath)
					.resize(cacheFileWidth)
					.withMetadata()
					.toFile(cacheFilePath)
			}
			catch(err) {
				debug(`red`, `(${reqFileName}) sharp error when creating the file: ${err}`)
				return next()
			}
			debug(`green`, `(${reqFileName}) image scaled and created: ${cacheFilePath}`)
			return sendCachedFile()
		}

		// lookup image in cache / delete outdated / create it / send it
		const prepareResponse = () => {
			if (fs.existsSync(cacheFilePath)) {
				if (fs.statSync(originalFilePath).mtime.getTime() > fs.statSync(cacheFilePath).mtime.getTime()) {
					debug(`blue`, `(${reqFileName}) cached image is stale and will be removed: ${cacheFilePath}`)
					// original image was modified, delete cached image, 
					fs.unlinkSync(cacheFilePath)
					// create it again, send it
					return createCacheFile()
				}
				else {
					// cached image exists, send it
					debug(`green`, `(${reqFileName}) requested image is in cache: ${cacheFilePath}`)
					return sendCachedFile()
				}
			}
			// cached image does not exists, create and send it
			debug(`magenta`, `(${reqFileName}) requested image is not in cache: ${cacheFilePath}`)
			return createCacheFile()
		}

		// is filetype supported ?
		options.fileTypes = options.fileTypes.map(x => x.toLowerCase())
		if (options.fileTypes.includes(reqFileType.toLowerCase())) {
			debug(`green`, `(${reqFileName}) filetype is permitted: ${reqFileType}`)
		}
		else {
			debug(`magenta`, `(${reqFileName}) filetype is not permitted: ${reqFileType}`)
			return next()
		}

		// does original image exists ?
		if (!fs.existsSync(originalFilePath)) {
			debug(`red`, `(${reqFileName}) original image does not exists`)
			return next()
		}

		// original image corrupted ?
		if (isImageCorrupted(originalFilePath)) 
			return next()

		// does cookie exists ?
		if (req.headers.cookie) {
			let cookies = req.headers.cookie + ';'
			deviceParameters = cookies.match(new RegExp(`(^|;| )${options.cookieName}=([^,]+),([^;]+)`)) || []
			// deviceParameters[2] = density, deviceParameters[3] = width
			if (deviceParameters.length)
				debug(`green`, `(${reqFileName}) cookie "${options.cookieName}" is set: density=${deviceParameters[2]}, width=${deviceParameters[3]}`)
			else 
				debug(`magenta`, `(${reqFileName}) cookies sent but module cookie not found`)
		}
		else {
			debug(`red`, `(${reqFileName}) no cookie in headers`)
		}
		// no cookies sent or module cookie not found
		if (!req.headers.cookie || !deviceParameters.length) {
			// support directScaling even if the cookie is missing
			if (options.directScaling && requestQueryW > 0) {
				deviceParameters[2] = 1 // guess density
				deviceParameters[3] = 1 // dummy value
				debug(`magenta`, `(${reqFileName}) no cookies sent (directScaling still possible)`)
			}
		}
		if (deviceParameters.length) {
			// calculate new image width
			newImageWidth = Math.round(deviceParameters[2] * deviceParameters[3])
		}
		else {
			debug(`red`, `(${reqFileName}) deviceParameters still not set`)
			return next()
		}

		// check for directScaling
		let directScale = false
		if (options.directScaling && requestQueryW > 0) {
			if (!options.directScaleSizes.length || (options.directScaleSizes.length && options.directScaleSizes.includes(requestQueryW))) {
				// calculate new image width
				newImageWidth = Math.round(requestQueryW * (deviceParameters[2] || 1))
				directScale = true
			}
			else {
				debug(`red`, `(${reqFileName}) image size is not permitted by directScaleSizes: ${requestQueryW}`)
				return next()
			}
		}
		if (!options.directScaling && requestQueryW > 0) {
			debug(`red`, `(${reqFileName}) direct scaling is not enabled`)
		}

		// be sure new image width is a legal number
		if (typeof newImageWidth !== 'number' || isNaN(newImageWidth) || newImageWidth < 1) {
			debug(`red`, `(${reqFileName}) calculated image width is not a legal number`)
			return next()
		}

		debug(`green`, `(${reqFileName}) new image width is probably ${newImageWidth}`)

		// convert filetypes
		let fileTypeConversion = false
		if (options.fileTypeConversion !== '' && options.fileTypeConversion !== reqFileType) {
			fileTypeConversion = true
			// check if client accepts webp
			if (options.fileTypeConversion === 'webp' && (req.headers.accept || ''.toLowerCase()).indexOf('image/webp') === -1) {
				debug(`red`, `(${reqFileName}) filetype "webp" is not accepted by client`)
				fileTypeConversion = false
			}
			// set new filetype
			if (fileTypeConversion) {
				newFileType = `.${options.fileTypeConversion}`
				debug(`green`, `(${reqFileName}) new filetype is: ${newFileType}`)
			}
		}

		// return if image is smaller than newImageWidth
		if (newImageWidth >= imageSize(originalFilePath).width) {
			debug(`magenta`, `(${reqFileName}) original image is smaller than new image width`)
			// if fileTypeConversion
			if (fileTypeConversion) {
				debug(`magenta`, `(${reqFileName}) preparing fileTypeConversion`)
				cacheFilePath = path.join(cacheDirPath, reqFileName + newFileType)
				cacheFileWidth = imageSize(originalFilePath).width
				newFilePath = path.dirname(requestUrl) + options.cacheSuffix + '/' + reqFileName + newFileType
				return prepareResponse()
			}
			else {
				return next()
			}
		}

		// direct scaling
		if (directScale) {
			debug(`green`, `(${reqFileName}) scale by: directScale`)
			cacheFileWidth = newImageWidth
		}
		// scaleBy viewport
		else if (options.scaleBy === 'viewport') {
			debug(`green`, `(${reqFileName}) scale by: viewport`)
			cacheFileWidth = newImageWidth
		}
		// scaleBy breakpoint
		else if (options.scaleBy === 'breakpoint') {
			debug(`green`, `(${reqFileName}) scale by: breakpoint`)
			let breakpointMax = Math.max(...options.breakpoints)
			// breakpoints in ascending order
			options.breakpoints = options.breakpoints.sort((a, b) => a - b)
			// check if device is greater than highest breakpoint
			if (newImageWidth > breakpointMax) {
				debug(`magenta`, `(${reqFileName}) highest breakpoint (${breakpointMax}) is smaller than new image width (${newImageWidth})`)
				return next()
			}
			else {
				// take the matching breakpoint or the next higher one
				cacheFileWidth = options.breakpoints.find(e => { return e >= newImageWidth })
				// if cacheFileWidth is undefined get out
				if (!cacheFileWidth) {
					debug(`red`, `(${reqFileName}) cacheFileWidth is undefined, can't define a breakpoint`)
					return next()
				}
			}
		}

		debug(`green`, `(${reqFileName}) new image width is: ${cacheFileWidth}`)

		// cache directory
		cacheDirPath = path.join(cacheDirPath, cacheFileWidth.toString())
		debug(`green`, `(${reqFileName}) cache directory: ${cacheDirPath}`)

		// path to file in cache
		cacheFilePath = path.join(cacheDirPath, reqFileName + newFileType)

		newFilePath = path.dirname(requestUrl) + options.cacheSuffix + '/' + cacheFileWidth.toString() + '/' + reqFileName + newFileType
		return prepareResponse()
	}

}
