# FreeAPI REST API tests

A small Playwright + TypeScript project for the FreeAPI API automation assignment. The tests use Playwright's API client; no browser is required.

## Run locally

Prerequisites: Node.js 20+, npm, and Java (for the Allure command line report).

```bash
npm ci
npm run typecheck
npm run test:allure
npm run report
```

`npm run test` runs the tests without generating the HTML report. `npm run test:allure` generates the report even if a test fails and still exits with the test failure code. It accepts Playwright filters, for example `npm run test:allure -- tests/auth.spec.ts`. Allure data is written to `allure-results/`, the HTML report to `allure-report/`, and the downloaded product list to `artifacts/products.json`. These generated files are ignored by Git.

The default API host is `https://api.freeapi.app`. Override it for a local FreeAPI instance with `FREEAPI_BASE_URL=http://localhost:8080 npm run test:allure`.

## What the tests cover

- Register a unique user, log in, extract `data.accessToken`, and call `/users/current-user` with `Authorization: Bearer ...`.
- Read every page of the product catalog, check that `data.products` is an array, and save the combined array as JSON.
- Register a temporary ADMIN, create a category and a product, then read, update, and delete that product. Product details are checked against a JSON Schema using Ajv.
- Check authentication and validation errors, plus zero, large (`1000000000000`), and negative (`-1`) prices.

Unique test data comes from Node's `crypto.randomUUID()` (a lightweight Faker alternative). The 1×1 PNG under `fixtures/` is the required product image. Product and category records are cleaned up after the suite, including after assertion failures when the server is reachable. FreeAPI has no user deletion endpoint in this flow, so temporary accounts remain until the public database resets.

## Assignment versus observed API behavior

Observed on 10 October 2026 against the public API; the service can change.

| Assignment wording | Actual API behavior and test choice |
| --- | --- |
| “All products” as an array | The response is an object with `data.products` and pagination. The test collects every reported page. |
| New product has an `id` | The product identifier is `data._id`. |
| Create a product from generated fields | Creation requires an ADMIN token, a pre-existing category ID, and a `multipart/form-data` image. The suite creates its own category and sends `fixtures/product.png`. |
| Update only the price | A price-only `PATCH` returned 422 even though the OpenAPI description says fields are optional. The validator also requires `category`; the CRUD test demonstrates 422, then sends the existing category with the new price. |
| Nonexistent ID `999999` returns 404 | This is malformed for MongoDB and returned 422. A well-formed but absent 24-character ID returned 404. Both cases are tested. |
| Nonnumeric price `"сто"` returns 400 | The validator returned 422. The test checks 422 and the price error. |
| Boundary prices | The public API accepted `0`, `1000000000000`, and `-1` with 201. There is no nonnegative price constraint in the published product model; the tests record the current contract, not an invented rejection rule. |
| Delete returns 200 or 204 | The observed product DELETE returns 200 with a JSON body. |

The API sets an auth cookie on login. The tests use a fresh request context for anonymous checks, so a remembered cookie cannot turn a 401 test into an authenticated request.

The [FreeAPI README](https://github.com/hiteshchoudhary/apihub#-important-note-avoiding-data-loss-and-self-hosting) says the public database resets roughly every two hours and may be unavailable during restart. A reset in the middle of a run can invalidate a token or delete a test record. For repeatable runs, use a local FreeAPI instance and the `FREEAPI_BASE_URL` override.

## Sources

- [Official OpenAPI specification](https://github.com/hiteshchoudhary/apihub/blob/main/src/swagger.yaml)
- [Product routes](https://github.com/hiteshchoudhary/apihub/blob/main/src/routes/apps/ecommerce/product.routes.js), [product validation](https://github.com/hiteshchoudhary/apihub/blob/main/src/validators/apps/ecommerce/product.validators.js), and [product model](https://github.com/hiteshchoudhary/apihub/blob/main/src/models/apps/ecommerce/product.models.js)
- [Authentication routes](https://github.com/hiteshchoudhary/apihub/blob/main/src/routes/apps/auth/user.routes.js) and [validation error handling](https://github.com/hiteshchoudhary/apihub/blob/main/src/validators/validate.js)
