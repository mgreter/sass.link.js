/* heavily copied from less.js */

(function()
{

	'use strict';

	if (typeof window.scss == 'undefined') window.scss = { env: 'development' };

	Sass['_path'] = '';

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
	scss.logLevel = typeof(scss.logLevel) != 'undefined' ? scss.logLevel : logLevel.info;

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
	    if (scss.env == 'development' && typeof(console) !== 'undefined' && scss.logLevel >= level) {
	        console.log('scss: ' + str);
	    }
	}

	function extractId(href) {
	    return href.replace(/^[a-z-]+:\/+?[^\/]+/, '' )  // Remove protocol & domain
	        .replace(/^\//,                 '' )  // Remove root /
	        .replace(/\.[a-zA-Z]+$/,        '' )  // Remove simple extension
	        .replace(/[^\.\w-]+/g,          '-')  // Replace illegal characters
	        .replace(/\./g,                 ':'); // Replace dots with colons(for valid id)
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

	    if (typeof(xhr.overrideMimeType) === 'function') {
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
	        } else if (typeof(errback) === 'function') {
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
	        throw new Error("Could not parse sheet href - '"+url+"'");
	    }

	    // Stylesheets in IE don't always return the full path
	    if (!urlParts[1] || urlParts[2]) {
	        baseUrlParts = baseUrl.match(urlPartsRegex);
	        if (!baseUrlParts) {
	            throw new Error("Could not parse page url - '"+baseUrl+"'");
	        }
	        urlParts[1] = urlParts[1] || baseUrlParts[1] || "";
	        if (!urlParts[2]) {
	            urlParts[3] = baseUrlParts[3] + urlParts[3];
	        }
	    }

	    if (urlParts[3]) {
	        directories = urlParts[3].replace(/\\/g, "/").split("/");

	        // extract out . before .. so .. doesn't absorb a non-directory
	        for(i = 0; i < directories.length; i++) {
	            if (directories[i] === ".") {
	                directories.splice(i, 1);
	                i -= 1;
	            }
	        }

	        for(i = 0; i < directories.length; i++) {
	            if (directories[i] === ".." && i > 0) {
	                directories.splice(i-1, 2);
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
	    var href      = hrefParts.url;
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
	            throw new(Error)("Couldn't reassign styleSheet.cssText.");
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
	        } catch(e) {
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

	for (var i = 0; i < links.length; i++)
	{
		if ( links[i].type.match(typePattern) )
		{
			sheets.push(links[i]);
		}
	}

	for (var i = 0; i < styles.length; i++)
	{
		if ( styles[i].type.match(typePattern) )
		{
			inlines.push(styles[i]);
		}
	}

	function fileLoaded(sheet, e, data, path, newFileInfo, webInfo)
	{

		if (e)
		{
			log(e, logLevel.errors);
		}
		else if (data)
		{

			// plug into FS stat function
			if (typeof Sass._module != 'undefined')
			Sass._module['stat'] = function (newPath, opt)
			{

				// do not fetch directories
				if (newPath.match(/\/$/)) return;
				// only lookup each path once
				if (Sass._fs.findObject(newPath)) return;

				var dir = newFileInfo.currentDirectory;
				var url = dir.replace(/[\/\\]+$/, '') + '/';
				url += newPath.replace(/^[\/\\]+/, '');

				try
				{
					loadFile(
						url, newFileInfo,
						function (e, data, fullPath, nfi, wi)
						{
							if (!e && data)
							{
								// create the file path
								var paths = newPath.split('/');
								paths.pop(); Sass._createPath(paths);
								// write to the virtual fs
								Sass.writeFile(newPath, data);
							}
						},
						env, modifyVars
					);
				}
				// happens for local 404
				catch (e) {}
			}

			// declare the options
			var startTime = new Date();

			// compile data from response
			Sass.compile(data, function (result, options)
			{

				if (!options) options = {};
				if (!options.endTime) options.endTime = new Date();
				if (!options.startTime) options.startTime = startTime;

				if (typeof result == 'object')
				{
					// print a debug message for the developer
					log("error compiling css for " + sheet.href, logLevel.errors);
					log(result.message + (result.line ? ' @ ' + result.line : '') , logLevel.errors);
				}
				else
				{

					// rewrite all urls (that are not inline data urls)
					result = result.replace(re_url, function (match, quot, apo, str)
					{

						// get from capture groups
						var url = quot || apo || str;

						// relative url
						if (!url.match(/^\//))
						{
							// currentDirectory must have traling slash
							url = newFileInfo.currentDirectory + url;
						}

						// recreate the url as before
						if (quot) return 'url("' + url + '")';
						if (apo) return "url('" + url + "')";
						return 'url(' + url + ')';

					}, 'gm');

					// cerate or replace with new css
					createCSS(result, sheet, env.lastModified);
					// print a debug message for the developer
					log("css for " + sheet.href + " generated in " + (options.endTime - options.startTime) + 'ms', logLevel.info);

				}

			},
			{
				newFileInfo: newFileInfo
			});

		}

	}

	var startTime = new Date();

	var hrefParts = extractUrlParts(document.location.href);
	var href      = hrefParts.url;
	var fileInfo = {
	    currentDirectory: hrefParts.path,
	    filename: href
	};

	for (var i = 0, l = inlines.length; i < l; i++)
	{
		inlines[i].title = 'inline:' + i;
		inlines[i].href = document.location.href;
		var data = inlines[i].innerHTML;
		var base = inlines[i].getAttribute('base');
		if (base) fileInfo.currentDirectory += base.replace(/\/+$/, '') + '/';
		fileLoaded(inlines[i], null, data, null, fileInfo, {})
	}

	for (var i = 0; i < sheets.length; i++)
	{

		var modifyVars = {};

		(function (sheet)
		{

		loadFile(sheet.href, null, function (e, data, path, newFileInfo, webInfo)
		{

				fileLoaded(sheet, e, data, path, newFileInfo, webInfo)

		}, env, modifyVars);

		})(sheets[i]);

		// endTime = new Date();

	}

	log("css for all links generated in " + (new Date() - startTime) + 'ms', logLevel.info);

})();