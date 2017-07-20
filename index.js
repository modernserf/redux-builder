const nullUpdater = {
    push: () => {
        throw new Error("Updater functions (.set, .update) can only be called in handlers")
    }
}

const ACTION_TYPE = "__redux_builder"

class Handler {
    constructor (build) {
        this._before = []
        this._after = []
        this._namespace = []
        // TODO: replace list with object map
        this._matchers = []
        this._updaters = nullUpdater
        build(this)
    }

    // state updating functions
    // TODO: batch sets into a single operation
    // TODO: _updaters is undefined except during run cycle
    set (key, value) {
        this._updaters.push((state) => ({ ...state, [key]: value }))
    }
    update (reducer) {
        this._updaters.push(reducer)
    }
    // pattern helpers
    // handle nullable value
    optional (matcher) {
        return (value) => value === null || value === undefined || match(matcher, value)
    }
    // TODO: oneOf, oneOfType, arrayOf, shape, etc.

    // handlers
    on (...args) {
        const updater = args.pop()
        const pattern = [...this._namespace, ...args]
        this._matchers.push({
            pattern,
            handlers: [
                ...this._before,
                (state, action) => updater(state, ...this._spreadArguments(pattern, action)),
                ...this._after
            ]
        })
    }
    setter (...setters) {
        for (const key of setters) {
            this.on(key, undefined, (state, value) => this.set(key, value))
        }
    }
    beforeEach (...updaters) {
        this._before = this._before.concat(this._mapHookUpdaters(updaters))
    }
    afterEach (...updaters) {
        this._after = this._after.concat(this._mapHookUpdaters(updaters))
    }

    // helpers
    _mapHookUpdaters (updaters) {
        return updaters.map((u) => (state, action) => u(this, state, action))
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
    _matchPattern (pattern, action) {
        // made by redux builder middleware
        if (action.type === ACTION_TYPE) {
            for (let i = 0; i < pattern.length; i++) {
                if (!match(pattern[i], action.payload[i])) {
                    return false
                }
            }
            return true
        // "regular" action with type field
        } else {
            return pattern.length === 2 &&
                match(pattern[0], action.type) &&
                match(pattern[1], action)
        }
    }

    run (state, action) {
        this._updaters = []
        let nextState = state
        for (const matcher of this._matchers) {
            if (this._matchPattern(matcher.pattern, action)) {
                nextState = matcher.handlers.reduce((s, handler) => handler(s, action), nextState)
                break
            }
        }
        this._updaters = nullUpdater

        return nextState
    }
}

function isConstant (value) {
    return ["string", "number", "boolean", "symbol"].indexOf(typeof value) !== -1
}

function match (matcher, value) {
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
        return (value instanceof matcher) || matcher(value)

    // TODO: should these be "raw" or handled by t.arrayOf, t.shape etc helpers?
    case "object":
        if (!value) { return false }

        // match arrays (recursive shape)
        // pattern [Number] matches [1], [1,2,3], [1,2,3,4,5...]
        // pattern [Number, String] matches [1, "foo"], [1, "foo", 2, "bar"...]
        if (Array.isArray(matcher)) {
            if (!Array.isArray(value) || matcher.length > value.length) { return false }

            for (let i = 0; i < value.length; i++) {
                if (!match(matcher[i % matcher.length], value[i])) {
                    return false
                }
            }
            return true
        }
        // match object (value is superset of pattern)
        for (const key in matcher) {
            if (!value.hasOwnProperty(key)) { return false }
            if (!match(matcher[key], value[key])) { return false }
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

function mapAction (action) {
    return {
        type: ACTION_TYPE,
        payload: action
    }
}

function createBuilderMiddleware () {
    return (store) => (next) => (action) => {
        if (Array.isArray(action)) {
            return next(mapAction(action))
        } else {
            return next(action)
        }
    }
}

module.exports = { createHandler, createBuilderMiddleware, mapAction }
