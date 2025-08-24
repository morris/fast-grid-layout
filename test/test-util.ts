import { test } from '@playwright/test';
import { DevServer } from 's4d';

export function useTestServer(t: typeof test) {
  const server = new DevServer({ port: 0, webroot: 'docs' });

  t.beforeAll(() => server.start());
  t.afterAll(() => server.close());

  return () => server.getBaseURL();
}
