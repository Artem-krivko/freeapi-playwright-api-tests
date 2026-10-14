import { expect, test } from '@playwright/test';
import { newUser } from '../src/test-data';

test('register, log in, and use the Bearer token', async ({ request }) => {
  const user = newUser();

  const registration = await request.post('/api/v1/users/register', { data: user });
  expect(registration.status()).toBe(201);
  const registered = await registration.json();
  expect(registered.data.user.username).toBe(user.username);

  const login = await request.post('/api/v1/users/login', {
    data: { username: user.username, password: user.password },
  });
  expect(login.status()).toBe(200);
  const loggedIn = await login.json();
  expect(loggedIn.data.accessToken).toEqual(expect.any(String));

  const currentUser = await request.get('/api/v1/users/current-user', {
    headers: { Authorization: `Bearer ${loggedIn.data.accessToken}` },
  });
  expect(currentUser.status()).toBe(200);
  const profile = await currentUser.json();
  expect(profile.data._id).toBe(registered.data.user._id);
  expect(profile.data.username).toBe(user.username);
});

test('current user requires authentication', async ({ request }) => {
  const response = await request.get('/api/v1/users/current-user');
  expect(response.status()).toBe(401);
});
