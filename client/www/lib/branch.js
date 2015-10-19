(function() {// Input 0
var COMPILED = !0, goog = goog || {};
goog.global = this;
goog.isDef = function(a) {
  return void 0 !== a;
};
goog.exportPath_ = function(a, b, c) {
  a = a.split(".");
  c = c || goog.global;
  a[0] in c || !c.execScript || c.execScript("var " + a[0]);
  for (var d;a.length && (d = a.shift());) {
    !a.length && goog.isDef(b) ? c[d] = b : c = c[d] ? c[d] : c[d] = {};
  }
};
goog.define = function(a, b) {
  var c = b;
  COMPILED || (goog.global.CLOSURE_UNCOMPILED_DEFINES && Object.prototype.hasOwnProperty.call(goog.global.CLOSURE_UNCOMPILED_DEFINES, a) ? c = goog.global.CLOSURE_UNCOMPILED_DEFINES[a] : goog.global.CLOSURE_DEFINES && Object.prototype.hasOwnProperty.call(goog.global.CLOSURE_DEFINES, a) && (c = goog.global.CLOSURE_DEFINES[a]));
  goog.exportPath_(a, c);
};
goog.DEBUG = !0;
goog.LOCALE = "en";
goog.TRUSTED_SITE = !0;
goog.STRICT_MODE_COMPATIBLE = !1;
goog.DISALLOW_TEST_ONLY_CODE = COMPILED && !goog.DEBUG;
goog.ENABLE_CHROME_APP_SAFE_SCRIPT_LOADING = !1;
goog.provide = function(a) {
  if (!COMPILED && goog.isProvided_(a)) {
    throw Error('Namespace "' + a + '" already declared.');
  }
  goog.constructNamespace_(a);
};
goog.constructNamespace_ = function(a, b) {
  if (!COMPILED) {
    delete goog.implicitNamespaces_[a];
    for (var c = a;(c = c.substring(0, c.lastIndexOf("."))) && !goog.getObjectByName(c);) {
      goog.implicitNamespaces_[c] = !0;
    }
  }
  goog.exportPath_(a, b);
};
goog.VALID_MODULE_RE_ = /^[a-zA-Z_$][a-zA-Z0-9._$]*$/;
goog.module = function(a) {
  if (!goog.isString(a) || !a || -1 == a.search(goog.VALID_MODULE_RE_)) {
    throw Error("Invalid module identifier");
  }
  if (!goog.isInModuleLoader_()) {
    throw Error("Module " + a + " has been loaded incorrectly.");
  }
  if (goog.moduleLoaderState_.moduleName) {
    throw Error("goog.module may only be called once per module.");
  }
  goog.moduleLoaderState_.moduleName = a;
  if (!COMPILED) {
    if (goog.isProvided_(a)) {
      throw Error('Namespace "' + a + '" already declared.');
    }
    delete goog.implicitNamespaces_[a];
  }
};
goog.module.get = function(a) {
  return goog.module.getInternal_(a);
};
goog.module.getInternal_ = function(a) {
  if (!COMPILED) {
    return goog.isProvided_(a) ? a in goog.loadedModules_ ? goog.loadedModules_[a] : goog.getObjectByName(a) : null;
  }
};
goog.moduleLoaderState_ = null;
goog.isInModuleLoader_ = function() {
  return null != goog.moduleLoaderState_;
};
goog.module.declareLegacyNamespace = function() {
  if (!COMPILED && !goog.isInModuleLoader_()) {
    throw Error("goog.module.declareLegacyNamespace must be called from within a goog.module");
  }
  if (!COMPILED && !goog.moduleLoaderState_.moduleName) {
    throw Error("goog.module must be called prior to goog.module.declareLegacyNamespace.");
  }
  goog.moduleLoaderState_.declareLegacyNamespace = !0;
};
goog.setTestOnly = function(a) {
  if (goog.DISALLOW_TEST_ONLY_CODE) {
    throw a = a || "", Error("Importing test-only code into non-debug environment" + (a ? ": " + a : "."));
  }
};
goog.forwardDeclare = function(a) {
};
COMPILED || (goog.isProvided_ = function(a) {
  return a in goog.loadedModules_ || !goog.implicitNamespaces_[a] && goog.isDefAndNotNull(goog.getObjectByName(a));
}, goog.implicitNamespaces_ = {"goog.module":!0});
goog.getObjectByName = function(a, b) {
  for (var c = a.split("."), d = b || goog.global, e;e = c.shift();) {
    if (goog.isDefAndNotNull(d[e])) {
      d = d[e];
    } else {
      return null;
    }
  }
  return d;
};
goog.globalize = function(a, b) {
  var c = b || goog.global, d;
  for (d in a) {
    c[d] = a[d];
  }
};
goog.addDependency = function(a, b, c, d) {
  if (goog.DEPENDENCIES_ENABLED) {
    var e;
    a = a.replace(/\\/g, "/");
    for (var f = goog.dependencies_, g = 0;e = b[g];g++) {
      f.nameToPath[e] = a, f.pathIsModule[a] = !!d;
    }
    for (d = 0;b = c[d];d++) {
      a in f.requires || (f.requires[a] = {}), f.requires[a][b] = !0;
    }
  }
};
goog.ENABLE_DEBUG_LOADER = !0;
goog.logToConsole_ = function(a) {
  goog.global.console && goog.global.console.error(a);
};
goog.require = function(a) {
  if (!COMPILED) {
    goog.ENABLE_DEBUG_LOADER && goog.IS_OLD_IE_ && goog.maybeProcessDeferredDep_(a);
    if (goog.isProvided_(a)) {
      return goog.isInModuleLoader_() ? goog.module.getInternal_(a) : null;
    }
    if (goog.ENABLE_DEBUG_LOADER) {
      var b = goog.getPathFromDeps_(a);
      if (b) {
        return goog.writeScripts_(b), null;
      }
    }
    a = "goog.require could not find: " + a;
    goog.logToConsole_(a);
    throw Error(a);
  }
};
goog.basePath = "";
goog.nullFunction = function() {
};
goog.abstractMethod = function() {
  throw Error("unimplemented abstract method");
};
goog.addSingletonGetter = function(a) {
  a.getInstance = function() {
    if (a.instance_) {
      return a.instance_;
    }
    goog.DEBUG && (goog.instantiatedSingletons_[goog.instantiatedSingletons_.length] = a);
    return a.instance_ = new a;
  };
};
goog.instantiatedSingletons_ = [];
goog.LOAD_MODULE_USING_EVAL = !0;
goog.SEAL_MODULE_EXPORTS = goog.DEBUG;
goog.loadedModules_ = {};
goog.DEPENDENCIES_ENABLED = !COMPILED && goog.ENABLE_DEBUG_LOADER;
goog.DEPENDENCIES_ENABLED && (goog.dependencies_ = {pathIsModule:{}, nameToPath:{}, requires:{}, visited:{}, written:{}, deferred:{}}, goog.inHtmlDocument_ = function() {
  var a = goog.global.document;
  return "undefined" != typeof a && "write" in a;
}, goog.findBasePath_ = function() {
  if (goog.isDef(goog.global.CLOSURE_BASE_PATH)) {
    goog.basePath = goog.global.CLOSURE_BASE_PATH;
  } else {
    if (goog.inHtmlDocument_()) {
      for (var a = goog.global.document.getElementsByTagName("SCRIPT"), b = a.length - 1;0 <= b;--b) {
        var c = a[b].src, d = c.lastIndexOf("?"), d = -1 == d ? c.length : d;
        if ("base.js" == c.substr(d - 7, 7)) {
          goog.basePath = c.substr(0, d - 7);
          break;
        }
      }
    }
  }
}, goog.importScript_ = function(a, b) {
  (goog.global.CLOSURE_IMPORT_SCRIPT || goog.writeScriptTag_)(a, b) && (goog.dependencies_.written[a] = !0);
}, goog.IS_OLD_IE_ = !(goog.global.atob || !goog.global.document || !goog.global.document.all), goog.importModule_ = function(a) {
  goog.importScript_("", 'goog.retrieveAndExecModule_("' + a + '");') && (goog.dependencies_.written[a] = !0);
}, goog.queuedModules_ = [], goog.wrapModule_ = function(a, b) {
  return goog.LOAD_MODULE_USING_EVAL && goog.isDef(goog.global.JSON) ? "goog.loadModule(" + goog.global.JSON.stringify(b + "\n//# sourceURL=" + a + "\n") + ");" : 'goog.loadModule(function(exports) {"use strict";' + b + "\n;return exports});\n//# sourceURL=" + a + "\n";
}, goog.loadQueuedModules_ = function() {
  var a = goog.queuedModules_.length;
  if (0 < a) {
    var b = goog.queuedModules_;
    goog.queuedModules_ = [];
    for (var c = 0;c < a;c++) {
      goog.maybeProcessDeferredPath_(b[c]);
    }
  }
}, goog.maybeProcessDeferredDep_ = function(a) {
  goog.isDeferredModule_(a) && goog.allDepsAreAvailable_(a) && (a = goog.getPathFromDeps_(a), goog.maybeProcessDeferredPath_(goog.basePath + a));
}, goog.isDeferredModule_ = function(a) {
  return (a = goog.getPathFromDeps_(a)) && goog.dependencies_.pathIsModule[a] ? goog.basePath + a in goog.dependencies_.deferred : !1;
}, goog.allDepsAreAvailable_ = function(a) {
  if ((a = goog.getPathFromDeps_(a)) && a in goog.dependencies_.requires) {
    for (var b in goog.dependencies_.requires[a]) {
      if (!goog.isProvided_(b) && !goog.isDeferredModule_(b)) {
        return !1;
      }
    }
  }
  return !0;
}, goog.maybeProcessDeferredPath_ = function(a) {
  if (a in goog.dependencies_.deferred) {
    var b = goog.dependencies_.deferred[a];
    delete goog.dependencies_.deferred[a];
    goog.globalEval(b);
  }
}, goog.loadModule = function(a) {
  var b = goog.moduleLoaderState_;
  try {
    goog.moduleLoaderState_ = {moduleName:void 0};
    var c;
    if (goog.isFunction(a)) {
      c = a.call(goog.global, {});
    } else {
      if (goog.isString(a)) {
        c = goog.loadModuleFromSource_.call(goog.global, a);
      } else {
        throw Error("Invalid module definition");
      }
    }
    var d = goog.moduleLoaderState_.moduleName;
    if (!goog.isString(d) || !d) {
      throw Error('Invalid module name "' + d + '"');
    }
    goog.moduleLoaderState_.declareLegacyNamespace ? goog.constructNamespace_(d, c) : goog.SEAL_MODULE_EXPORTS && Object.seal && Object.seal(c);
    goog.loadedModules_[d] = c;
  } finally {
    goog.moduleLoaderState_ = b;
  }
}, goog.loadModuleFromSource_ = function(a) {
  eval(a);
  return {};
}, goog.writeScriptSrcNode_ = function(a) {
  goog.global.document.write('<script type="text/javascript" src="' + a + '">\x3c/script>');
}, goog.appendScriptSrcNode_ = function(a) {
  var b = goog.global.document, c = b.createElement("script");
  c.type = "text/javascript";
  c.src = a;
  c.defer = !1;
  c.async = !1;
  b.head.appendChild(c);
}, goog.writeScriptTag_ = function(a, b) {
  if (goog.inHtmlDocument_()) {
    var c = goog.global.document;
    if (!goog.ENABLE_CHROME_APP_SAFE_SCRIPT_LOADING && "complete" == c.readyState) {
      if (/\bdeps.js$/.test(a)) {
        return !1;
      }
      throw Error('Cannot write "' + a + '" after document load');
    }
    var d = goog.IS_OLD_IE_;
    void 0 === b ? d ? (d = " onreadystatechange='goog.onScriptLoad_(this, " + ++goog.lastNonModuleScriptIndex_ + ")' ", c.write('<script type="text/javascript" src="' + a + '"' + d + ">\x3c/script>")) : goog.ENABLE_CHROME_APP_SAFE_SCRIPT_LOADING ? goog.appendScriptSrcNode_(a) : goog.writeScriptSrcNode_(a) : c.write('<script type="text/javascript">' + b + "\x3c/script>");
    return !0;
  }
  return !1;
}, goog.lastNonModuleScriptIndex_ = 0, goog.onScriptLoad_ = function(a, b) {
  "complete" == a.readyState && goog.lastNonModuleScriptIndex_ == b && goog.loadQueuedModules_();
  return !0;
}, goog.writeScripts_ = function(a) {
  function b(a) {
    if (!(a in e.written || a in e.visited)) {
      e.visited[a] = !0;
      if (a in e.requires) {
        for (var f in e.requires[a]) {
          if (!goog.isProvided_(f)) {
            if (f in e.nameToPath) {
              b(e.nameToPath[f]);
            } else {
              throw Error("Undefined nameToPath for " + f);
            }
          }
        }
      }
      a in d || (d[a] = !0, c.push(a));
    }
  }
  var c = [], d = {}, e = goog.dependencies_;
  b(a);
  for (a = 0;a < c.length;a++) {
    var f = c[a];
    goog.dependencies_.written[f] = !0;
  }
  var g = goog.moduleLoaderState_;
  goog.moduleLoaderState_ = null;
  for (a = 0;a < c.length;a++) {
    if (f = c[a]) {
      e.pathIsModule[f] ? goog.importModule_(goog.basePath + f) : goog.importScript_(goog.basePath + f);
    } else {
      throw goog.moduleLoaderState_ = g, Error("Undefined script input");
    }
  }
  goog.moduleLoaderState_ = g;
}, goog.getPathFromDeps_ = function(a) {
  return a in goog.dependencies_.nameToPath ? goog.dependencies_.nameToPath[a] : null;
}, goog.findBasePath_(), goog.global.CLOSURE_NO_DEPS || goog.importScript_(goog.basePath + "deps.js"));
goog.normalizePath_ = function(a) {
  a = a.split("/");
  for (var b = 0;b < a.length;) {
    "." == a[b] ? a.splice(b, 1) : b && ".." == a[b] && a[b - 1] && ".." != a[b - 1] ? a.splice(--b, 2) : b++;
  }
  return a.join("/");
};
goog.loadFileSync_ = function(a) {
  if (goog.global.CLOSURE_LOAD_FILE_SYNC) {
    return goog.global.CLOSURE_LOAD_FILE_SYNC(a);
  }
  var b = new goog.global.XMLHttpRequest;
  b.open("get", a, !1);
  b.send();
  return b.responseText;
};
goog.retrieveAndExecModule_ = function(a) {
  if (!COMPILED) {
    var b = a;
    a = goog.normalizePath_(a);
    var c = goog.global.CLOSURE_IMPORT_SCRIPT || goog.writeScriptTag_, d = goog.loadFileSync_(a);
    if (null != d) {
      d = goog.wrapModule_(a, d), goog.IS_OLD_IE_ ? (goog.dependencies_.deferred[b] = d, goog.queuedModules_.push(b)) : c(a, d);
    } else {
      throw Error("load of " + a + "failed");
    }
  }
};
goog.typeOf = function(a) {
  var b = typeof a;
  if ("object" == b) {
    if (a) {
      if (a instanceof Array) {
        return "array";
      }
      if (a instanceof Object) {
        return b;
      }
      var c = Object.prototype.toString.call(a);
      if ("[object Window]" == c) {
        return "object";
      }
      if ("[object Array]" == c || "number" == typeof a.length && "undefined" != typeof a.splice && "undefined" != typeof a.propertyIsEnumerable && !a.propertyIsEnumerable("splice")) {
        return "array";
      }
      if ("[object Function]" == c || "undefined" != typeof a.call && "undefined" != typeof a.propertyIsEnumerable && !a.propertyIsEnumerable("call")) {
        return "function";
      }
    } else {
      return "null";
    }
  } else {
    if ("function" == b && "undefined" == typeof a.call) {
      return "object";
    }
  }
  return b;
};
goog.isNull = function(a) {
  return null === a;
};
goog.isDefAndNotNull = function(a) {
  return null != a;
};
goog.isArray = function(a) {
  return "array" == goog.typeOf(a);
};
goog.isArrayLike = function(a) {
  var b = goog.typeOf(a);
  return "array" == b || "object" == b && "number" == typeof a.length;
};
goog.isDateLike = function(a) {
  return goog.isObject(a) && "function" == typeof a.getFullYear;
};
goog.isString = function(a) {
  return "string" == typeof a;
};
goog.isBoolean = function(a) {
  return "boolean" == typeof a;
};
goog.isNumber = function(a) {
  return "number" == typeof a;
};
goog.isFunction = function(a) {
  return "function" == goog.typeOf(a);
};
goog.isObject = function(a) {
  var b = typeof a;
  return "object" == b && null != a || "function" == b;
};
goog.getUid = function(a) {
  return a[goog.UID_PROPERTY_] || (a[goog.UID_PROPERTY_] = ++goog.uidCounter_);
};
goog.hasUid = function(a) {
  return !!a[goog.UID_PROPERTY_];
};
goog.removeUid = function(a) {
  "removeAttribute" in a && a.removeAttribute(goog.UID_PROPERTY_);
  try {
    delete a[goog.UID_PROPERTY_];
  } catch (b) {
  }
};
goog.UID_PROPERTY_ = "closure_uid_" + (1E9 * Math.random() >>> 0);
goog.uidCounter_ = 0;
goog.getHashCode = goog.getUid;
goog.removeHashCode = goog.removeUid;
goog.cloneObject = function(a) {
  var b = goog.typeOf(a);
  if ("object" == b || "array" == b) {
    if (a.clone) {
      return a.clone();
    }
    var b = "array" == b ? [] : {}, c;
    for (c in a) {
      b[c] = goog.cloneObject(a[c]);
    }
    return b;
  }
  return a;
};
goog.bindNative_ = function(a, b, c) {
  return a.call.apply(a.bind, arguments);
};
goog.bindJs_ = function(a, b, c) {
  if (!a) {
    throw Error();
  }
  if (2 < arguments.length) {
    var d = Array.prototype.slice.call(arguments, 2);
    return function() {
      var c = Array.prototype.slice.call(arguments);
      Array.prototype.unshift.apply(c, d);
      return a.apply(b, c);
    };
  }
  return function() {
    return a.apply(b, arguments);
  };
};
goog.bind = function(a, b, c) {
  Function.prototype.bind && -1 != Function.prototype.bind.toString().indexOf("native code") ? goog.bind = goog.bindNative_ : goog.bind = goog.bindJs_;
  return goog.bind.apply(null, arguments);
};
goog.partial = function(a, b) {
  var c = Array.prototype.slice.call(arguments, 1);
  return function() {
    var b = c.slice();
    b.push.apply(b, arguments);
    return a.apply(this, b);
  };
};
goog.mixin = function(a, b) {
  for (var c in b) {
    a[c] = b[c];
  }
};
goog.now = goog.TRUSTED_SITE && Date.now || function() {
  return +new Date;
};
goog.globalEval = function(a) {
  if (goog.global.execScript) {
    goog.global.execScript(a, "JavaScript");
  } else {
    if (goog.global.eval) {
      if (null == goog.evalWorksForGlobals_) {
        if (goog.global.eval("var _evalTest_ = 1;"), "undefined" != typeof goog.global._evalTest_) {
          try {
            delete goog.global._evalTest_;
          } catch (b) {
          }
          goog.evalWorksForGlobals_ = !0;
        } else {
          goog.evalWorksForGlobals_ = !1;
        }
      }
      if (goog.evalWorksForGlobals_) {
        goog.global.eval(a);
      } else {
        var c = goog.global.document, d = c.createElement("SCRIPT");
        d.type = "text/javascript";
        d.defer = !1;
        d.appendChild(c.createTextNode(a));
        c.body.appendChild(d);
        c.body.removeChild(d);
      }
    } else {
      throw Error("goog.globalEval not available");
    }
  }
};
goog.evalWorksForGlobals_ = null;
goog.getCssName = function(a, b) {
  var c = function(a) {
    return goog.cssNameMapping_[a] || a;
  }, d = function(a) {
    a = a.split("-");
    for (var b = [], d = 0;d < a.length;d++) {
      b.push(c(a[d]));
    }
    return b.join("-");
  }, d = goog.cssNameMapping_ ? "BY_WHOLE" == goog.cssNameMappingStyle_ ? c : d : function(a) {
    return a;
  };
  return b ? a + "-" + d(b) : d(a);
};
goog.setCssNameMapping = function(a, b) {
  goog.cssNameMapping_ = a;
  goog.cssNameMappingStyle_ = b;
};
!COMPILED && goog.global.CLOSURE_CSS_NAME_MAPPING && (goog.cssNameMapping_ = goog.global.CLOSURE_CSS_NAME_MAPPING);
goog.getMsg = function(a, b) {
  b && (a = a.replace(/\{\$([^}]+)}/g, function(a, d) {
    return d in b ? b[d] : a;
  }));
  return a;
};
goog.getMsgWithFallback = function(a, b) {
  return a;
};
goog.exportSymbol = function(a, b, c) {
  goog.exportPath_(a, b, c);
};
goog.exportProperty = function(a, b, c) {
  a[b] = c;
};
goog.inherits = function(a, b) {
  function c() {
  }
  c.prototype = b.prototype;
  a.superClass_ = b.prototype;
  a.prototype = new c;
  a.prototype.constructor = a;
  a.base = function(a, c, f) {
    for (var g = Array(arguments.length - 2), h = 2;h < arguments.length;h++) {
      g[h - 2] = arguments[h];
    }
    return b.prototype[c].apply(a, g);
  };
};
goog.base = function(a, b, c) {
  var d = arguments.callee.caller;
  if (goog.STRICT_MODE_COMPATIBLE || goog.DEBUG && !d) {
    throw Error("arguments.caller not defined.  goog.base() cannot be used with strict mode code. See http://www.ecma-international.org/ecma-262/5.1/#sec-C");
  }
  if (d.superClass_) {
    for (var e = Array(arguments.length - 1), f = 1;f < arguments.length;f++) {
      e[f - 1] = arguments[f];
    }
    return d.superClass_.constructor.apply(a, e);
  }
  e = Array(arguments.length - 2);
  for (f = 2;f < arguments.length;f++) {
    e[f - 2] = arguments[f];
  }
  for (var f = !1, g = a.constructor;g;g = g.superClass_ && g.superClass_.constructor) {
    if (g.prototype[b] === d) {
      f = !0;
    } else {
      if (f) {
        return g.prototype[b].apply(a, e);
      }
    }
  }
  if (a[b] === d) {
    return a.constructor.prototype[b].apply(a, e);
  }
  throw Error("goog.base called from a method of one name to a method of a different name");
};
goog.scope = function(a) {
  a.call(goog.global);
};
COMPILED || (goog.global.COMPILED = COMPILED);
goog.defineClass = function(a, b) {
  var c = b.constructor, d = b.statics;
  c && c != Object.prototype.constructor || (c = function() {
    throw Error("cannot instantiate an interface (no constructor defined).");
  });
  c = goog.defineClass.createSealingConstructor_(c, a);
  a && goog.inherits(c, a);
  delete b.constructor;
  delete b.statics;
  goog.defineClass.applyProperties_(c.prototype, b);
  null != d && (d instanceof Function ? d(c) : goog.defineClass.applyProperties_(c, d));
  return c;
};
goog.defineClass.SEAL_CLASS_INSTANCES = goog.DEBUG;
goog.defineClass.createSealingConstructor_ = function(a, b) {
  if (goog.defineClass.SEAL_CLASS_INSTANCES && Object.seal instanceof Function) {
    if (b && b.prototype && b.prototype[goog.UNSEALABLE_CONSTRUCTOR_PROPERTY_]) {
      return a;
    }
    var c = function() {
      var b = a.apply(this, arguments) || this;
      b[goog.UID_PROPERTY_] = b[goog.UID_PROPERTY_];
      this.constructor === c && Object.seal(b);
      return b;
    };
    return c;
  }
  return a;
};
goog.defineClass.OBJECT_PROTOTYPE_FIELDS_ = "constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" ");
goog.defineClass.applyProperties_ = function(a, b) {
  for (var c in b) {
    Object.prototype.hasOwnProperty.call(b, c) && (a[c] = b[c]);
  }
  for (var d = 0;d < goog.defineClass.OBJECT_PROTOTYPE_FIELDS_.length;d++) {
    c = goog.defineClass.OBJECT_PROTOTYPE_FIELDS_[d], Object.prototype.hasOwnProperty.call(b, c) && (a[c] = b[c]);
  }
};
goog.tagUnsealableClass = function(a) {
  !COMPILED && goog.defineClass.SEAL_CLASS_INSTANCES && (a.prototype[goog.UNSEALABLE_CONSTRUCTOR_PROPERTY_] = !0);
};
goog.UNSEALABLE_CONSTRUCTOR_PROPERTY_ = "goog_defineClass_legacy_unsealable";
// Input 1
var config = {link_service_endpoint:"https://bnc.lt", api_endpoint:"https://api.branch.io", version:"1.7.0"}, WEB_BUILD = !1, CORDOVA_BUILD = !0, TITANIUM_BUILD = !1, IS_CORDOVA_APP = !!window.cordova;
IS_CORDOVA_APP && WEB_BUILD && window.alert("Please use Branch Cordova SDK instead. Visit https://github.com/BranchMetrics/Cordova-Ionic-PhoneGap-Deferred-Deep-Linking-SDK for more details.");
// Input 2
var task_queue = function() {
  var a = [], b = function() {
    if (a.length) {
      a[0](function() {
        a.shift();
        b();
      });
    }
  };
  return function(c) {
    a.push(c);
    1 === a.length && b();
  };
};
// Input 3
goog.json = {};
goog.json.USE_NATIVE_JSON = !1;
goog.json.isValid = function(a) {
  return /^\s*$/.test(a) ? !1 : /^[\],:{}\s\u2028\u2029]*$/.test(a.replace(/\\["\\\/bfnrtu]/g, "@").replace(/"[^"\\\n\r\u2028\u2029\x00-\x08\x0a-\x1f]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, "]").replace(/(?:^|:|,)(?:[\s\u2028\u2029]*\[)+/g, ""));
};
goog.json.parse = goog.json.USE_NATIVE_JSON ? goog.global.JSON.parse : function(a) {
  a = String(a);
  if (goog.json.isValid(a)) {
    try {
      return eval("(" + a + ")");
    } catch (b) {
    }
  }
  throw Error("Invalid JSON string: " + a);
};
goog.json.unsafeParse = goog.json.USE_NATIVE_JSON ? goog.global.JSON.parse : function(a) {
  return eval("(" + a + ")");
};
goog.json.serialize = goog.json.USE_NATIVE_JSON ? goog.global.JSON.stringify : function(a, b) {
  return (new goog.json.Serializer(b)).serialize(a);
};
goog.json.Serializer = function(a) {
  this.replacer_ = a;
};
goog.json.Serializer.prototype.serialize = function(a) {
  var b = [];
  this.serializeInternal(a, b);
  return b.join("");
};
goog.json.Serializer.prototype.serializeInternal = function(a, b) {
  if (null == a) {
    b.push("null");
  } else {
    if ("object" == typeof a) {
      if (goog.isArray(a)) {
        this.serializeArray(a, b);
        return;
      }
      if (a instanceof String || a instanceof Number || a instanceof Boolean) {
        a = a.valueOf();
      } else {
        this.serializeObject_(a, b);
        return;
      }
    }
    switch(typeof a) {
      case "string":
        this.serializeString_(a, b);
        break;
      case "number":
        this.serializeNumber_(a, b);
        break;
      case "boolean":
        b.push(a);
        break;
      case "function":
        b.push("null");
        break;
      default:
        throw Error("Unknown type: " + typeof a);;
    }
  }
};
goog.json.Serializer.charToJsonCharCache_ = {'"':'\\"', "\\":"\\\\", "/":"\\/", "\b":"\\b", "\f":"\\f", "\n":"\\n", "\r":"\\r", "\t":"\\t", "\x0B":"\\u000b"};
goog.json.Serializer.charsToReplace_ = /\uffff/.test("\uffff") ? /[\\\"\x00-\x1f\x7f-\uffff]/g : /[\\\"\x00-\x1f\x7f-\xff]/g;
goog.json.Serializer.prototype.serializeString_ = function(a, b) {
  b.push('"', a.replace(goog.json.Serializer.charsToReplace_, function(a) {
    var b = goog.json.Serializer.charToJsonCharCache_[a];
    b || (b = "\\u" + (a.charCodeAt(0) | 65536).toString(16).substr(1), goog.json.Serializer.charToJsonCharCache_[a] = b);
    return b;
  }), '"');
};
goog.json.Serializer.prototype.serializeNumber_ = function(a, b) {
  b.push(isFinite(a) && !isNaN(a) ? a : "null");
};
goog.json.Serializer.prototype.serializeArray = function(a, b) {
  var c = a.length;
  b.push("[");
  for (var d = "", e = 0;e < c;e++) {
    b.push(d), d = a[e], this.serializeInternal(this.replacer_ ? this.replacer_.call(a, String(e), d) : d, b), d = ",";
  }
  b.push("]");
};
goog.json.Serializer.prototype.serializeObject_ = function(a, b) {
  b.push("{");
  var c = "", d;
  for (d in a) {
    if (Object.prototype.hasOwnProperty.call(a, d)) {
      var e = a[d];
      "function" != typeof e && (b.push(c), this.serializeString_(d, b), b.push(":"), this.serializeInternal(this.replacer_ ? this.replacer_.call(a, d, e) : e, b), c = ",");
    }
  }
  b.push("}");
};
// Input 4
var utils = {}, DEBUG = !0, message;
utils.httpMethod = {POST:"POST", GET:"GET"};
utils.messages = {missingParam:"API request $1 missing parameter $2", invalidType:"API request $1, parameter $2 is not $3", nonInit:"Branch SDK not initialized", initPending:"Branch SDK initialization pending and a Branch method was called outside of the queue order", initFailed:"Branch SDK initialization failed, so further methods cannot be called", existingInit:"Branch SDK already initilized", missingAppId:"Missing Branch app ID", callBranchInitFirst:"Branch.init must be called first", timeout:"Request timed out", 
missingUrl:"Required argument: URL, is missing"};
utils.getLocationSearch = function() {
  return window.location.search;
};
utils.getLocationHash = function() {
  return window.location.hash;
};
utils.message = function(a, b) {
  var c = a.replace(/\$(\d)/g, function(a, c) {
    return b[parseInt(c, 10) - 1];
  });
  DEBUG && console && console.log(c);
  return c;
};
utils.whiteListSessionData = function(a) {
  return {data:a.data || null, data_parsed:a.data_parsed || null, has_app:a.has_app || null, identity:a.identity || null, referring_identity:a.referring_identity || null, referring_link:a.referring_link || null};
};
utils.cleanLinkData = function(a, b) {
  WEB_BUILD && (a.source = "web-sdk", a.data && void 0 !== a.data.$desktop_url && (a.data.$desktop_url = a.data.$desktop_url.replace(/#r:[a-z0-9-_]+$/i, "").replace(/([\?\&]_branch_match_id=\d+)/, "")));
  try {
    JSON.parse(a.data);
  } catch (c) {
    a.data = goog.json.serialize(a.data || {});
  }
  return a;
};
utils.clickIdFromLink = function(a) {
  return a ? a.substring(a.lastIndexOf("/") + 1, a.length) : null;
};
utils.processReferringLink = function(a) {
  return a ? "http" !== a.substring(0, 4) ? "https://bnc.lt" + a : a : null;
};
utils.merge = function(a, b) {
  if ("undefined" === typeof b) {
    return a;
  }
  for (var c in b) {
    b.hasOwnProperty(c) && (a[c] = b[c]);
  }
  return a;
};
utils.hashValue = function(a) {
  try {
    return utils.getLocationHash().match(new RegExp(a + ":([^&]*)"))[1];
  } catch (b) {
  }
};
utils.mobileUserAgent = function() {
  return navigator.userAgent.match(/android/i) ? "android" : navigator.userAgent.match(/ipad/i) ? "ipad" : navigator.userAgent.match(/i(os|p(hone|od))/i) ? "ios" : !1;
};
utils.getParamValue = function(a) {
  try {
    return utils.getLocationSearch().substring(1).match(new RegExp(a + "=([^&]*)"))[1];
  } catch (b) {
  }
};
utils.isKey = function(a) {
  return -1 < a.indexOf("key_");
};
utils.snakeToCamel = function(a) {
  return a.replace(/(\-\w)/g, function(a) {
    return a[1].toUpperCase();
  });
};
utils.base64encode = function(a) {
  var b = "", c, d, e, f, g, h, k = 0;
  a = a.replace(/\r\n/g, "\n");
  d = "";
  for (e = 0;e < a.length;e++) {
    f = a.charCodeAt(e), 128 > f ? d += String.fromCharCode(f) : (127 < f && 2048 > f ? d += String.fromCharCode(f >> 6 | 192) : (d += String.fromCharCode(f >> 12 | 224), d += String.fromCharCode(f >> 6 & 63 | 128)), d += String.fromCharCode(f & 63 | 128));
  }
  for (a = d;k < a.length;) {
    c = a.charCodeAt(k++), d = a.charCodeAt(k++), e = a.charCodeAt(k++), f = c >> 2, c = (c & 3) << 4 | d >> 4, g = (d & 15) << 2 | e >> 6, h = e & 63, isNaN(d) ? h = g = 64 : isNaN(e) && (h = 64), b = b + "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=".charAt(f) + "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=".charAt(c) + "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=".charAt(g) + "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=".charAt(h)
    ;
  }
  return b;
};
// Input 5
var resources = {}, validationTypes = {OBJECT:0, STRING:1, NUMBER:2, ARRAY:3, BOOLEAN:4}, _validator;
function validator(a, b) {
  return function(c, d, e) {
    if ("number" === typeof e || e) {
      if (b === validationTypes.OBJECT) {
        if ("object" !== typeof e) {
          return utils.message(utils.messages.invalidType, [c, d, "an object"]);
        }
      } else {
        if (b === validationTypes.ARRAY) {
          if (!(e instanceof Array)) {
            return utils.message(utils.messages.invalidType, [c, d, "an array"]);
          }
        } else {
          if (b === validationTypes.NUMBER) {
            if ("number" !== typeof e) {
              return utils.message(utils.messages.invalidType, [c, d, "a number"]);
            }
          } else {
            if (b === validationTypes.BOOLEAN) {
              if ("boolean" !== typeof e) {
                return utils.message(utils.messages.invalidType, [c, d, "a boolean"]);
              }
            } else {
              if ("string" !== typeof e) {
                return utils.message(utils.messages.invalidType, [c, d, "a string"]);
              }
              if (b !== validationTypes.STRING && !b.test(e)) {
                return utils.message(utils.messages.invalidType, [c, d, "in the proper format"]);
              }
            }
          }
        }
      }
    } else {
      if (a) {
        return utils.message(utils.messages.missingParam, [c, d]);
      }
    }
    return !1;
  };
}
var branch_id = /^[0-9]{15,20}$/;
function defaults(a) {
  var b = {};
  WEB_BUILD && (b = {session_id:validator(!0, branch_id), identity_id:validator(!0, branch_id), browser_fingerprint_id:validator(!0, branch_id), sdk:validator(!0, validationTypes.STRING)});
  if (CORDOVA_BUILD || TITANIUM_BUILD) {
    b = {session_id:validator(!0, branch_id), identity_id:validator(!0, branch_id), device_fingerprint_id:validator(!0, branch_id), sdk:validator(!0, validationTypes.STRING)};
  }
  return utils.merge(a, b);
}
WEB_BUILD && (resources.open = {destination:config.api_endpoint, endpoint:"/v1/open", method:utils.httpMethod.POST, params:{identity_id:validator(!1, branch_id), link_identifier:validator(!1, validationTypes.STRING), is_referrable:validator(!0, validationTypes.NUMBER), sdk:validator(!1, validationTypes.STRING), browser_fingerprint_id:validator(!0, branch_id)}}, resources._r = {destination:config.link_service_endpoint, endpoint:"/_r", method:utils.httpMethod.GET, jsonp:!0, params:{sdk:validator(!0, 
validationTypes.STRING)}}, resources.linkClick = {destination:config.link_service_endpoint, endpoint:"", method:utils.httpMethod.GET, queryPart:{link_url:validator(!0, validationTypes.STRING)}, params:{click:validator(!0, validationTypes.STRING)}}, resources.SMSLinkSend = {destination:config.link_service_endpoint, endpoint:"/c", method:utils.httpMethod.POST, queryPart:{link_url:validator(!0, validationTypes.STRING)}, params:{sdk:validator(!1, validationTypes.STRING), phone:validator(!0, validationTypes.STRING)}});
if (CORDOVA_BUILD || TITANIUM_BUILD) {
  resources.install = {destination:config.api_endpoint, endpoint:"/v1/install", method:utils.httpMethod.POST, params:{link_identifier:validator(!1, validationTypes.STRING), sdk:validator(!1, validationTypes.STRING), hardware_id:validator(!1, validationTypes.STRING), is_hardware_id_real:validator(!1, validationTypes.BOOLEAN), app_version:validator(!1, validationTypes.STRING), carrier:validator(!1, validationTypes.STRING), bluetooth:validator(!1, validationTypes.BOOLEAN), bluetooth_version:validator(!1, 
  validationTypes.STRING), has_nfc:validator(!1, validationTypes.BOOLEAN), has_telephone:validator(!1, validationTypes.BOOLEAN), brand:validator(!1, validationTypes.STRING), model:validator(!1, validationTypes.STRING), os:validator(!1, validationTypes.STRING), uri_scheme:validator(!1, validationTypes.STRING), os_version:validator(!1, validationTypes.STRING), screen_dpi:validator(!1, validationTypes.NUMBER), screen_width:validator(!1, validationTypes.NUMBER), screen_height:validator(!1, validationTypes.NUMBER), 
  is_referrable:validator(!1, validationTypes.NUMBER), update:validator(!1, validationTypes.NUMBER), add_tracking_enabled:validator(!1, validationTypes.BOOLEAN)}}, resources.open = {destination:config.api_endpoint, endpoint:"/v1/open", method:utils.httpMethod.POST, params:{identity_id:validator(!0, branch_id), link_identifier:validator(!1, validationTypes.STRING), device_fingerprint_id:validator(!0, branch_id), sdk:validator(!1, validationTypes.STRING), hardware_id:validator(!1, validationTypes.STRING), 
  is_hardware_id_real:validator(!1, validationTypes.BOOLEAN), app_version:validator(!1, validationTypes.STRING), os:validator(!1, validationTypes.STRING), uri_scheme:validator(!1, validationTypes.STRING), os_version:validator(!1, validationTypes.STRING), is_referrable:validator(!1, validationTypes.NUMBER)}}, resources.close = {destination:config.api_endpoint, endpoint:"/v1/close", method:utils.httpMethod.POST, params:{identity_id:validator(!0, branch_id), sdk:validator(!0, validationTypes.STRING), 
  session_id:validator(!0, branch_id), link_click_id:validator(!1, branch_id), device_fingerprint_id:validator(!0, branch_id)}};
}
resources.getCode = {destination:config.api_endpoint, endpoint:"/v1/referralcode", method:utils.httpMethod.POST, params:defaults({prefix:validator(!1, validationTypes.STRING), amount:validator(!0, validationTypes.NUMBER), expiration:validator(!1, validationTypes.STRING), calculation_type:validator(!0, validationTypes.NUMBER), location:validator(!0, validationTypes.NUMBER), creation_source:validator(!0, validationTypes.NUMBER), type:validator(!0, validationTypes.STRING), bucket:validator(!1, validationTypes.STRING)})};
resources.validateCode = {destination:config.api_endpoint, endpoint:"/v1/referralcode", method:utils.httpMethod.POST, queryPart:{code:validator(!0, validationTypes.STRING)}, params:defaults({})};
resources.applyCode = {destination:config.api_endpoint, endpoint:"/v1/applycode", method:utils.httpMethod.POST, queryPart:{code:validator(!0, validationTypes.STRING)}, params:defaults({})};
resources.logout = {destination:config.api_endpoint, endpoint:"/v1/logout", method:utils.httpMethod.POST, params:defaults({session_id:validator(!0, branch_id)})};
resources.profile = {destination:config.api_endpoint, endpoint:"/v1/profile", method:utils.httpMethod.POST, params:defaults({identity_id:validator(!0, branch_id), identity:validator(!0, validationTypes.STRING)})};
resources.referrals = {destination:config.api_endpoint, endpoint:"/v1/referrals", method:utils.httpMethod.GET, queryPart:{identity_id:validator(!0, branch_id)}, params:defaults({})};
resources.creditHistory = {destination:config.api_endpoint, endpoint:"/v1/credithistory", method:utils.httpMethod.GET, params:defaults({link_click_id:validator(!1, branch_id), length:validator(!1, validationTypes.NUMBER), direction:validator(!1, validationTypes.NUMBER), begin_after_id:validator(!1, branch_id), bucket:validator(!1, validationTypes.STRING)})};
resources.credits = {destination:config.api_endpoint, endpoint:"/v1/credits", method:utils.httpMethod.GET, queryPart:{identity_id:validator(!0, branch_id)}, params:defaults({})};
resources.redeem = {destination:config.api_endpoint, endpoint:"/v1/redeem", method:utils.httpMethod.POST, params:defaults({identity_id:validator(!0, branch_id), amount:validator(!0, validationTypes.NUMBER), bucket:validator(!0, validationTypes.STRING)})};
resources.link = {destination:config.api_endpoint, endpoint:"/v1/url", method:utils.httpMethod.POST, ref:"obj", params:defaults({identity_id:validator(!0, branch_id), data:validator(!1, validationTypes.STRING), tags:validator(!1, validationTypes.ARRAY), feature:validator(!1, validationTypes.STRING), campaign:validator(!1, validationTypes.STRING), channel:validator(!1, validationTypes.STRING), stage:validator(!1, validationTypes.STRING), type:validator(!1, validationTypes.NUMBER), alias:validator(!1, 
validationTypes.STRING)})};
resources.hasApp = {destination:config.api_endpoint, endpoint:"/v1/has-app", method:utils.httpMethod.GET, params:{browser_fingerprint_id:validator(!0, branch_id)}};
resources.event = {destination:config.api_endpoint, endpoint:"/v1/event", method:utils.httpMethod.POST, params:defaults({event:validator(!0, validationTypes.STRING), metadata:validator(!0, validationTypes.OBJECT)})};
// Input 6
var session = {get:function(a, b) {
  try {
    return goog.json.parse(a.get(b ? "branch_session_first" : "branch_session", b)) || null;
  } catch (c) {
    return null;
  }
}, set:function(a, b, c) {
  a.set("branch_session", goog.json.serialize(b));
  c && a.set("branch_session_first", goog.json.serialize(b), !0);
}, update:function(a, b) {
  var c = session.get(a), c = utils.merge(c, b);
  a.set("branch_session", goog.json.serialize(c));
}};
// Input 7
var COOKIE_MS = 31536E6, BRANCH_KEY_PREFIX = "BRANCH_WEBSDK_KEY", storage, BranchStorage = function(a) {
  for (var b = 0;b < a.length;b++) {
    var c = this[a[b]], c = "function" === typeof c ? c() : c;
    if (c.isEnabled()) {
      return c._store = {}, c;
    }
  }
}, prefix = function(a) {
  return "branch_session" === a || "branch_session_first" === a ? a : BRANCH_KEY_PREFIX + a;
}, trimPrefix = function(a) {
  return a.replace(BRANCH_KEY_PREFIX, "");
}, retrieveValue = function(a) {
  return "true" === a ? !0 : "false" === a ? !1 : a;
}, webStorage = function(a) {
  var b = a ? localStorage : sessionStorage;
  return {getAll:function() {
    if ("undefined" === typeof b) {
      return null;
    }
    var a = null, d;
    for (d in b) {
      0 === d.indexOf(BRANCH_KEY_PREFIX) && (null === a && (a = {}), a[trimPrefix(d)] = retrieveValue(b.getItem(d)));
    }
    return a;
  }, get:function(a, d) {
    return retrieveValue(d ? localStorage.getItem(prefix(a)) : b.getItem(prefix(a)));
  }, set:function(a, d, e) {
    e ? localStorage.setItem(prefix(a), d) : b.setItem(prefix(a), d);
  }, remove:function(a) {
    b.removeItem(prefix(a));
  }, clear:function() {
    Object.keys(b).forEach(function(a) {
      0 === a.indexOf(BRANCH_KEY_PREFIX) && b.removeItem(a);
    });
  }, isEnabled:function() {
    try {
      return b.setItem("test", ""), b.removeItem("test"), !0;
    } catch (a) {
      return !1;
    }
  }};
};
BranchStorage.prototype.local = function() {
  return webStorage(!0);
};
BranchStorage.prototype.session = function() {
  return webStorage(!1);
};
var cookies = function(a) {
  return {getAll:function() {
    for (var a = document.cookie.split(";"), c = {}, d = 0;d < a.length;d++) {
      var e = a[d].replace(" ", ""), e = e.substring(0, e.length);
      -1 !== e.indexOf(BRANCH_KEY_PREFIX) && (e = e.split("="), c[trimPrefix(e[0])] = retrieveValue(e[1]));
    }
    return c;
  }, get:function(a) {
    a = prefix(a) + "=";
    for (var c = document.cookie.split(";"), d = 0;d < c.length;d++) {
      var e = c[d], e = e.substring(1, e.length);
      if (0 === e.indexOf(a)) {
        return retrieveValue(e.substring(a.length, e.length));
      }
    }
    return null;
  }, set:function(b, c) {
    var d = prefix(b), e = "";
    a && (e = new Date, e.setTime(e.getTime() + COOKIE_MS), e = "; branch_expiration_date=" + e.toGMTString() + "; expires=" + e.toGMTString());
    document.cookie = d + "=" + c + e + "; path=/";
  }, remove:function(a) {
    document.cookie = prefix(a) + "=; expires=; path=/";
  }, clear:function() {
    for (var b = function(a) {
      document.cookie = a.substring(0, a.indexOf("=")) + "=;expires=-1;path=/";
    }, c = document.cookie.split(";"), d = 0;d < c.length;d++) {
      var e = c[d], e = e.substring(1, e.length);
      -1 !== e.indexOf(BRANCH_KEY_PREFIX) && (a || -1 !== e.indexOf("branch_expiration_date=") ? a && 0 < e.indexOf("branch_expiration_date=") && b(e) : b(e));
    }
  }, isEnabled:function() {
    return navigator.cookieEnabled;
  }};
};
BranchStorage.prototype.cookie = function() {
  return cookies(!1);
};
BranchStorage.prototype.permcookie = function() {
  return cookies(!0);
};
BranchStorage.prototype.pojo = {getAll:function() {
  return this._store;
}, get:function(a) {
  return this._store[a] || null;
}, set:function(a, b) {
  this._store[a] = b;
}, remove:function(a) {
  delete this._store[a];
}, clear:function() {
  this._store = {};
}, isEnabled:function() {
  return !0;
}};
BranchStorage.prototype.titanium = {getAll:function() {
  for (var a = {}, b = Ti.App.Properties.listProperties(), c = 0;c < b.length;c++) {
    -1 !== b[c].indexOf(BRANCH_KEY_PREFIX) && (a[b[c]] = retrieveValue(Ti.App.Properties.getString(b[c])));
  }
  return a;
}, get:function(a) {
  retrieveValue(Ti.App.Properties.getString(prefix(a)));
}, set:function(a, b) {
  Ti.App.Properties.setString(prefix(a), b);
}, remove:function(a) {
  Ti.App.Properties.setString(prefix(a), "");
}, clear:function() {
  for (var a = Ti.App.Properties.listProperties(), b = 0;b < a.length;b++) {
    -1 !== a[b].indexOf(BRANCH_KEY_PREFIX) && Ti.App.Properties.setString(a[b], "");
  }
}, isEnabled:function() {
  try {
    return Ti.App.Properties.setString("test", ""), Ti.App.Properties.getString("test"), !0;
  } catch (a) {
    return !1;
  }
}};
// Input 8
var RETRIES = 2, RETRY_DELAY = 200, TIMEOUT = 5E3, Server = function() {
};
Server.prototype._jsonp_callback_index = 0;
Server.prototype.serializeObject = function(a, b) {
  if ("undefined" === typeof a) {
    return "";
  }
  var c = [];
  if (a instanceof Array) {
    for (var d = 0;d < a.length;d++) {
      c.push(encodeURIComponent(b) + "=" + encodeURIComponent(a[d]));
    }
    return c.join("&");
  }
  for (d in a) {
    a.hasOwnProperty(d) && (a[d] instanceof Array || "object" === typeof a[d] ? c.push(this.serializeObject(a[d], b ? b + "." + d : d)) : c.push(encodeURIComponent(b ? b + "." + d : d) + "=" + encodeURIComponent(a[d])));
  }
  return c.join("&");
};
Server.prototype.getUrl = function(a, b) {
  var c, d, e = a.destination + a.endpoint, f = /^[0-9]{15,20}$/, g = /key_(live|test)_[A-Za-z0-9]{32}/, h = function(b, c) {
    "undefined" === typeof c && (c = {});
    if (b.branch_key && g.test(b.branch_key)) {
      return c.branch_key = b.branch_key, c;
    }
    if (b.app_id && f.test(b.app_id)) {
      return c.app_id = b.app_id, c;
    }
    throw Error(utils.message(utils.messages.missingParam, [a.endpoint, "branch_key or app_id"]));
  };
  if ("/v1/has-app" === a.endpoint) {
    try {
      a.queryPart = h(b, a.queryPart);
    } catch (k) {
      return {error:k.message};
    }
  }
  if ("undefined" !== typeof a.queryPart) {
    for (c in a.queryPart) {
      if (a.queryPart.hasOwnProperty(c)) {
        if (d = "function" === typeof a.queryPart[c] ? a.queryPart[c](a.endpoint, c, b[c]) : d) {
          return {error:d};
        }
        e += "/" + b[c];
      }
    }
  }
  var l = {};
  if ("undefined" !== typeof a.params) {
    for (c in a.params) {
      if (a.params.hasOwnProperty(c)) {
        if (d = a.params[c](a.endpoint, c, b[c])) {
          return {error:d};
        }
        d = b[c];
        "undefined" !== typeof d && "" !== d && null !== d && (l[c] = d);
      }
    }
  }
  if ("POST" === a.method || "/v1/credithistory" === a.endpoint) {
    try {
      b = h(b, l);
    } catch (k) {
      return {error:k.message};
    }
  }
  "/v1/event" === a.endpoint && (l.metadata = JSON.stringify(l.metadata || {}));
  return {data:this.serializeObject(l, ""), url:e};
};
Server.prototype.createScript = function(a) {
  var b = document.createElement("script");
  b.type = "text/javascript";
  b.async = !0;
  b.src = a;
  document.getElementsByTagName("head")[0].appendChild(b);
};
var jsonp_callback_index = 0;
Server.prototype.jsonpRequest = function(a, b, c, d) {
  var e = "branch_callback__" + this._jsonp_callback_index++, f = 0 <= a.indexOf("api.branch.io") ? "&data=" : "&post_data=";
  b = "POST" === c ? encodeURIComponent(utils.base64encode(goog.json.serialize(b))) : "";
  var g = window.setTimeout(function() {
    window[e] = function() {
    };
    d(Error(utils.messages.timeout), null, 504);
  }, TIMEOUT);
  window[e] = function(a) {
    window.clearTimeout(g);
    d(null, a);
  };
  this.createScript(a + (0 > a.indexOf("?") ? "?" : "") + (b ? f + b : "") + (0 <= a.indexOf("/c/") ? "&click=1" : "") + "&callback=" + e);
};
Server.prototype.XHRRequest = function(a, b, c, d, e) {
  var f = TITANIUM_BUILD ? Ti.Network.createHTTPClient() : window.XMLHttpRequest ? new XMLHttpRequest : new ActiveXObject("Microsoft.XMLHTTP");
  f.ontimeout = function() {
    e(Error(utils.messages.timeout), null, 504);
  };
  TITANIUM_BUILD ? (f.onerror = function(a) {
    402 === f.status ? e(Error("Not enough credits to redeem."), null, f.status) : e(Error(a.error || "Error in API: " + f.status), null, f.status);
  }, f.onload = function() {
    if (200 === f.status) {
      try {
        e(null, goog.json.parse(f.responseText), f.status);
      } catch (a) {
        e(null, {}, f.status);
      }
    } else {
      402 === f.status ? e(Error("Not enough credits to redeem."), null, f.status) : "4" !== f.status.toString().substring(0, 1) && "5" !== f.status.toString().substring(0, 1) || e(Error("Error in API: " + f.status), null, f.status);
    }
  }) : (f.onerror = function(a) {
    e(Error(a.error || "Error in API: " + f.status), null, f.status);
  }, f.onreadystatechange = function() {
    if (4 === f.readyState) {
      if (200 === f.status) {
        try {
          e(null, goog.json.parse(f.responseText), f.status);
        } catch (a) {
          e(null, {}, f.status);
        }
      } else {
        402 === f.status ? e(Error("Not enough credits to redeem."), null, f.status) : "4" !== f.status.toString().substring(0, 1) && "5" !== f.status.toString().substring(0, 1) || e(Error("Error in API: " + f.status), null, f.status);
      }
    }
  });
  try {
    f.open(c, a, !0), f.timeout = TIMEOUT, f.setRequestHeader("Content-Type", "application/x-www-form-urlencoded"), f.send(b);
  } catch (g) {
    d.set("use_jsonp", !0), this.jsonpRequest(a, b, c, e);
  }
};
Server.prototype.request = function(a, b, c, d) {
  var e = this, f = this.getUrl(a, b);
  if (f.error) {
    return d(Error(f.error));
  }
  var g, h = "";
  "GET" === a.method ? g = f.url + "?" + f.data : (g = f.url, h = f.data);
  var k = RETRIES, l = function(a, b, c) {
    a && 0 < k && "5" === c.toString().substring(0, 1) ? (k--, window.setTimeout(function() {
      n();
    }, RETRY_DELAY)) : d(a, b);
  }, n = function() {
    c.get("use_jsonp") || a.jsonp ? e.jsonpRequest(g, b, a.method, l) : e.XHRRequest(g, h, a.method, c, l);
  };
  n();
};
// Input 9
var banner_utils = {animationSpeed:250, animationDelay:20, bannerHeight:"76px", error_timeout:2E3, success_timeout:3E3, removeElement:function(a) {
  a && a.parentNode.removeChild(a);
}, hasClass:function(a, b) {
  return !!a.className.match(new RegExp("(\\s|^)" + b + "(\\s|$)"));
}, addClass:function(a, b) {
  banner_utils.hasClass(a, b) || (a.className += " " + b);
}, removeClass:function(a, b) {
  banner_utils.hasClass(a, b) && (a.className = a.className.replace(new RegExp("(\\s|^)" + b + "(\\s|$)"), " "));
}, getDate:function(a) {
  var b = new Date;
  return b.setDate(b.getDate() + a);
}, getBodyStyle:function(a) {
  return document.body.currentStyle ? document.body.currentStyle[utils.snakeToCamel(a)] : window.getComputedStyle(document.body).getPropertyValue(a);
}, addCSSLengths:function(a, b) {
  var c = function(a) {
    if (!a) {
      return 0;
    }
    var b = a.replace(/[0-9,\.]/g, "");
    a = a.match(/\d+/g);
    var f = parseInt(0 < a.length ? a[0] : "0", 10), g = function() {
      return Math.max(document.documentElement.clientWidth, window.innerWidth || 0) / 100;
    }, h = function() {
      return Math.max(document.documentElement.clientHeight, window.innerHeight || 0) / 100;
    };
    return parseInt({px:function(a) {
      return a;
    }, em:function(a) {
      return document.body.currentStyle ? a * c(document.body.currentStyle.fontSize) : a * parseFloat(window.getComputedStyle(document.body).fontSize);
    }, rem:function(a) {
      return document.documentElement.currentStyle ? a * c(document.documentElement.currentStyle.fontSize) : a * parseFloat(window.getComputedStyle(document.documentElement).fontSize);
    }, vw:function(a) {
      return a * g();
    }, vh:function(a) {
      return a * h();
    }, vmin:function(a) {
      return a * Math.min(h(), g());
    }, vmax:function(a) {
      return a * Math.max(h(), g());
    }, "%":function() {
      return document.body.clientWidth / 100 * f;
    }}[b](f), 10);
  };
  return (c(a) + c(b)).toString() + "px";
}, shouldAppend:function(a, b) {
  var c = a.get("hideBanner"), c = "number" === typeof c ? new Date >= new Date(c) : !c, d = b.forgetHide;
  "number" === typeof d && (d = !1);
  return !document.getElementById("branch-banner") && !document.getElementById("branch-banner-iframe") && (c || d) && (b.showDesktop && !utils.mobileUserAgent() || b.showAndroid && "android" === utils.mobileUserAgent() || b.showiPad && "ipad" === utils.mobileUserAgent() || b.showiOS && "ios" === utils.mobileUserAgent());
}};
// Input 10
var banner_css = {banner:function(a) {
  return ".branch-banner-is-active { -webkit-transition: all " + 1.5 * banner_utils.animationSpeed / 1E3 + "s ease; transition: all 0" + 1.5 * banner_utils.animationSpeed / 1E3 + "s ease; }\n#branch-banner { width:100%; z-index: 99999; font-family: Helvetica Neue, Sans-serif; -webkit-font-smoothing: antialiased; -webkit-user-select: none; -moz-user-select: none; user-select: none; -webkit-transition: all " + banner_utils.animationSpeed / 1E3 + "s ease; transition: all 0" + banner_utils.animationSpeed / 
  1E3 + "s ease; }\n#branch-banner * { margin-right: 4px; position: relative; line-height: 1.2em; }\n#branch-banner-close { font-weight: 400; cursor: pointer; float: left; z-index: 2; }\n#branch-banner .content { width:100%; overflow: hidden; height: " + banner_utils.bannerHeight + "; background: rgba(255, 255, 255, 0.95); color: #333; " + ("top" === a.position ? "border-bottom" : "border-top") + ': 1px solid #ddd; }\n#branch-banner .icon { float: left; padding-bottom: 40px; }\n#branch-banner .content .left { padding: 6px; }\n#branch-banner .icon img { width: 63px; height: 63px; }\n#branch-banner .vertically-align-middle { top: 50%; transform: translateY(-50%); -webkit-transform: translateY(-50%); -ms-transform: translateY(-50%); }\n#branch-banner .details > * { display: block; }\n#branch-banner .content .left { height: 63px; }\n#branch-banner .content .right { float: right; height: 63px; margin-bottom: 50px; padding-top: 6px; z-index: 1; }\n#branch-banner .right > div { float: left; padding-top: 3px; }\n#branch-banner-action { top: 17px; }\n#branch-banner .content:after { content: ""; position: absolute; left: 0; right: 0; top: 100%; height: 1px; background: rgba(0, 0, 0, 0.2); }\n';
}, desktop:"#branch-banner { position: fixed; min-width: 600px; }\n#branch-banner-close { color: #aaa; font-size: 24px; top: 14px; }\n#branch-banner-close:hover { color: #000; }\n#branch-banner .title { font-size: 14px; }\n#branch-banner .description { font-size: 12px; font-weight: normal; }\n#branch-sms-block * { vertical-align: bottom; font-size: 15px; }\n#branch-sms-block { display: inline-block; }\n#branch-sms-phone { font-weight: 400; border-radius: 4px; height: 30px; border: 1px solid #ccc; padding: 5px 7px 4px; width: 145px; font-size: 14px; }\n#branch-sms-send { cursor: pointer; margin-top: 0px; font-size: 14px; display: inline-block; height: 30px; margin-left: 5px; font-weight: 400; border-radius: 4px; border: 1px solid #ccc; background: #fff; color: #000; padding: 0px 12px; }\n#branch-sms-send:hover { border: 1px solid #BABABA; background: #E0E0E0; }\n#branch-sms-phone:focus, button:focus { outline: none; }\n#branch-sms-phone.error { color: rgb(194, 0, 0); border-color: rgb(194, 0, 0); }\n#branch-banner .branch-icon-wrapper { width:25px; height: 25px; vertical-align: middle; display: inline-block; margin-top: -18px; }\n@keyframes branch-spinner { 0% { transform: rotate(0deg); -webkit-transform: rotate(0deg); -ms-transform: rotate(0deg); } 100% { transform: rotate(360deg); -webkit-transform: rotate(360deg); -ms-transform: rotate(360deg); } }\n@-webkit-keyframes branch-spinner { 0% { transform: rotate(0deg); -webkit-transform: rotate(0deg); -ms-transform: rotate(0deg); } 100% { transform: rotate(360deg); -webkit-transform: rotate(360deg); -ms-transform: rotate(360deg); } }\n#branch-spinner { -webkit-animation: branch-spinner 1s ease-in-out infinite; animation: branch-spinner 1s ease-in-out infinite; transition: all 0.7s ease-in-out; border:2px solid #ddd; border-bottom-color:#428bca; width:80%; height:80%; border-radius:50%; -webkit-font-smoothing: antialiased !important; }\n", 
nonie:"#branch-banner .checkmark { stroke: #428bca; stroke-dashoffset: 745.74853515625; stroke-dasharray: 745.74853515625; -webkit-animation: dash 2s ease-out forwards; animation: dash 2s ease-out forwards; }\n@-webkit-keyframes dash { 0% { stroke-dashoffset: 745.748535 15625; } 100% { stroke-dashoffset: 0; } }\n@keyframes dash { 0% { stroke-dashoffset: 745.74853515625; } 100% { stroke-dashoffset: 0; } }\n", ie:"#branch-banner .checkmark { color: #428bca; font-size: 22px; }\n", mobile:"#branch-banner { position: absolute; }\n#branch-banner-close { margin-top: 22px; }\n#branch-banner .content .left .details .title { font-size: 12px; }\n#branch-banner a { text-decoration: none; }\n#branch-mobile-action { white-space: nowrap; }\n#branch-banner .content .left .details .description { font-size: 11px; font-weight: normal; }\n@media only screen and (min-device-width: 320px) and (max-device-width: 350px) { #branch-banner .content .right { max-width: 120px; } }\n@media only screen and (min-device-width: 351px) and (max-device-width: 400px) and (orientation: landscape) { #branch-banner .content .right { max-width: 150px; } }\n@media only screen and (min-device-width: 401px) and (max-device-width: 480px) and (orientation: landscape) { #branch-banner .content .right { max-width: 180px; } }\n", 
ios:"#branch-banner-close { margin-left: 4px; }\n#branch-banner a { color: #428bca; }\n", android:"#branch-banner-close { height:17px; width: 17px; text-align: center; font-size: 15px; border-radius:14px; border:0; line-height:14px; color:#b1b1b3; background:#efefef; }\n#branch-mobile-action { top: 0; text-decoration:none; border-bottom: 3px solid #A4C639; padding: 0 10px; height: 24px; line-height: 24px; text-align: center; color: #fff; font-weight: bold; background-color: #A4C639; border-radius: 5px; }\n#branch-mobile-action:hover { border-bottom:3px solid #8c9c29; background-color: #c1d739; }\n"};
banner_css.iframe = "body { -webkit-transition: all " + 1.5 * banner_utils.animationSpeed / 1E3 + "s ease; transition: all 0" + 1.5 * banner_utils.animationSpeed / 1E3 + "s ease; }\n#branch-banner-iframe { box-shadow: 0 0 1px rgba(0,0,0,0.2); width: 1px; min-width:100%; left: 0; right: 0; border: 0; height: " + banner_utils.bannerHeight + "; z-index: 99999; -webkit-transition: all " + banner_utils.animationSpeed / 1E3 + "s ease; transition: all 0" + banner_utils.animationSpeed / 1E3 + "s ease; }\n";
banner_css.inneriframe = "body { margin: 0; }\n";
banner_css.iframe_position = function(a, b) {
  return "#branch-banner-iframe { position: " + ("top" !== b || a ? "fixed" : "absolute") + "; }\n";
};
banner_css.css = function(a, b) {
  var c = banner_css.banner(a), d = utils.mobileUserAgent();
  "ios" !== d && "ipad" !== d || !a.showiOS ? "android" === d && a.showAndroid ? c += banner_css.mobile + banner_css.android : (c += banner_css.desktop, c = window.ActiveXObject ? c + banner_css.ie : c + banner_css.nonie) : c += banner_css.mobile + banner_css.ios;
  c += a.customCSS;
  a.iframe && (c += banner_css.inneriframe, d = document.createElement("style"), d.type = "text/css", d.id = "branch-iframe-css", d.innerHTML = banner_css.iframe + (utils.mobileUserAgent() ? banner_css.iframe_position(a.mobileSticky, a.position) : banner_css.iframe_position(a.desktopSticky, a.position)), document.head.appendChild(d));
  d = document.createElement("style");
  d.type = "text/css";
  d.id = "branch-css";
  d.innerHTML = c;
  (a.iframe ? b.contentWindow.document : document).head.appendChild(d);
  "top" === a.position ? b.style.top = "-" + banner_utils.bannerHeight : "bottom" === a.position && (b.style.bottom = "-" + banner_utils.bannerHeight);
};
// Input 11
var banner_html = {banner:function(a, b) {
  return '<div class="content"><div class="right vertically-align-middle">' + b + '</div><div class="left">' + (a.disableHide ? "" : '<div id="branch-banner-close" class="branch-animation">&times;</div>') + '<div class="icon"><img src="' + a.icon + '"></div><div class="details vertically-align-middle"><div class="title">' + a.title + '</div><div class="description">' + a.description + "</div></div></div></div>";
}, mobileAction:function(a, b, c) {
  return '<a id="branch-mobile-action" href="#" target="_parent">' + (session.get(b).has_app ? a.openAppButtonText : a.downloadAppButtonText) + "</a>";
}, desktopAction:function(a) {
  return '<div class="branch-icon-wrapper" id="branch-loader-wrapper" style="opacity: 0;"><div id="branch-spinner"></div></div><div id="branch-sms-block"><form id="sms-form"><input type="phone" class="branch-animation" name="branch-sms-phone" id="branch-sms-phone" placeholder="' + a.phonePreviewText + '"><button type="submit" id="branch-sms-send" class="branch-animation">' + a.sendLinkText + "</button></form></div>";
}, checkmark:function() {
  return window.ActiveXObject ? '<span class="checkmark">&#x2713;</span>' : '<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 98.5 98.5" enable-background="new 0 0 98.5 98.5" xml:space="preserve"><path class="checkmark" fill="none" stroke-width="8" stroke-miterlimit="10" d="M81.7,17.8C73.5,9.3,62,4,49.2,4C24.3,4,4,24.3,4,49.2s20.3,45.2,45.2,45.2s45.2-20.3,45.2-45.2c0-8.6-2.4-16.6-6.5-23.4l0,0L45.6,68.2L24.7,47.3"/></svg>';
}, iframe:function(a, b) {
  var c = document.createElement("iframe");
  c.src = "about:blank";
  c.style.overflow = "hidden";
  c.scrolling = "no";
  c.id = "branch-banner-iframe";
  c.className = "branch-animation";
  document.body.appendChild(c);
  var d = utils.mobileUserAgent(), d = '<html><head></head><body class="' + ("ios" === d || "ipad" === d ? "branch-banner-ios" : "android" === d ? "branch-banner-android" : "branch-banner-desktop") + '"><div id="branch-banner" class="branch-animation">' + banner_html.banner(a, b) + "</body></html>";
  c.contentWindow.document.open();
  c.contentWindow.document.write(d);
  c.contentWindow.document.close();
  return c;
}, div:function(a, b) {
  var c = document.createElement("div");
  c.id = "branch-banner";
  c.className = "branch-animation";
  c.innerHTML = banner_html.banner(a, b);
  document.body.appendChild(c);
  return c;
}, markup:function(a, b, c) {
  b = '<div id="branch-sms-form-container" class="vertically-align-middle">' + (utils.mobileUserAgent() ? banner_html.mobileAction(a, b, c) : banner_html.desktopAction(a)) + "</div>";
  return a.iframe ? banner_html.iframe(a, b) : banner_html.div(a, b);
}};
// Input 12
var sendSMS = function(a, b, c, d) {
  var e = a.getElementById("branch-sms-phone"), f = a.getElementById("branch-sms-send"), g = a.getElementById("branch-loader-wrapper"), h = a.getElementById("branch-sms-form-container"), k, l = function() {
    f.removeAttribute("disabled");
    e.removeAttribute("disabled");
    f.style.opacity = "1";
    e.style.opacity = "1";
    g.style.opacity = "0";
  }, n = function() {
    k = a.createElement("div");
    k.className = "branch-icon-wrapper";
    k.id = "branch-checkmark";
    k.style = "opacity: 0;";
    k.innerHTML = banner_html.checkmark();
    h.appendChild(k);
    f.style.opacity = "0";
    e.style.opacity = "0";
    g.style.opacity = "0";
    setTimeout(function() {
      k.style.opacity = "1";
    }, banner_utils.animationDelay);
    e.value = "";
  }, m = function() {
    l();
    f.style.background = "#FFD4D4";
    e.className = "error";
    setTimeout(function() {
      f.style.background = "#FFFFFF";
      e.className = "";
    }, banner_utils.error_timeout);
  };
  if (e) {
    var p = e.value;
    /^\d{7,}$/.test(p.replace(/[\s()+\-\.]|ext/gi, "")) ? (b._publishEvent("willSendBannerSMS"), f.setAttribute("disabled", ""), e.setAttribute("disabled", ""), f.style.opacity = ".4", e.style.opacity = ".4", g.style.opacity = "1", e.className = "", b.sendSMS(p, d, c, function(a) {
      a ? (b._publishEvent("sendBannerSMSError"), m()) : (b._publishEvent("didSendBannerSMS"), n(), setTimeout(function() {
        h.removeChild(k);
        l();
      }, banner_utils.success_timeout));
    })) : m();
  }
}, banner = function(a, b, c, d) {
  if (!banner_utils.shouldAppend(d, b)) {
    return a._publishEvent("willNotShowBanner"), null;
  }
  a._publishEvent("willShowBanner");
  var e = banner_html.markup(b, d);
  banner_css.css(b, e);
  c.channel = c.channel || "app banner";
  var f = b.iframe ? e.contentWindow.document : document;
  if (utils.mobileUserAgent()) {
    var g = a._referringLink();
    g && !b.make_new_link ? f.getElementById("branch-mobile-action").href = g : a.link(c, function(a, b) {
      a || (f.getElementById("branch-mobile-action").href = b);
    });
  } else {
    f.getElementById("sms-form").addEventListener("submit", function(d) {
      d.preventDefault();
      sendSMS(f, a, b, c);
    });
  }
  var g = banner_utils.getBodyStyle("margin-top"), h = document.body.style.marginTop, k = banner_utils.getBodyStyle("margin-bottom"), l = document.body.style.marginBottom, n = f.getElementById("branch-banner-close"), m = function(a) {
    setTimeout(function() {
      banner_utils.removeElement(e);
      banner_utils.removeElement(document.getElementById("branch-css"));
      a();
    }, banner_utils.animationSpeed + banner_utils.animationDelay);
    setTimeout(function() {
      "top" === b.position ? document.body.style.marginTop = h : "bottom" === b.position && (document.body.style.marginBottom = l);
      banner_utils.removeClass(document.body, "branch-banner-is-active");
    }, banner_utils.animationDelay);
    "top" === b.position ? e.style.top = "-" + banner_utils.bannerHeight : "bottom" === b.position && (e.style.bottom = "-" + banner_utils.bannerHeight);
    "number" === typeof b.forgetHide ? d.set("hideBanner", banner_utils.getDate(b.forgetHide)) : d.set("hideBanner", !0);
  };
  n && (n.onclick = function(b) {
    b.preventDefault();
    a._publishEvent("willCloseBanner");
    m(function() {
      a._publishEvent("didCloseBanner");
    });
  });
  banner_utils.addClass(document.body, "branch-banner-is-active");
  "top" === b.position ? document.body.style.marginTop = banner_utils.addCSSLengths(banner_utils.bannerHeight, g) : "bottom" === b.position && (document.body.style.marginBottom = banner_utils.addCSSLengths(banner_utils.bannerHeight, k));
  setTimeout(function() {
    "top" === b.position ? e.style.top = "0" : "bottom" === b.position && (e.style.bottom = "0");
    a._publishEvent("didShowBanner");
  }, banner_utils.animationDelay);
  return m;
};
// Input 13
var default_branch, callback_params = {NO_CALLBACK:0, CALLBACK_ERR:1, CALLBACK_ERR_DATA:2}, init_states = {NO_INIT:0, INIT_PENDING:1, INIT_FAILED:2, INIT_SUCCEEDED:3}, wrap = function(a, b, c) {
  return function() {
    var d = this, e, f, g = arguments[arguments.length - 1];
    a === callback_params.NO_CALLBACK || "function" !== typeof g ? (f = function(a) {
      if (a) {
        throw a;
      }
    }, e = Array.prototype.slice.call(arguments)) : (e = Array.prototype.slice.call(arguments, 0, arguments.length - 1) || [], f = g);
    d._queue(function(g) {
      var k = function(b, c) {
        if (b && a === callback_params.NO_CALLBACK) {
          throw b;
        }
        a === callback_params.CALLBACK_ERR ? f(b) : a === callback_params.CALLBACK_ERR_DATA && f(b, c);
        g();
      };
      if (!c) {
        if (d.init_state === init_states.INIT_PENDING) {
          return k(Error(utils.message(utils.messages.initPending)), null);
        }
        if (d.init_state === init_states.INIT_FAILED) {
          return k(Error(utils.message(utils.messages.initFailed)), null);
        }
        if (d.init_state === init_states.NO_INIT || !d.init_state) {
          return k(Error(utils.message(utils.messages.nonInit)), null);
        }
      }
      e.unshift(k);
      b.apply(d, e);
    });
  };
}, Branch = function() {
  if (!(this instanceof Branch)) {
    return default_branch || (default_branch = new Branch), default_branch;
  }
  this._queue = task_queue();
  var a = [];
  CORDOVA_BUILD ? a = ["local"] : TITANIUM_BUILD ? a = ["titanium"] : WEB_BUILD && (a = utils.mobileUserAgent() ? ["local", "permcookie"] : ["session", "cookie"]);
  a.push("pojo");
  this._storage = new BranchStorage(a);
  this._server = new Server;
  a = "web";
  this._listeners = [];
  CORDOVA_BUILD && (a = "cordova");
  TITANIUM_BUILD && (a = "titanium");
  this.sdk = a + config.version;
  if (CORDOVA_BUILD || TITANIUM_BUILD) {
    this.debug = !1;
  }
  this.init_state = init_states.NO_INIT;
};
Branch.prototype._api = function(a, b, c) {
  this.app_id && (b.app_id = this.app_id);
  this.branch_key && (b.branch_key = this.branch_key);
  (a.params && a.params.session_id || a.queryPart && a.queryPart.session_id) && this.session_id && (b.session_id = this.session_id);
  (a.params && a.params.identity_id || a.queryPart && a.queryPart.identity_id) && this.identity_id && (b.identity_id = this.identity_id);
  (a.params && a.params.link_click_id || a.queryPart && a.queryPart.link_click_id) && this.link_click_id && (b.link_click_id = this.link_click_id);
  (a.params && a.params.sdk || a.queryPart && a.queryPart.sdk) && this.sdk && (b.sdk = this.sdk);
  (CORDOVA_BUILD || TITANIUM_BUILD) && (a.params && a.params.device_fingerprint_id || a.queryPart && a.queryPart.device_fingerprint_id) && this.device_fingerprint_id && (b.device_fingerprint_id = this.device_fingerprint_id);
  WEB_BUILD && (a.params && a.params.browser_fingerprint_id || a.queryPart && a.queryPart.browser_fingerprint_id) && this.browser_fingerprint_id && (b.browser_fingerprint_id = this.browser_fingerprint_id);
  return this._server.request(a, b, this._storage, function(a, b) {
    c(a, b);
  });
};
Branch.prototype._referringLink = function() {
  var a = session.get(this._storage);
  return (a = a && a.referring_link) ? a : (a = this._storage.get("click_id")) ? config.link_service_endpoint + "/c/" + a : null;
};
Branch.prototype._publishEvent = function(a) {
  for (var b = 0;b < this._listeners.length;b++) {
    this._listeners[b].event && this._listeners[b].event !== a || this._listeners[b].listener(a);
  }
};
if (CORDOVA_BUILD || TITANIUM_BUILD) {
  Branch.prototype.setDebug = function(a) {
    this.debug = a;
  };
}
Branch.prototype.init = wrap(callback_params.CALLBACK_ERR_DATA, function(a, b, c) {
  var d = this;
  d.init_state = init_states.INIT_PENDING;
  utils.isKey(b) ? d.branch_key = b : d.app_id = b;
  c = c && "function" === typeof c ? {isReferrable:null} : c;
  TITANIUM_BUILD && "android" === Ti.Platform.osname && (d.keepAlive = !0);
  var e = function(a) {
    a.session_id && (d.session_id = a.session_id.toString());
    a.identity_id && (d.identity_id = a.identity_id.toString());
    a.link && (d.sessionLink = a.link);
    a.referring_link && (a.referring_link = utils.processReferringLink(a.referring_link));
    !a.click_id && a.referring_link && (a.click_id = utils.clickIdFromLink(a.referring_link));
    if (CORDOVA_BUILD || TITANIUM_BUILD) {
      d.device_fingerprint_id = a.device_fingerprint_id, a.link_click_id && (d.link_click_id = a.link_click_id);
    }
    WEB_BUILD && (d.browser_fingerprint_id = a.browser_fingerprint_id);
    return a;
  };
  b = c && "undefined" !== typeof c.isReferrable && null !== c.isReferrable ? c.isReferrable : null;
  var f = session.get(d._storage);
  c = c && "undefined" !== typeof c.url && null !== c.url ? c.url : null;
  var g = WEB_BUILD ? utils.getParamValue("_branch_match_id") || utils.hashValue("r") : c ? utils.getParamValue(c) : null, h = !f || !f.identity_id, k = function(a, b) {
    WEB_BUILD && d._api(resources._r, {sdk:config.version}, function(a, b) {
      b && (c.browser_fingerprint_id = b);
    });
    var c = a || session.get(d._storage);
    d._api(resources.hasApp, {browser_fingerprint_id:c.browser_fingerprint_id}, function(a, e) {
      e && !c.has_app && (c.has_app = !0, session.update(d._storage, c), d._publishEvent("didDownloadApp"));
      b && b(a, c);
    });
  }, l = function(b, c) {
    c && (c = e(c), session.set(d._storage, c, h), d.init_state = init_states.INIT_SUCCEEDED, c.data_parsed = c.data ? goog.json.parse(c.data) : null);
    b && (d.init_state = init_states.INIT_FAILED);
    d.keepAlive && setTimeout(function() {
      d.keepAlive = !1;
    }, 2E3);
    a(b, c && utils.whiteListSessionData(c));
  }, n = function() {
    var a, b;
    "undefined" !== typeof document.hidden ? (a = "hidden", b = "visibilitychange") : "undefined" !== typeof document.mozHidden ? (a = "mozHidden", b = "mozvisibilitychange") : "undefined" !== typeof document.msHidden ? (a = "msHidden", b = "msvisibilitychange") : "undefined" !== typeof document.webkitHidden && (a = "webkitHidden", b = "webkitvisibilitychange");
    b && document.addEventListener(b, function() {
      document[a] || k(null, null);
    }, !1);
  };
  if (WEB_BUILD && f && f.session_id && (utils.processReferringLink(g) === f.referring_link || g === f.click_id)) {
    n(), k(f, l);
  } else {
    if (WEB_BUILD) {
      d._api(resources._r, {sdk:config.version}, function(a, b) {
        if (a) {
          return l(a, null);
        }
        d._api(resources.open, {link_identifier:g, is_referrable:1, browser_fingerprint_id:b}, function(a, b) {
          b && g && (b.click_id = g);
          n();
          l(a, b);
        });
      });
    } else {
      if (c = function(a) {
        h || (a.identity_id = f.identity_id, a.device_fingerprint_id = f.device_fingerprint_id);
        d._api(h ? resources.install : resources.open, a, function(a, b) {
          l(a, b);
        });
      }, CORDOVA_BUILD) {
        var m = [];
        null !== b && m.push(b ? 1 : 0);
        cordova.require("cordova/exec")(c, function() {
          a("Error getting device data!");
        }, "BranchDevice", h ? "getInstallData" : "getOpenData", m);
      } else {
        if (TITANIUM_BUILD) {
          var m = {}, p = require("io.branch.sdk");
          g && (m.link_identifier = g);
          m = h ? p.getInstallData(d.debug, null === b ? -1 : b ? 1 : 0) : p.getOpenData(null === b ? -1 : b ? 1 : 0);
          c(m);
        }
      }
    }
  }
}, !0);
Branch.prototype.data = wrap(callback_params.CALLBACK_ERR_DATA, function(a) {
  var b = utils.whiteListSessionData(session.get(this._storage));
  b.referring_link = this._referringLink();
  a(null, b);
});
Branch.prototype.first = wrap(callback_params.CALLBACK_ERR_DATA, function(a) {
  a(null, utils.whiteListSessionData(session.get(this._storage, !0)));
});
Branch.prototype.setIdentity = wrap(callback_params.CALLBACK_ERR_DATA, function(a, b) {
  var c = this;
  this._api(resources.profile, {identity:b}, function(d, e) {
    d && a(d);
    e = e || {};
    c.identity_id = e.identity_id ? e.identity_id.toString() : null;
    c.sessionLink = e.link;
    c.identity = b;
    e.referring_data_parsed = e.referring_data ? goog.json.parse(e.referring_data) : null;
    session.update(c._storage, e);
    a(null, e);
  });
});
Branch.prototype.logout = wrap(callback_params.CALLBACK_ERR, function(a) {
  var b = this;
  this._api(resources.logout, {}, function(c, d) {
    c && a(c);
    d = d || {};
    d = {data_parsed:null, data:null, referring_link:null, click_id:null, link_click_id:null, identity:null, session_id:d.session_id, identity_id:d.identity_id, link:d.link, device_fingerprint_id:b.device_fingerprint_id || null};
    b.sessionLink = d.link;
    b.session_id = d.session_id;
    b.identity_id = d.identity_id;
    b.identity = d.identity;
    session.update(b._storage, d);
    a(c);
  });
});
if (CORDOVA_BUILD || TITANIUM_BUILD) {
  Branch.prototype.close = wrap(callback_params.CALLBACK_ERR, function(a) {
    var b = this;
    if (this.keepAlive) {
      return a(null);
    }
    this._api(resources.close, {}, function(c, d) {
      delete b.session_id;
      delete b.sessionLink;
      b.init_state = init_states.NO_INIT;
      b._storage.clear();
      a(null);
    });
  });
}
Branch.prototype.track = wrap(callback_params.CALLBACK_ERR, function(a, b, c) {
  c || (c = {});
  TITANIUM_BUILD ? this._api(resources.event, {event:b, metadata:c || {}}, a) : this._api(resources.event, {event:b, metadata:utils.merge({url:document.URL, user_agent:navigator.userAgent, language:navigator.language}, c || {})}, a);
});
Branch.prototype.link = wrap(callback_params.CALLBACK_ERR_DATA, function(a, b) {
  this._api(resources.link, utils.cleanLinkData(b, config), function(b, d) {
    a(b, d && d.url);
  });
});
Branch.prototype.sendSMS = wrap(callback_params.CALLBACK_ERR, function(a, b, c, d) {
  function e(c) {
    f._api(resources.SMSLinkSend, {link_url:c, phone:b}, a);
  }
  var f = this;
  if ("function" === typeof d) {
    d = {};
  } else {
    if ("undefined" === typeof d || null === d) {
      d = {};
    }
  }
  d.make_new_link = d.make_new_link || !1;
  c.channel && "app banner" !== c.channel || (c.channel = "sms");
  var g = f._referringLink();
  g && !d.make_new_link ? e(g.substring(g.lastIndexOf("/") + 1, g.length)) : f._api(resources.link, utils.cleanLinkData(c, config), function(b, c) {
    if (b) {
      return a(b);
    }
    f._api(resources.linkClick, {link_url:"l/" + c.url.split("/").pop(), click:"click"}, function(b, c) {
      if (b) {
        return a(b);
      }
      f._storage.set("click_id", c.click_id);
      e(c.click_id);
    });
  });
});
Branch.prototype.referrals = wrap(callback_params.CALLBACK_ERR_DATA, function(a) {
  this._api(resources.referrals, {}, a);
});
Branch.prototype.getCode = wrap(callback_params.CALLBACK_ERR_DATA, function(a, b) {
  b.type = "credit";
  b.creation_source = b.creation_source || 2;
  this._api(resources.getCode, b, a);
});
Branch.prototype.validateCode = wrap(callback_params.CALLBACK_ERR, function(a, b) {
  this._api(resources.validateCode, {code:b}, a);
});
Branch.prototype.applyCode = wrap(callback_params.CALLBACK_ERR, function(a, b) {
  this._api(resources.applyCode, {code:b}, a);
});
Branch.prototype.credits = wrap(callback_params.CALLBACK_ERR_DATA, function(a) {
  this._api(resources.credits, {}, a);
});
Branch.prototype.creditHistory = wrap(callback_params.CALLBACK_ERR_DATA, function(a, b) {
  this._api(resources.creditHistory, b || {}, a);
});
Branch.prototype.redeem = wrap(callback_params.CALLBACK_ERR, function(a, b, c) {
  this._api(resources.redeem, {amount:b, bucket:c}, a);
});
WEB_BUILD && (Branch.prototype.addListener = function(a, b) {
  "function" === typeof a && void 0 === b && (b = a);
  b && this._listeners.push({listener:b, event:a || null});
}, Branch.prototype.removeListener = function(a) {
  a && (this._listeners = this._listeners.filter(function(b) {
    if (b.listener !== a) {
      return b;
    }
  }));
}, Branch.prototype.banner = wrap(callback_params.NO_CALLBACK, function(a, b, c) {
  "undefined" === typeof b.showAgain && "undefined" !== typeof b.forgetHide && (b.showAgain = b.forgetHide);
  var d = {icon:b.icon || "", title:b.title || "", description:b.description || "", openAppButtonText:b.openAppButtonText || "View in app", downloadAppButtonText:b.downloadAppButtonText || "Download App", sendLinkText:b.sendLinkText || "Send Link", phonePreviewText:b.phonePreviewText || "(999) 999-9999", iframe:"undefined" === typeof b.iframe ? !0 : b.iframe, showiOS:"undefined" === typeof b.showiOS ? !0 : b.showiOS, showiPad:"undefined" === typeof b.showiPad ? !0 : b.showiPad, showAndroid:"undefined" === 
  typeof b.showAndroid ? !0 : b.showAndroid, showDesktop:"undefined" === typeof b.showDesktop ? !0 : b.showDesktop, disableHide:!!b.disableHide, forgetHide:"number" === typeof b.forgetHide ? b.forgetHide : !!b.forgetHide, position:b.position || "top", customCSS:b.customCSS || "", mobileSticky:"undefined" === typeof b.mobileSticky ? !1 : b.mobileSticky, desktopSticky:"undefined" === typeof b.desktopSticky ? !0 : b.desktopSticky, make_new_link:!!b.make_new_link};
  "undefined" !== typeof b.showMobile && (d.showiOS = b.showMobile, d.showAndroid = b.showMobile);
  this.closeBannerPointer = banner(this, d, c, this._storage);
  a();
}), Branch.prototype.closeBanner = wrap(0, function(a) {
  if (this.closeBannerPointer) {
    var b = this;
    this._publishEvent("willCloseBanner");
    this.closeBannerPointer(function() {
      b._publishEvent("didCloseBanner");
    });
  }
  a();
}));
// Input 14
var branch_instance = new Branch;
if (!TITANIUM_BUILD && window.branch && window.branch._q) {
  for (var queue = window.branch._q, i = 0;i < queue.length;i++) {
    var task = queue[i];
    branch_instance[task[0]].apply(branch_instance, task[1]);
  }
}
"function" === typeof define && define.amd ? define("branch", function() {
  return branch_instance;
}) : "object" === typeof exports && (module.exports = branch_instance);
TITANIUM_BUILD || window && (window.branch = branch_instance);
CORDOVA_BUILD && document.addEventListener("pause", function() {
  console.log("Closing branch session on pause event.");
  branch_instance.close(function() {
  });
}, !1);
})();
