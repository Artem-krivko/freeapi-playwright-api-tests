import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import Ajv from 'ajv';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { baseURL } from '../playwright.config';
import { productSchema } from '../src/product.schema';
import { newUser, uniqueName } from '../src/test-data';

const productPath = '/api/v1/ecommerce/products';
const categoryPath = '/api/v1/ecommerce/categories';
const image = readFile(resolve('fixtures/product.png'));
const validateProduct = new Ajv().compile(productSchema);

test.describe('products', () => {
  let publicApi: APIRequestContext;
  let adminApi: APIRequestContext;
  let categoryId: string;
  const createdProducts = new Set<string>();

  async function createProduct(price: string, name = uniqueName('qa-product')) {
    return adminApi.post(productPath, {
      multipart: {
        name,
        description: 'Temporary Playwright API test product',
        price,
        stock: '1',
        category: categoryId,
        mainImage: {
          name: 'product.png',
          mimeType: 'image/png',
          buffer: await image,
        },
      },
    });
  }

  async function rememberCreatedProduct(response: Awaited<ReturnType<typeof createProduct>>) {
    const body = await response.json();
    if (response.status() === 201 && body.data?._id) {
      createdProducts.add(body.data._id);
    }
    return body;
  }

  test.beforeAll(async ({ playwright }) => {
    publicApi = await playwright.request.newContext({ baseURL });
    const user = newUser('ADMIN');
    const registration = await publicApi.post('/api/v1/users/register', { data: user });
    expect(registration.status(), 'ADMIN registration is required for product CRUD').toBe(201);

    const login = await publicApi.post('/api/v1/users/login', {
      data: { username: user.username, password: user.password },
    });
    expect(login.status()).toBe(200);
    const token = (await login.json()).data.accessToken;
    expect(token).toEqual(expect.any(String));
    adminApi = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    // Login also sets an auth cookie. Use a fresh context for public and 401 checks.
    await publicApi.dispose();
    publicApi = await playwright.request.newContext({ baseURL });

    const category = await adminApi.post(categoryPath, {
      data: { name: uniqueName('qa-category') },
    });
    expect(category.status(), 'A category is required before creating a product').toBe(201);
    categoryId = (await category.json()).data._id;
  });

  test.afterAll(async () => {
    if (adminApi) {
      for (const id of createdProducts) {
        const response = await adminApi.delete(`${productPath}/${id}`);
        expect([200, 404], `cleanup product ${id}`).toContain(response.status());
      }
      if (categoryId) {
        const response = await adminApi.delete(`${categoryPath}/${categoryId}`);
        expect([200, 404], `cleanup category ${categoryId}`).toContain(response.status());
      }
      await adminApi.dispose();
    }
    if (publicApi) await publicApi.dispose();
  });

  test('save every page of the product catalog as JSON', async ({}, testInfo) => {
    const products: unknown[] = [];
    let totalPages = 1;
    for (let page = 1; page <= totalPages; page++) {
      const response = await publicApi.get(productPath, {
        params: { page, limit: 50 },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body.data.products)).toBe(true);
      products.push(...body.data.products);
      totalPages = body.data.totalPages;
      expect(Number.isInteger(totalPages) && totalPages >= 1).toBe(true);
    }

    const json = JSON.stringify(products, null, 2);
    await mkdir('artifacts', { recursive: true });
    await writeFile('artifacts/products.json', json);
    await testInfo.attach('products.json', { body: json, contentType: 'application/json' });
  });

  test('create, read, update, and delete a product', async () => {
    const name = uniqueName('qa-crud');
    const createdResponse = await createProduct('10', name);
    const created = await rememberCreatedProduct(createdResponse);
    expect(createdResponse.status()).toBe(201);
    const id = created.data._id;
    expect(id).toEqual(expect.any(String));

    const foundResponse = await publicApi.get(`${productPath}/${id}`);
    expect(foundResponse.status()).toBe(200);
    const found = (await foundResponse.json()).data;
    expect(found.name).toBe(name);
    expect(validateProduct(found), JSON.stringify(validateProduct.errors)).toBe(true);

    // Observed API deviation: PATCH requires category even for a price-only change.
    const priceOnly = await adminApi.patch(`${productPath}/${id}`, {
      multipart: { price: '25.5' },
    });
    expect(priceOnly.status()).toBe(422);

    const updatedResponse = await adminApi.patch(`${productPath}/${id}`, {
      multipart: { price: '25.5', category: categoryId },
    });
    expect(updatedResponse.status()).toBe(200);
    expect((await updatedResponse.json()).data.price).toBe(25.5);

    const reread = await publicApi.get(`${productPath}/${id}`);
    expect(reread.status()).toBe(200);
    expect((await reread.json()).data.price).toBe(25.5);

    const deleted = await adminApi.delete(`${productPath}/${id}`);
    expect(deleted.status()).toBe(200);
    createdProducts.delete(id);
    expect((await publicApi.get(`${productPath}/${id}`)).status()).toBe(404);
  });

  test('invalid product ID differs from a missing valid ID', async () => {
    const malformed = await publicApi.get(`${productPath}/999999`);
    expect(malformed.status()).toBe(422);
    const missing = await publicApi.get(`${productPath}/000000000000000000000000`);
    expect(missing.status()).toBe(404);
  });

  test('product creation without authentication returns 401', async () => {
    const cookies = (await publicApi.storageState()).cookies;
    expect(cookies.some((cookie) => cookie.name === 'accessToken')).toBe(false);
    const response = await publicApi.post(productPath, {
      multipart: {
        name: uniqueName('qa-unauthorized'),
        description: 'Unauthorized request',
        price: '10',
        category: categoryId,
        mainImage: {
          name: 'product.png',
          mimeType: 'image/png',
          buffer: await image,
        },
      },
    });
    expect(response.status()).toBe(401);
  });

  test('nonnumeric price is rejected by validation', async () => {
    const response = await createProduct('сто');
    expect(response.status()).toBe(422);
    const body = await response.json();
    expect(body.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ price: 'Price must be a number' }),
    ]));
  });

  for (const [label, price] of [
    ['zero', '0'],
    ['large', '1000000000000'],
    ['negative', '-1'],
  ] as const) {
    test(`price boundary: ${label}`, async () => {
      const response = await createProduct(price);
      const body = await rememberCreatedProduct(response);
      expect(response.status()).toBe(201);
      expect(body.data.price).toBe(Number(price));
    });
  }
});
