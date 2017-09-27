/*! sass.js - v0.10.6 (f91eed9) - built 2017-07-28
  providing libsass 3.4.5 (31573210)
  via emscripten 1.37.0 ()
 */

(function (root, factory) {
  'use strict';
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root.Sass = factory();
  }
}(this, function () {/*global document*/
// identify the path sass.js is located at in case we're loaded by a simple
// <script src="path/to/sass.js"></script>
// this path can be used to identify the location of
// * sass.worker.js from sass.js
// * libsass.js.mem from sass.sync.js
// see https://github.com/medialize/sass.js/pull/32#issuecomment-103142214
// see https://github.com/medialize/sass.js/issues/33
var SASSJS_RELATIVE_PATH = (function() {
  'use strict';

  // in Node things are rather simple
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }

  // we can only run this test in the browser,
  // so make sure we actually have a DOM to work with.
  if (typeof document === 'undefined' || !document.getElementsByTagName) {
    return null;
  }

  // http://www.2ality.com/2014/05/current-script.html
  var currentScript = document.currentScript || (function() {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  var path = currentScript && currentScript.src;
  if (!path) {
    return null;
  }

  // [worker] make sure we're not running in some concatenated thing
  if (path.slice(-8) === '/sass.js') {
    return path.slice(0, -8);
  }

  // [sync] make sure we're not running in some concatenated thing
  if (path.slice(-13) === '/sass.sync.js') {
    return path.slice(0, -13);
  }

  return null;
})() || '.';

/*global Worker, SASSJS_RELATIVE_PATH*/
'use strict';

var noop = function(){};
var slice = [].slice;
// defined upon first Sass.initialize() call
var globalWorkerUrl;

function Sass(workerUrl) {
  if (!workerUrl && !globalWorkerUrl) {
    /*jshint laxbreak:true */
    throw new Error(
      'Sass needs to be initialized with the URL of sass.worker.js - '
      + 'either via Sass.setWorkerUrl(url) or by new Sass(url)'
    );
    /*jshint laxbreak:false */
  }

  if (!globalWorkerUrl) {
    globalWorkerUrl = workerUrl;
  }

  // bind all functions
  // we're doing this because we used to have a single hard-wired instance that allowed
  // [].map(Sass.removeFile) and we need to maintain that for now (at least until 1.0.0)
  for (var key in this) {
    if (typeof this[key] === 'function') {
      this[key] = this[key].bind(this);
    }
  }

  this._callbacks = {};
  this._worker = new Worker(workerUrl || globalWorkerUrl);
  this._worker.addEventListener('message', this._handleWorkerMessage, false);
}

// allow setting the workerUrl before the first Sass instance is initialized,
// where registering the global workerUrl would've happened automatically
Sass.setWorkerUrl = function(workerUrl) {
  globalWorkerUrl = workerUrl;
};

Sass.style = {
  nested: 0,
  expanded: 1,
  compact: 2,
  compressed: 3
};

Sass.comments = {
  'none': 0,
  'default': 1
};

Sass.prototype = {
  style: Sass.style,
  comments: Sass.comments,

  destroy: function() {
    this._worker && this._worker.terminate();
    this._worker = null;
    this._callbacks = {};
    this._importer = null;
  },

  _handleWorkerMessage: function(event) {
    if (event.data.command) {
      this[event.data.command](event.data.args);
    }

    this._callbacks[event.data.id] && this._callbacks[event.data.id](event.data.result);
    delete this._callbacks[event.data.id];
  },

  _dispatch: function(options, callback) {
    if (!this._worker) {
      throw new Error('Sass worker has been terminated');
    }

    options.id = 'cb' + Date.now() + Math.random();
    this._callbacks[options.id] = callback;
    this._worker.postMessage(options);
  },

  _importerInit: function(args) {
    // importer API done callback pushing results
    // back to the worker
    var done = function done(result) {
      this._worker.postMessage({
        command: '_importerFinish',
        args: [result]
      });
    }.bind(this);

    try {
      this._importer(args[0], done);
    } catch(e) {
      done({ error: e.message });
      throw e;
    }
  },

  importer: function(importerCallback, callback) {
    if (typeof importerCallback !== 'function' && importerCallback !== null) {
      throw new Error('importer callback must either be a function or null');
    }

    // callback is executed in the main EventLoop
    this._importer = importerCallback;
    // tell worker to activate importer callback
    this._worker.postMessage({
      command: 'importer',
      args: [Boolean(importerCallback)]
    });

    callback && callback();
  },
};

var commands = 'writeFile readFile listFiles removeFile clearFiles lazyFiles preloadFiles options compile compileFile';
commands.split(' ').forEach(function(command) {
  Sass.prototype[command] = function() {
    var callback = slice.call(arguments, -1)[0];
    var args = slice.call(arguments, 0, -1);
    if (typeof callback !== 'function') {
      args.push(callback);
      callback = noop;
    }

    this._dispatch({
      command: command,
      args: args
    }, callback);
  };
});

// automatically set the workerUrl in case we're loaded by a simple
// <script src="path/to/sass.js"></script>
// see https://github.com/medialize/sass.js/pull/32#issuecomment-103142214
Sass.setWorkerUrl(SASSJS_RELATIVE_PATH + '/sass.worker.js');
return Sass;
}));;

			var scripts = document.getElementsByTagName("script"),
				src = scripts[scripts.length-1].src;
			Sass.setWorkerUrl(src.replace(/\.link\./, '.link.worker.'));
		;
/* heavily copied from less.js */

(function () {

	'use strict';

	if (typeof window.scss == 'undefined') window.scss = { env: 'development' };

	// ******************************************************************************************
	// start copied stuff from less.js
	// ******************************************************************************************

	var isFileProtocol = /^(file|chrome(-extension)?|resource|qrc|app):/.test(location.protocol);

	var logLevel = {
		info: 2,
		errors: 1,
		none: 0
	};

	// The amount of logging in the javascript console.
	// 2 - Information and errors
	// 1 - Errors
	// 0 - None
	// Defaults to 2
	scss.logLevel = typeof (scss.logLevel) != 'undefined' ? scss.logLevel : logLevel.info;

	// Load styles asynchronously (default: false)
	//
	// This is set to `false` by default, so that the body
	// doesn't start loading before the stylesheets are parsed.
	// Setting this to `true` can result in flickering.
	//
	scss.async = scss.async || false;
	scss.fileAsync = scss.fileAsync || false;

	// Interval between watch polls
	scss.poll = scss.poll || (isFileProtocol ? 1000 : 1500);

	var cache = null;
	var fileCache = {};

	function log(str, level) {
		if (scss.env == 'development' && typeof (console) !== 'undefined' && scss.logLevel >= level) {
			console.log('scss: ' + str);
		}
	}

	function extractId(href) {
		return href.replace(/^[a-z-]+:\/+?[^\/]+/, '')  // Remove protocol & domain
			.replace(/^\//, '')  // Remove root /
			.replace(/\.[a-zA-Z]+$/, '')  // Remove simple extension
			.replace(/[^\.\w-]+/g, '-')  // Replace illegal characters
			.replace(/\./g, ':'); // Replace dots with colons(for valid id)
	}

	function getXMLHttpRequest() {
		if (window.XMLHttpRequest) {
			return new XMLHttpRequest();
		} else {
			try {
				/*global ActiveXObject */
				return new ActiveXObject("MSXML2.XMLHTTP.3.0");
			} catch (e) {
				log("browser doesn't support AJAX.", logLevel.errors);
				return null;
			}
		}
	}

	function doXHR(url, type, callback, errback) {
		var xhr = getXMLHttpRequest();
		var async = isFileProtocol ? scss.fileAsync : scss.async;

		if (typeof (xhr.overrideMimeType) === 'function') {
			xhr.overrideMimeType('text/css');
		}
		log("XHR: Getting '" + url + "'", logLevel.info);
		xhr.open('GET', url, async);
		xhr.setRequestHeader('Accept', type || 'text/x-scss, text/css; q=0.9, */*; q=0.5');
		xhr.send(null);

		function handleResponse(xhr, callback, errback) {
			if (xhr.status >= 200 && xhr.status < 300) {
				callback(xhr.responseText,
					xhr.getResponseHeader("Last-Modified"));
			} else if (typeof (errback) === 'function') {
				errback(xhr.status, url);
			}
		}

		if (isFileProtocol && !scss.fileAsync) {
			if (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) {
				callback(xhr.responseText);
			} else {
				errback(xhr.status, url);
			}
		} else if (async) {
			xhr.onreadystatechange = function () {
				if (xhr.readyState == 4) {
					handleResponse(xhr, callback, errback);
				}
			};
		} else {
			handleResponse(xhr, callback, errback);
		}
	}

	function extractUrlParts(url, baseUrl) {
		// urlParts[1] = protocol&hostname || /
		// urlParts[2] = / if path relative to host base
		// urlParts[3] = directories
		// urlParts[4] = filename
		// urlParts[5] = parameters

		var urlPartsRegex = /^((?:[a-z-]+:)?\/+?(?:[^\/\?#]*\/)|([\/\\]))?((?:[^\/\\\?#]*[\/\\])*)([^\/\\\?#]*)([#\?].*)?$/i,
			urlParts = url.match(urlPartsRegex),
			returner = {}, directories = [], i, baseUrlParts;

		if (!urlParts) {
			throw new Error("Could not parse sheet href - '" + url + "'");
		}

		// Stylesheets in IE don't always return the full path
		if (!urlParts[1] || urlParts[2]) {
			baseUrlParts = baseUrl.match(urlPartsRegex);
			if (!baseUrlParts) {
				throw new Error("Could not parse page url - '" + baseUrl + "'");
			}
			urlParts[1] = urlParts[1] || baseUrlParts[1] || "";
			if (!urlParts[2]) {
				urlParts[3] = baseUrlParts[3] + urlParts[3];
			}
		}

		if (urlParts[3]) {
			directories = urlParts[3].replace(/\\/g, "/").split("/");

			// extract out . before .. so .. doesn't absorb a non-directory
			for (i = 0; i < directories.length; i++) {
				if (directories[i] === ".") {
					directories.splice(i, 1);
					i -= 1;
				}
			}

			for (i = 0; i < directories.length; i++) {
				if (directories[i] === ".." && i > 0) {
					directories.splice(i - 1, 2);
					i -= 2;
				}
			}
		}

		returner.hostPart = urlParts[1];
		returner.directories = directories;
		returner.path = urlParts[1] + directories.join("/");
		returner.fileUrl = returner.path + (urlParts[4] || "");
		returner.url = returner.fileUrl + (urlParts[5] || "");
		return returner;
	}

	function loadFile(originalHref, currentFileInfo, callback, env, modifyVars) {

		if (currentFileInfo && currentFileInfo.currentDirectory && !/^([a-z-]+:)?\//.test(originalHref)) {
			originalHref = currentFileInfo.currentDirectory + originalHref;
		}

		// sheet may be set to the stylesheet for the initial load or a collection of properties including
		// some env variables for imports
		var hrefParts = extractUrlParts(originalHref, window.location.href);
		var href = hrefParts.url;
		var newFileInfo = {
			currentDirectory: hrefParts.path,
			filename: href
		};

		if (currentFileInfo) {
			newFileInfo.entryPath = currentFileInfo.entryPath;
			newFileInfo.rootpath = currentFileInfo.rootpath;
			newFileInfo.rootFilename = currentFileInfo.rootFilename;
			newFileInfo.relativeUrls = currentFileInfo.relativeUrls;
		} else {
			newFileInfo.entryPath = hrefParts.path;
			newFileInfo.rootpath = scss.rootpath || hrefParts.path;
			newFileInfo.rootFilename = href;
			newFileInfo.relativeUrls = env.relativeUrls;
		}

		if (newFileInfo.relativeUrls) {
			if (env.rootpath) {
				newFileInfo.rootpath = extractUrlParts(env.rootpath + pathDiff(hrefParts.path, newFileInfo.entryPath)).path;
			} else {
				newFileInfo.rootpath = hrefParts.path;
			}
		}

		if (env.useFileCache && fileCache[href]) {
			try {
				var scssText = fileCache[href];
				callback(null, scssText, href, newFileInfo, { lastModified: new Date() });
			} catch (e) {
				callback(e, null, href);
			}
			return;
		}

		doXHR(href, env.mime, function (data, lastModified) {
			// per file cache
			fileCache[href] = data;

			// Use remote copy (re-parse)
			try {
				callback(null, data, href, newFileInfo, { lastModified: lastModified });
			} catch (e) {
				callback(e, null, href);
			}
		}, function (status, url) {
			callback({ type: 'File', message: "'" + url + "' wasn't found (" + status + ")" }, null, href);
		});
	}

	function createCSS(styles, sheet, lastModified) {

		// Strip the query-string
		var href = sheet.href || '';

		// If there is no title set, use the filename, minus the extension
		var id = 'scss:' + (sheet.title || extractId(href));

		// If this has already been inserted into the DOM, we may need to replace it
		var oldCss = document.getElementById(id);
		var keepOldCss = false;

		// Create a new stylesheet node for insertion or (if necessary) replacement
		var css = document.createElement('style');
		css.setAttribute('type', 'text/css');
		if (sheet.media) {
			css.setAttribute('media', sheet.media);
		}
		css.id = id;

		if (css.styleSheet) { // IE
			try {
				css.styleSheet.cssText = styles;
			} catch (e) {
				throw new (Error)("Couldn't reassign styleSheet.cssText.");
			}
		} else {
			css.appendChild(document.createTextNode(styles));

			// If new contents match contents of oldCss, don't replace oldCss
			keepOldCss = (oldCss !== null && oldCss.childNodes.length > 0 && css.childNodes.length > 0 &&
				oldCss.firstChild.nodeValue === css.firstChild.nodeValue);
		}

		var head = document.getElementsByTagName('head')[0];

		// If there is no oldCss, just append; otherwise, only append if we need
		// to replace oldCss with an updated stylesheet
		if (oldCss === null || keepOldCss === false) {
			var nextEl = sheet && sheet.nextSibling || null;
			if (nextEl) {
				nextEl.parentNode.insertBefore(css, nextEl);
			} else {
				head.appendChild(css);
			}
		}
		if (oldCss && keepOldCss === false) {
			oldCss.parentNode.removeChild(oldCss);
		}

		// Don't update the local store if the file wasn't modified
		if (lastModified && cache) {
			log('saving ' + href + ' to cache.', logLevel.info);
			try {
				cache.setItem(href, styles);
				cache.setItem(href + ':timestamp', lastModified);
			} catch (e) {
				//TODO - could do with adding more robust error handling
				log('failed to save', logLevel.errors);
			}
		}
	}

	// ******************************************************************************************
	// end copied stuff from less.js
	// ******************************************************************************************

	var env = {};

	var sheets = [];
	var inlines = [];

	var typePattern = /^text\/(x-)?scss$/;

	var re_url = /url\(\s*(?:\"(?!data:)((?:[^\"\\]+|\\.)*)\"|\'(?!data:)((?:[^\'\\]+|\\.)*)\'|(?![\"\'])\s*(?!data:)([^\)]*))\s*\)/gi;

	var links = document.getElementsByTagName('link');
	var styles = document.getElementsByTagName('style');

	for (var i = 0; i < links.length; i++) {
		if (links[i].type.match(typePattern)) {
			sheets.push(links[i]);
		}
	}

	for (var i = 0; i < styles.length; i++) {
		if (styles[i].type.match(typePattern)) {
			inlines.push(styles[i]);
		}
	}

	var sass = new Sass();

	function compileSass(sheet, e, data, path, fileInfo, webInfo, env, modifyVars) {

		if (e) {
			log(e, logLevel.errors);
		}
		else if (data) {

			// Resolution order for ambiguous imports:
			// (1) filename as given
			// (2) underscore + given
			// (3) underscore + given + extension
			// (4) given + extension

			sass.importer(function (request, done) {

				if (request.path === null) {

					var dir = fileInfo.currentDirectory;
					var base = dir.replace(/[\/\\]+$/, '') + '/';

					var files = [
						request.current,
						'_' + request.current,
						'_' + request.current + '.scss',
						'_' + request.current + '.sass',
						'_' + request.current + '.css',
						request.current + '.scss',
						request.current + '.sass',
						request.current + '.css'
					];

					function attemptDownload(attempt) {

						return new Promise(function (resolve, reject) {

							var file = files[attempt];
							var url = base + files[attempt];

							loadFile(url, null, function (e, data, path, fileInfo, webInfo) {

								if (data != null) {
									sass.writeFile(file, data, function () {
										resolve({ path: file });
									})
								} else {
									reject();
								}

							}, env, modifyVars);

						})

					}

					var attempt = 0;

					function tryDownload(attempt) {

						attemptDownload(attempt)
							.then(function (result) {
								done(result);
							}, function () {
								if (attempt < files.length) {
									tryDownload(++attempt)
								} else {
									done();
								}
							})

					}

					tryDownload(attempt);

				} else {
					done();
				}

			})

			return new Promise(function (resolve, reject) {

				// compile data from response
				sass.compile(data, function (result, options) {

					if (typeof result == 'object') {
						if (result.status === 0) {
							// rewrite all urls (that are not inline data urls)
							var css = result.text.replace(re_url, function (match, quot, apo, str) {

								// get from capture groups
								var url = quot || apo || str;

								// relative url
								if (!url.match(/^\//)) {
									// currentDirectory must have traling slash
									url = fileInfo.currentDirectory + url;
								}

								// recreate the url as before
								if (quot) return 'url("' + url + '")';
								if (apo) return "url('" + url + "')";
								return 'url(' + url + ')';

							}, 'gm');

							// create or replace with new css
							createCSS(css, sheet, env.lastModified);
							resolve(); // resolve promise
						} else {
							// print a debug message for the developer
							log("error compiling css for " + sheet.href, logLevel.errors);
							log(result.message + (result.line ? ' @ ' + result.line : ''), logLevel.errors);
							reject(); // reject promise
						}
					}

				});

			})

		}

	}

	var startTime = new Date();
	var promisesInlines = [];
	var promisesLinks = [];

	var hrefParts = extractUrlParts(document.location.href);
	var href = hrefParts.url;
	var fileInfo = {
		currentDirectory: hrefParts.path,
		filename: href
	};

	for (var i = 0, l = inlines.length; i < l; i++) {
		inlines[i].title = 'inline:' + i;
		inlines[i].href = document.location.href;
		var data = inlines[i].innerHTML;
		var base = inlines[i].getAttribute('base');
		if (base) fileInfo.currentDirectory += base.replace(/\/+$/, '') + '/';
		promisesInlines.push(compileSass(inlines[i], null, data, null, fileInfo, {}, env, modifyVars))
	}

	for (var i = 0; i < sheets.length; i++) {

		var modifyVars = {};

		(function (sheet) {

			loadFile(sheet.href, null, function (e, data, path, newFileInfo, webInfo) {

				promisesLinks.push(compileSass(sheet, e, data, path, newFileInfo, webInfo, env, modifyVars));

			}, env, modifyVars);

		})(sheets[i]);

		// endTime = new Date();

	}

	if (promisesInlines.length) {
		Promise.all(promisesInlines)
			.then(function () {
				log("css for all links generated in " + (new Date() - startTime) + 'ms', logLevel.info);
			})
	}

	if (promisesLinks.length) {
		Promise.all(promisesLinks)
			.then(function () {
				log("css for all links generated in " + (new Date() - startTime) + 'ms', logLevel.info);
			})
	}

})();