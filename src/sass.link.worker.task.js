// dynamic loader
(function()
{

	Sass['_path'] = '';

	var newFileInfo;
	var locationHref;
	var lookedUp = {};
	var startTime, endTime;
	startTime = endTime = new Date();

	var isFileProtocol = /^(file|chrome(-extension)?|resource|qrc|app):/.test(location.protocol);

	var scss = { env: 'development' };

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
	    if (typeof XMLHttpRequest != 'undefined') {
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
	        // xhr.overrideMimeType('text/css');
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
	    var hrefParts = extractUrlParts(originalHref, locationHref);
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

	// hook into Sass module
	Sass._module['stat'] = function (newPath)
	{

		try
		{

			var modifyVars = {};

			// do not fetch directories
			if (newPath.match(/\/$/)) return;
			// only lookup each path once
			if (lookedUp[newPath]) return;
			lookedUp[newPath] = true;

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
					scss.env, modifyVars
				);
			}
			// happens for local 404
			catch (e)
			{
			  postMessage({
			    error: [ e.toString() ]
			  });
			}
		}
		catch (e)
		{
		  postMessage({
		    error: [ e.toString() ]
		  });

		}

	}

	onmessage = function (event) {
	  var result;
	  var startTime = new Date();
	  switch (event.data.command) {
	    case 'compile':
	      newFileInfo = event.data.options.newFileInfo;
	      locationHref = event.data.options.locationHref;
	      result = Sass.compile(event.data.text, null, event.data.options);
	      break;
	    case 'options':
	      result = Sass.options(event.data.options);
	      break;
	    case 'writeFile':
	      result = Sass.writeFile(event.data.filename, event.data.text);
	      break;
	    case 'readFile':
	      result = Sass.readFile(event.data.filename);
	      break;
	    case 'listFiles':
	      result = Sass.listFiles();
	      break;
	    case 'removeFile':
	      result = Sass.removeFile(event.data.filename);
	      break;
	    default:
	      result = {line: 0, message: 'Unknown command ' + event.action};
	      break;
	  }

	  postMessage({
	    id: event.data.id,
	    startTime: startTime,
	    endTime: new Date(),
	    result: result
	  });
	};

})();