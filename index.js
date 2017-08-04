const ACTION_TYPE = "__redux_builder"

class Base {
    constructor () {
        this._before = []
        this._after = []
        this._namespace = []
        this._matchers = []
        this._updater = nullUpdater
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
    onState (matchState, ...args) {
        const updater = args.pop()
        const pattern = [...this._namespace, ...args]
        this._matchers.push({
            pattern,
            matchState,
            handlers: [
                ...this._before,
                (action) => updater(...this._spreadArguments(pattern, action)),
                ...this._after
            ]
        })
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
    _matchPattern (matcher, action, state) {
        const { pattern, matchState } = matcher
        if (matchState && !match(matchState, state)) { return false }

        // made by redux builder middleware
        if (action.type === ACTION_TYPE) {
            return pattern.every((matcher, i) => match(matcher, action.payload[i], state))
        // "regular" action with type field
        } else {
            return match(pattern[0], action, state)
        }
    }
}

class Handler extends Base {
    // state updating functions
    // TODO: batch sets into a single operation
    // TODO: keys path? set("foo", "bar", "baz", getValue)
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

    // handlers
    setter (...setters) {
        for (const key of setters) {
            this.on(key, undefined, (value) => this.set(key, () => value))
        }
        return this
    }

    run (state = this._initState, action) {
        let nextState = state
        this._updater = (fn) => { nextState = fn(nextState, action) }

        let handled = false
        for (const matcher of this._matchers) {
            if (this._matchPattern(matcher, action, state)) {
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

class Middleware extends Base {
    // pass action unaltered
    continue () {
        this._updater((_, next, action) => next(action))
        return this
    }
    // pass action
    next (...values) {
        this._updater((_, next) => next(mapAction(values)))
        return this
    }
    // pass plain action
    nextRaw (action) {
        this._updater((_, next) => next(action))
        return this
    }

    dispatch (...values) {
        this._updater((store) => store.dispatch(mapAction(...values)))
        return this
    }
    dispatchRaw (action) {
        this._updater((store) => store.dispatch(action))
        return this
    }

    run (store, next, action) {
        let nextAction = action
        this._updater = (fn) => { nextAction = fn(store, next, nextAction) }

        let handled = false
        const state = store.getState()
        for (const matcher of this._matchers) {
            if (this._matchPattern(matcher.pattern, action, state)) {
                for (const handler of matcher.handlers) { handler(action) }
                handled = true
                break
            }
        }
        if (!handled) { next(action) }

        this._updater = nullUpdater
        return nextAction
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
    const handler = new Handler()
    cb(handler)
    return (state, action) => handler.run(state, action)
}

function createMiddleware (cb) {
    const middleware = new Middleware()
    cb(middleware)
    return (store) => (next) => (action) => middleware.run(store, next, action)
}

function mapAction (...action) {
    return {
        type: ACTION_TYPE,
        payload: action
    }
}

const builderActionMiddleware = (store) => (next) => (action) => {
    if (Array.isArray(action)) {
        return next({
            type: ACTION_TYPE,
            payload: action
        })
    } else {
        return next(action)
    }
}

function nullUpdater () {
    throw new Error("Updater functions (.set, .update) can only be called in handlers")
}

module.exports = { createHandler, createMiddleware, builderActionMiddleware, mapAction }
