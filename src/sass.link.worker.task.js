// dynamic loader
(function()
{

	Sass['_path'] = '';

	var newFileInfo;
	var startTime = new Date();
	var lookupCache = {};

	// hook into Sass module
	Sass._module['loader'] = function (newPath)
	{
		// only lookup once
		if (lookupCache[newPath]) return;
		lookupCache[newPath] = true;
		// do not fetch directories
		if (newPath.match(/\/$/)) return;
		// only lookup each path once
		if (Sass._fs.findObject(newPath)) return;
		// currentDirectory must have traling slash
		var url = newFileInfo.currentDirectory + newPath;
		url = url.replace(/(?:(^.*?:\/)\/+|\/+)/g, '\$1/');
		var parts = newPath.split('/'), name = parts.pop();
		Sass._fs.createLazyFile('/', name, url, true, true);
	}

	onmessage = function (event) {
	  var result;
	  var startTime = new Date();
	  switch (event.data.command) {
	    case 'compile':
	      newFileInfo = event.data.options.newFileInfo;
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