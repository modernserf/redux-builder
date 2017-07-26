const test = require("tape")
const { createHandler, mapAction } = require("./index")

test("basic action handling", (t) => {
    let state = { count: 0 }

    const reducer = createHandler((b) => b
        .on("increment", () => b
            .set("count", ({ count }) => count + 1))
        .on("decrement", () => b
            .set("count", ({ count }) => count - 1)))

    state = reducer(state, mapAction("increment"))
    t.deepEquals(state, { count: 1 })

    state = reducer(state, mapAction("decrement"))
    state = reducer(state, mapAction("decrement"))
    t.deepEquals(state, { count: -1 })
    t.end()
})

test(".initState", (t) => {
    let state = { count: 0 }

    const reducer = createHandler((b) => b
        .initState(state)
        .on("increment", () => b
            .set("count", ({ count }) => count + 1)))

    state = reducer(undefined, { type: "@init" })
    t.deepEquals(state, { count: 0 })
    state = reducer(state, mapAction("increment"))
    t.deepEquals(state, { count: 1 })
    t.end()
})

test(".initState can only be called once", (t) => {
    let state = { count: 0 }

    t.throws(() => {
        createHandler((b) => b
            .initState(state)
            .initState(state)
            .on("increment", () => b
                .set("count", ({ count }) => count + 1)))
    })
    t.end()
})

test("pattern matching", (t) => {
    let state = { count: 0 }

    const reducer = createHandler((b) => b
        .on("increment", () => b
            .set("count", ({ count }) => count + 1))
        .on("decrement", () => b
            .set("count", ({ count }) => count - 1))
        .on("add", Number, (number) => b
            .set("count", ({ count }) => count + number))
        .on("reset", () => b.set("count", () => 0)))

    state = reducer(state, mapAction("increment"))
    t.deepEquals(state, { count: 1 })

    state = reducer(state, mapAction("add", 3))
    t.deepEquals(state, { count: 4 })

    state = reducer(state, mapAction("add", "4"))
    t.deepEquals(state, { count: 4 })

    state = reducer(state, mapAction("reset"))
    t.deepEquals(state, { count: 0 })

    t.end()
})

test("namespace", (t) => {
    let state = { count: 0 }

    const reducer = createHandler((b) => b
        .namespace("counter")
        .on("increment", () => b
            .set("count", ({ count }) => count + 1))
        .on("decrement", () => b
            .set("count", ({ count }) => count - 1)))

    state = reducer(state, mapAction("counter", "increment"))
    t.deepEquals(state, { count: 1 })
    state = reducer(state, mapAction("increment"))
    t.deepEquals(state, { count: 1 })
    t.end()
})

test("setters", (t) => {
    let state = {
        foo: 0,
        bar: 0
    }
    const reducer = createHandler((b) => b
        .setter("foo", "bar"))

    state = reducer(state, mapAction("foo", 12))
    t.deepEquals(state, { foo: 12, bar: 0 })
    state = reducer(state, mapAction("baz", 20))
    t.deepEquals(state, { foo: 12, bar: 0 })
    t.end()
})

test("hooks", (t) => {
    let state = {
        foo: 0,
        bar: 0,
        count: 0
    }

    const incrementCounter = (b) => b.set("count", ({ count }) => count + 1)
    const reducer = createHandler((b) => b
        .beforeEach(incrementCounter)
        .setter("foo", "bar"))

    state = reducer(state, mapAction("foo", 12))
    t.deepEquals(state, { foo: 12, bar: 0, count: 1 })
    state = reducer(state, mapAction("baz", 20))
    t.deepEquals(state, { foo: 12, bar: 0, count: 1 })
    t.end()
})

test("merge acts like setState", (t) => {
    let state = {
        foo: 0,
        bar: 0
    }
    let addToAll = ({ foo, bar }, value) => ({ foo: foo + value, bar: bar + value })

    const reducer = createHandler((b) => b
        .on("addToAll", Number, (value) => b
            .merge(addToAll, value))
        .on("increment", String, (key) => b
            .set(key, (state) => state[key] + 1)))

    state = reducer(state, mapAction("increment", "foo"))
    t.deepEquals(state, { foo: 1, bar: 0 })

    state = reducer(state, mapAction("addToAll", 1))
    t.deepEquals(state, { foo: 2, bar: 1 })
    t.end()
})

test("patterns match in order, matchers use state", (t) => {
    let state = {
        foo: 0,
        bar: 0
    }
    let incAll = (state) => {
        const nextState = {}
        for (const key in state) { nextState[key] = state[key] + 1 }
        return nextState
    }

    const reducer = createHandler((b) => b
        .on("increment", "all", (value) => b
            .merge(incAll))
        .on("increment", (key, state) => key in state, (key) => b
            .set(key, (state) => state[key] + 1)))

    state = reducer(state, mapAction("increment", "foo"))
    t.deepEquals(state, { foo: 1, bar: 0 })

    state = reducer(state, mapAction("increment", "quux"))
    t.deepEquals(state, { foo: 1, bar: 0 })

    state = reducer(state, mapAction("increment", "all"))
    t.deepEquals(state, { foo: 2, bar: 1 })
    t.end()
})

test("method_missing-style matching with .otherwise", (t) => {
    let state = {
        log: [],
        count: 0
    }
    const reducer = createHandler((b) => b
        .on("increment", () => b
            .set("count", ({ count }) => count + 1))
        .otherwise((action) => b
            .set("log", ({ log }) => log.concat([action]))))

    state = reducer(state, mapAction("increment"))
    t.deepEquals(state, { log: [], count: 1 })

    state = reducer(state, mapAction("this", "message", "is", "not", "understood"))
    state = reducer(state, { type: "foo", payload: 123 })
    t.deepEquals(state, {
        log: [
            mapAction("this", "message", "is", "not", "understood"),
            { type: "foo", payload: 123 }
        ],
        count: 1
    })
    t.end()
})

test(".otherwise can only be called once", (t) => {
    t.throws(() => {
        createHandler((b) => b
            .on("increment", () => b
                .set("count", ({ count }) => count + 1))
            .otherwise((action) => b
                .set("log", ({ log }) => log.concat([action])))
            .otherwise((action) => b
                .set("log", ({ log }) => log.concat([action]))))
    })
    t.end()
})

test("match regular actions", (t) => {
    let state = { count: 0 }
    const reducer = createHandler((b) => b
        .on({ type: "increment" }, () => b
            .set("count", ({ count }) => count + 1))
        .on({ type: "add", payload: Number }, ({ payload }) => b
            .set("count", ({ count }) => count + payload)))

    state = reducer(state, { type: "increment" })
    t.deepEquals(state, { count: 1 })

    state = reducer(state, { type: "add", payload: 3 })
    t.deepEquals(state, { count: 4 })
    t.end()
})

test("onState", (t) => {
    let state = "LOCKED"
    const reducer = createHandler((b) => b
        .onState("LOCKED", "addToken", () => b
            .update(() => "OPEN"))
        .onState("OPEN", "turnTurnstile", () => b
            .update(() => "LOCKED")))

    state = reducer(state, mapAction("addToken"))
    t.equals(state, "OPEN")
    state = reducer(state, mapAction("addToken"))
    t.equals(state, "OPEN")
    state = reducer(state, mapAction("turnTurnstile"))
    t.equals(state, "LOCKED")

    state = reducer("FOO", mapAction("addToken"))
    t.equals(state, "FOO")

    t.end()
})
