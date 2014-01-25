sass.link.js
============

Link SCSS stylesheets directly in your browser (compiled via [lib]sass.js)

    <link href="example.scss" type="text/scss" />
    <style type="text/scss" base="assets/scss">
        @import "style.scss";
    </style>
    <script src="../dist/sass.link.min.js"></script>

It is basically a mashup of less.js and sass.js. The part to replace all referenced
scss stylesheets inside a page has been taken from less.js. The actual compilation
is done via sass.js (which is libsass to js via emscripten). Pretty amazing!


Imports within scss
===================

I had to patch the sass.js library to have a hook to load requested files by synchronous
XHR. This is expensive, as libsass tries to stat all possible names. There also seems
to be a problem when an import path is set (which is preset to /sass/). I saw way
too many stat calls so I reset the path to nothing in this implementation.


Compatibility
=============

Tested with the latest versions of Firefox, Chrome, Opera and Internet Explorer. IE 9
and below will not work as it is not possible to compile libsass via emscripten that
will still be runnable in IE 9 and below. It will currently error out with this message:
"Assertion failed: Cannot fallback to non-typed array case: Code is too specialized".


Demo
====

- http://ocbnet.ch/sass.link.js/example/index.html
- http://ocbnet.ch/sass.link.js/example/demo.html
- http://ocbnet.ch/sass.link.js/example/worker.html


Credits
=======

- https://github.com/less/less.js
- https://github.com/medialize/sass.js
- https://github.com/hcatlin/libsass
- https://github.com/kripken/emscripten