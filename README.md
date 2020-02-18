# express-responsive-images

Server-side scaling and caching images on-the-fly for express on Node.js.  
  
Adapted images to clients screen size, mobile friendly, reducing bandwidth and saving load time. 

[express-responsive-images on npmjs.org](https://www.npmjs.com/package/express-responsive-images)  

A minimal application to demonstrate this module can be found here:  
[github/express-responsive-images-demo](https://github.com/xkmgt/express-responsive-images-demo)  

![express-responsive-images](https://raw.githubusercontent.com/xkmgt/express-responsive-images/master/express-responsive-images.png)
  
**Features**
- scaling and caching by breakpoints
- scaling and caching depending on browser width
- direct scaling
- filetype conversion, e.g. webp
- define watched directories
- define supported filetypes
- cached images will be updated when origin image has been modified
- debug mode, see process step-by-step in console

## install

```bash
npm i express-responsive-images --save
```

## usage

### frontend

```javascript
<head>
    // somewhere in <head> section
    <script>document.cookie = 'screen=' + ('devicePixelRatio' in window ? devicePixelRatio : 1) + ',' + window.innerWidth + '; path=/';</script>
</head>
```
See other strategies down below.

### backend

```javascript
const responsiveImages = require('express-responsive-images');

app.use(responsiveImages({
    // options
    staticDir: '/public',
    watchedDirectories: ['/images', '/media'],
    // ...
}));

// below your static routes, something like this:
app.use('/', express.static(path.join(__dirname, 'public')));
```

## Real-World scenarios

You have one (big) image as origin: `/images/display.jpg` (1920x1080px).  
  
Scenario 1 - desktop device width 1920px:  
The clients device width is equal or even higher than 1920px. Everything is fine, the image will be delivered as usual.  
  
Scenario 2 - notebook device width 1280px:  
The clients device width is smaller than the image above. The image will be scaled down to 1280px (one time) and cached in `/images-cache/1280/display.jpg`. Other devices with same resolution will surf the cached file.
  
Scenario 3 - mobile device width 320px and a densitiy of 1.5:  
The above image will be scaled to 480px (320 x 1.5) and cached in `/images-cache/480/display.jpg`.  
  
Scenario 4 - direct scaling:  
You need the image in 200px regardless of the clients device width. Get it with `/images/display.jpg?w=200`. See the options `directScaling` and `directScaleSizes` to enable this feature.
  
## options (default values)
By default images are scaled to a specified list of sizes (option `scaleBy: 'breakpoint'`).  
  
If you wish you can configure it to cache images for any possible viewport width (option `scaleBy: 'viewport'`). But not recommended for public websites because it can bloat your webspace.

```javascript
app.use(responsiveImages({
    staticDir:          '/public',
    watchedDirectories: ['/images'],
    fileTypes:          ['webp', 'jpg', 'jpeg', 'png', 'gif'],
    fileTypeConversion: '',
    cacheSuffix:        '-cache',
    cookieName:         'screen',
    scaleBy:            'breakpoint',
    breakpoints:        [320, 480, 640, 800, 1024, 1280, 1366, 1440, 1600, 1920, 2048, 2560, 3440, 4096],
    directScaling:      false,
    directScalingParam: 'w',
    directScaleSizes:   [],
    debug:              false,
}));
```

### staticDir (string)
Public directory with static files. Common: '/public' or '/pub' or '/dist' ...  
  
This is not the folder to watch for images. The module need this to find images in the filesystem.

```javascript
staticDir: '/public'
```

### watchedDirectories (array)  
Array of directories to watch for images. The module is listening to requests pointing to this folders.  
  
Using wildcards `*` is possible.  

```javascript
// will match only /images directory, no subdirectories
watchedDirectories: ['/images']

// will match e.g. /img-user but not /img and not subdirectories e.g. /img/user
watchedDirectories: ['/img*'] 

// will match e.g. /images/user and /images/user/profile but not /images
watchedDirectories: ['/images/*']

// will match e.g. /images and /images/user and /images/user/profile
watchedDirectories: ['/images', '/images/*']
```

### fileTypes (array)  
Array of supported filetypes.

```javascript
fileTypes: ['webp', 'jpg', 'jpeg', 'png', 'gif']
```

### fileTypeConversion (string)  
All images will be converted to a specified filetype. 

```javascript
fileTypeConversion: 'webp'
```

### cacheSuffix (string)  
Foldername suffix where images get cached. The folder will be generated automatically. 
  
For example the image `/images/img.jpg` will be cached in `/images-cache/1024/img.jpg`.  
  
Another example: `/images/user/profile.jpg` cached in `/images/user-cache/800/profile.jpg`.  

```javascript
cacheSuffix: '-cache'
```

### cookieName (string)  
The cookie name is changable. The name has to be the same as it's called in the `<head>` tag (section "usage" above).

```javascript
cookieName: 'screen'
```

### scaleBy (string)  
Possible values: `'breakpoint'` or `'viewport'`.  
  
`breakpoint` scales images to the next equal or higher breakpoint (see option `breakpoints` below).  

```javascript
scaleBy: 'breakpoint'
```

`viewport` scales images exactly to clients browser width (not recommended for public websites).  
```javascript
scaleBy: 'viewport'
```

### breakpoints (array)  
Array of legal sizes the images get scaled to.  
  
Example: A notebook device with a width of 1280px will create and get images scaled to 1280px in width (exact breakpoint).
  
Another example: A mobile device with a width of 780px will create and get images scaled to 800px in width (next higher breakpoint).  

```javascript
breakpoints: [320, 480, 640, 800, 1024, 1280, 1366, 1440, 1600, 1920, 2048, 2560, 3440, 4096]
```

### directScaling (boolean)  
`directScaling` and `directScaleSizes` is used to scale images directly if the query parameter `w` is set.  
  
Example `/images/img.jpg?w=180` scales img.jpg to 180px in width and caches it in `images-cache/180/img.jpg`.  
  
The query parameter is by default `w`, e.g `img.jpg?w=180`. The value is the width in pixels. The parameter name is changable with the option `directScalingParam`.  
  
If set to true and a parameter `w` is send then `scaleBy` is ignored.

```javascript
directScaling: false
```

It is recommended to combine this option with `directScaleSizes` to prevent bloating your webspace.

### directScalingParam (string)  
The query parameter in the url for `directScaling`.  

```javascript
directScalingParam: 'w'
```

Change this to `myparam` then the url should look like `img.jpg?myparam=180`

### directScaleSizes (array)  
Array of allowed sizes (see option `directScaling` above).  
  
If `directScaling` is enabled it is recommended to specify allowed image sizes in here.  
  
Leave it empty to allow every image size.  

```javascript
directScaleSizes: []
```

To allow specific sizes e.g. 180px and 260px: 

```javascript
directScaleSizes: [180, 260]
```

The urls has to be then:  
- `/images/img.jpg?w=180`
- `/images/img.jpg?w=260`

### debug (boolean)  
Useful when implementing this module.  

```javascript
debug: true
```

Enable this to log errors and events to console.
  
For example:

- Error messages like `cookie not set` or `failed to create caching directory`. 
- Event messages like `file created`, `file already exist in cache` or `the calculated image size is ...`. 
  
Turn off in production mode.  

## Strategies and optimizations
The way how the cookie is set takes influence to the behaviour of the module.  
  
To decide:
- take browser width
- take browser width or height (important when changing device oriantation)
- take device width
- take device width or height (important when changing device oriantation)
  
The difference between browser and screen width is when the browser is not in fullscreen. A down scaled browser window can have smaller images if the cookie is set to `window.innerWidth` or `window.innerHeight`.  
  
If set to `screen.width` or `screen.height` the images are related to the device resolution regardless of the browsers size.  
  
The advantage of `Math.max(...)` is when the device changing the oriantation. The image will stay sharp because the greater dimension is already loaded.

### With window.innerWidth and window.innerHeight
Scaling the browser window has an effect to image sizes.

````javascript
document.cookie = 'screen=' + ('devicePixelRatio' in window ? devicePixelRatio : 1) + ',' + window.innerWidth + '; path=/';
````

````javascript
document.cookie = 'screen=' + ('devicePixelRatio' in window ? devicePixelRatio : 1) + ',' + Math.max(window.innerWidth, window.innerHeight) + '; path=/';
````

### With screen.width and screen.height
Scaling the browser window has no effect to image sizes. The device resolution is crucial.

````javascript
document.cookie = 'screen=' + ('devicePixelRatio' in window ? devicePixelRatio : 1) + ',' + screen.width + '; path=/';
````

````javascript
document.cookie = 'screen=' + ('devicePixelRatio' in window ? devicePixelRatio : 1) + ',' + Math.max(screen.width, screen.height) + '; path=/';
````

### SPA's and similar usecases
This is just an experimental idea and has to be adjusted individually.  
  
To have updated cookies while requests are fired and the page does not get fully reloaded a resize event listener could help:

```javascript
(function () {
	var w = window.innerWidth;
	window.addEventListener('resize', function () {
		if (w !== window.innerWidth) {
			w = window.innerWidth;
			setCookie();
			// or instead of setCookie() reload the page
			// location.reload();
		}
	}, false);

	var setCookie = function () {
		document.cookie = 'screen=' + ('devicePixelRatio' in window ? devicePixelRatio : 1) + ',' + window.innerWidth + '; path=/';
	};

	setCookie();
})();
```