# redux-builder

### Defining a reducer:

```js
const __ = undefined
const resetPagination = (t) => t.set("page", 1)

const videoReducer = createHandler(initState, (t) => t
    .namespace("video")
    .on("page", "prev", ({ page }) => t
        .set("page", Math.max(1, page - 1)))
    .on("page", "next", ({ page }) => t
        .set("page", page + 1))

    .beforeEach(resetPagination)
    .setter("shows", "producers", "platform", "editorial", "accounts")

    .on("period", __, (_, id) => t
        .set("periodID", id))
    .on("period", __, "withRange", __, (_, id, range) => t
        .merge(normalizeCustomDateRange, range)
        .set("periodID", id))

    .on("sort", __, ({ field, direction }, f) => t
        .set("direction", field === f ? -direction : direction))
        .set("field", f)

    .beforeEach((t) => t.set("periodID", "all_time"))
    .setter("search", "producers", "platform", "editorial", "accounts"))
```

### Dispatching actions

```js
store.dispatch(["video", "page", "next"])
store.dispatch(["video", "platform", "youtube"])
```

see `test.js` for more examples.

## TODO

```js
.select(...selectorPattern,(state, ...pattern) => selection)
```

like combineReducers + delegates select
```js
.children({ ...childReducers })
```

what does this do when it fails ? return initState? return prevState? throw error?
push errors into an error state fragment?
```js
.validate({ field: String, direction: t.oneOf(1, -1) })
```

More metaprogramming!

```js
// call itself
.do(t,...action)
// delegate to another reducer
.do(handler, ...action)
```

override `set` / `merge` behavior (e.g. for iMap)
how would this work with inheritance?
maybe this should be done in JS instead of DSL
```js
.on(t, "set", _, _, (key, value) => t
    .update((state) => state.set(key, value))
)

// or

class IMapHandler extends Handler {
    set (key, value) {
        this.update((state) => state.set(key, value))
    }
}
```

reducers are handler + data structures
"value" is just update (prev) => next
"record" (object) is set at key, merge, update
"map" is map (val, key) => val, mapWhere (key) => ?, (val) => val, add, remove, merge, update
etc.
