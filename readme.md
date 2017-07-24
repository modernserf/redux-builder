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

.select(...selectorPattern,(state, ...pattern) => selection)

like combineReducers + delegates selection
.children({ ...childReducers })

// what does this do when it failslets ? return initState? return prevState? throw error?
.validate({ field: String, direction: t.oneOf(1, -1) })
    
