/*global module:true*/
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(factory);
    } else if (typeof exports === 'object') {
        module.exports = factory();
    } else {
        root.Extensible = factory();
    }
}(this, function () {

// From http://gomakethings.com/ditching-jquery/#extend
var extend = function ( objects ) {
    var extended = {};
    var merge = function (obj) {
        for (var prop in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, prop)) {
                extended[prop] = obj[prop];
            }
        }
    };
    merge(arguments[0]);
    for (var i = 1; i < arguments.length; i++) {
        var obj = arguments[i];
        merge(obj);
    }
    return extended;
};

// Deep extend to one level.
var extendOptions = function (defaults, options) {
    var ret = extend({}, defaults);

    for (var k in options) {
        ret[k] = extend(ret[k], options[k]);
    }
    ret.exts = options.exts;
    return ret;
};


function Extensible(defaults, methods, rootProperties) {
    this.rootProperties = rootProperties || [];
    this.defaults = {core: defaults};
    this.methods = methods; 
    this.inits = {};
}

Extensible.prototype.addExtension = function (extName, defaults, methods) {
    this.defaults[extName] = defaults;

    for (var methodName in methods) {
        var method = methods[methodName];

        if (methodName === 'init') {
            this.inits[extName] = method;
            continue;
        }

        method.extension = extName;
        method.old = this.methods[methodName];

        var wrappedMethod = this.wrapMethod(extName, methodName, method);
        wrappedMethod.old = method.old;
        wrappedMethod.extension = extName;

        if (methodName.indexOf('_') === 0 && this.methods[methodName]) {
            throw new Error("Duplicate private method: " + methodName);
        }

        this.methods[methodName] = wrappedMethod;
    }
};

Extensible.prototype.wrapMethod = function (extName, methodName, method) {
    return function () {
        var args = Array.prototype.slice.call(arguments),
            extensions = this.opts.extensions;
        // Go through methods of this name until finding one belonging to an
        // enabled ext or core, stopping if none exists.
        do {
            if (!method.extension || extensions.indexOf(method.extension) !== -1) {
                break;
            }
            method = method.old;
        } while (method);
        if (!method) { return; }

        // Call private methods normally.
        if (methodName.indexOf('_') === 0) {
            return method.apply(this, args);
        }

        // Call actual method with a super() method added to the context
        // that calls the next copy of this method in the ext stack. It
        // uses the original arguments if none are specified.
        // Call core methods normally.
        if (method.old) {
            return method.apply(
                extend({}, this, {
                    super: function (replaceArguments) {
                        return method.old.apply(this, (replaceArguments ?
                          Array.prototype.slice.call(arguments) : args));
                    }
                }),
                args);
        } else {
            return method.apply(this, args);
        }
    };
};

Extensible.prototype.makeInstance = function (options) {
    options = extendOptions(this.defaults, options);
    var extensions = options.extensions,
        instance = extend({}, this.methods);

    instance.opts = options;

    // Initialize data.
    instance.data = {core: {}};
    for (var i = 0; i < extensions.length; i++) {
        instance.data[extensions[i]] = {};
    }

    // Initialize core.
    if (this.methods.init) {
        this.methods.init.apply(instance);
    }

    // Initialize enabled exts.
    for (i = 0; i < extensions.length; i++) {
        var init = this.inits[extensions[i]];
        if (init) {
            init.apply(instance);
        }
    }
    
    return instance;
};

    return Extensible;
}));
