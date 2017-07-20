const test = require("tape")
const { createHandler, mapAction } = require("./index")

// function setup (initState, builder) {
//     const handler = createHandler(initState, builder)
//     return createStore(handler, applyMiddleware(createBuilderMiddleware()))
// }

test("smoke test", (t) => {
    t.ok(true)
    t.end()
})

test("basic action handling", (t) => {
    let state = { count: 0 }

    const reducer = createHandler(state, (b) => b
        .on("increment", ({ count }) => b
            .set("count", count + 1))
        .on("decrement", ({ count }) => b
            .set("count", count - 1)))

    state = reducer(undefined, { type: "@init" })
    t.deepEquals(state, { count: 0 })
    state = reducer(state, mapAction("increment"))
    t.deepEquals(state, { count: 1 })

    state = reducer(state, mapAction("decrement"))
    state = reducer(state, mapAction("decrement"))
    t.deepEquals(state, { count: -1 })
    t.end()
})

test("pattern matching", (t) => {
    let state = { count: 0 }

    const reducer = createHandler(state, (b) => b
        .on("increment", ({ count }) => b
            .set("count", count + 1))
        .on("decrement", ({ count }) => b
            .set("count", count - 1))
        .on("add", Number, ({ count }, number) => b
            .set("count", count + number))
        .on("reset", () => b.set("count", 0)))

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

    const reducer = createHandler(state, (b) => b
        .namespace("counter")
        .on("increment", ({ count }) => b
            .set("count", count + 1))
        .on("decrement", ({ count }) => b
            .set("count", count - 1)))

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
    const reducer = createHandler(state, (b) => b
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

    const incrementCounter = (b, { count }) => b.set("count", count + 1)
    const reducer = createHandler(state, (b) => b
        .beforeEach(incrementCounter)
        .setter("foo", "bar"))

    state = reducer(state, mapAction("foo", 12))
    t.deepEquals(state, { foo: 12, bar: 0, count: 1 })
    state = reducer(state, mapAction("baz", 20))
    t.deepEquals(state, { foo: 12, bar: 0, count: 1 })
    t.end()
})
