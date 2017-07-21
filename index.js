const ACTION_TYPE = "__redux_builder"

class Handler {
    constructor (builder) {
        this._before = []
        this._after = []
        this._namespace = []
        this._matchers = []
        this._updater = nullUpdater
        builder(this)
    }

    // pattern helpers (return value, not fluent)
    optional (matcher) {
        return (value, state) => value === null || value === undefined || match(matcher, value, state)
    }
    oneOf (...matchers) {
        return (value, state) => matchers.some((matcher) => match(matcher, value, state))
    }
    arrayOf (matcher) {
        return (arr, state) => Array.isArray(arr) && arr.every((value) => match(matcher, value, state))
    }
    objectOf (matcher) {
        return (obj, state) => obj && Object.values(obj).every((value) => match(matcher, value, state))
    }

    // state updating functions
    // TODO: batch sets into a single operation
    set (key, value) {
        this._updater((state) => Object.assign({}, state, { [key]: value(state) }))
        return this
    }
    merge (mapper, ...args) {
        this._updater((state) => Object.assign({}, state, mapper(state, ...args)))
        return this
    }
    update (reducer) {
        this._updater(reducer)
        return this
    }

    initState (state) {
        if (this._initState) { throw new Error(".initState can only be called once per handler") }
        this._initState = state
        return this
    }

    namespace (...args) {
        if (args.length === 1 && typeof args === "function") {
            this._namespace = args[0](this._namespace)
        } else {
            this._namespace = this._namespace.concat(args)
        }
        return this
    }

    // handlers
    on (...args) {
        const updater = args.pop()
        const pattern = [...this._namespace, ...args]
        this._matchers.push({
            pattern,
            handlers: [
                ...this._before,
                (action) => updater(...this._spreadArguments(pattern, action)),
                ...this._after
            ]
        })
        return this
    }
    setter (...setters) {
        for (const key of setters) {
            this.on(key, undefined, (value) => this.set(key, () => value))
        }
        return this
    }
    beforeEach (...updaters) {
        this._before = this._before.concat(this._mapHookUpdaters(updaters))
        return this
    }
    afterEach (...updaters) {
        this._after = this._after.concat(this._mapHookUpdaters(updaters))
        return this
    }
    otherwise (handler) {
        if (this._otherwise) { throw new Error(".otherwise can only be called once per handler") }
        this._otherwise = handler
        return this
    }

    // helpers
    _mapHookUpdaters (updaters) {
        return updaters.map((u) => () => u(this))
    }
    _spreadArguments (pattern, action) {
        // made by redux builder middleware
        if (action.type === ACTION_TYPE) {
            // remove constant patterns from action args
            return action.payload.filter((_, i) => !isConstant(pattern[i]))
        } else {
            return [action]
        }
    }
    _matchPattern (pattern, action, state) {
        // made by redux builder middleware
        if (action.type === ACTION_TYPE) {
            return pattern.every((matcher, i) => match(matcher, action.payload[i], state))
        // "regular" action with type field
        } else if (pattern.length === 2) {
            return pattern[0] === action.type && match(pattern[1], action, state)
        // regular action without payload
        } else if (pattern.length === 1) {
            return pattern[0] === action.type
        } else {
            return false
        }
    }

    run (state = this._initState, action) {
        let nextState = state
        this._updater = (fn) => { nextState = fn(nextState, action) }

        let handled = false
        for (const matcher of this._matchers) {
            if (this._matchPattern(matcher.pattern, action, state)) {
                for (const handler of matcher.handlers) { handler(action) }
                handled = true
                break
            }
        }
        if (!handled && this._otherwise) { this._otherwise(action) }

        this._updater = nullUpdater
        return nextState
    }
}

function isConstant (value) {
    return ["string", "number", "boolean", "symbol"].indexOf(typeof value) !== -1
}

function isInstanceOf (value, constructor) {
    switch (constructor) {
    case Number:
        return typeof value === "number"
    case String:
        return typeof value === "string"
    case Boolean:
        return typeof value === "boolean"
    case Symbol:
        return typeof value === "symbol"
    case Array:
        return Array.isArray(value)
    default:
        return value instanceof constructor
    }
}

function match (matcher, value, state) {
    // match anything except a null-ish value
    if (matcher === undefined || matcher === null) {
        return (value !== null && value !== undefined)
    }

    switch (typeof matcher) {
    // match primitive value
    case "string":
    case "number":
    case "boolean":
    case "symbol":
        return matcher === value

    case "function":
        return isInstanceOf(value, matcher) || matcher(value, state) === true

    case "object":
        if (!value) { return false }

        // match object (value is superset of pattern)
        for (const key in matcher) {
            if (!value.hasOwnProperty(key)) { return false }
            if (!match(matcher[key], value[key], state)) { return false }
        }
        return true
    default:
        throw new Error("unhandled pattern matcher", matcher, value)
    }
}

function createHandler (cb) {
    const handler = new Handler(cb)
    return (state, action) => handler.run(state, action)
}

function mapAction (...action) {
    return {
        type: ACTION_TYPE,
        payload: action
    }
}

// TODO: builder middleware API
// createMiddleware((t) => t
// .namespace("counter")
// .on("foo", __, "bar", __, (state, fooArg, barArg) => t
// .continue() // pass action unaltered
// .next("foo", fooArg, "bar", barArg, "withFlag", "flag"))
// .dispatch("foo", 3, "bar", 4)
// .dispatchRaw({ type: "foo" })
// )
// )

function createBuilderMiddleware () {
    return (store) => (next) => (action) => {
        if (Array.isArray(action)) {
            return next({
                type: ACTION_TYPE,
                payload: action
            })
        } else {
            return next(action)
        }
    }
}

function nullUpdater () {
    throw new Error("Updater functions (.set, .update) can only be called in handlers")
}

module.exports = { createHandler, createBuilderMiddleware, mapAction }
