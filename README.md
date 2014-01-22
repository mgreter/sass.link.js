sass.link.js
============

Link SCSS stylesheets directly in your browser (compiled via [lib]sass.js)

Basically a mashup of less.js and sass.js. The part to replace all referenced
scss stylesheets within a page has been taken from less.js. The actual compilation
is done via sass.js.


Imports within scss
===================

I had to patch the sass.js library to have a hook to load
requested files by synchronous XHR. This is expensive,
as libsass tries to stat all possible names and does
not seem to abort the loop when one candidate is found.


Demo
====

- http://ocbnet.ch/sass.link.js/example/


Credits
=======

- https://github.com/less/less.js
- https://github.com/medialize/sass.js
- https://github.com/hcatlin/libsass