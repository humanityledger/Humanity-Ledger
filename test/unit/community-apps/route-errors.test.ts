import { classifyAppsError, appsRoute } from '@/lib/community-apps/routeErrors';

describe('classifyAppsError', () => {
  it('a missing table or column means apps are not provisioned (503)', () => {
    expect(classifyAppsError({ code: 'P2021', message: 'The table `public.CommunityApp` does not exist' })).toMatchObject({ status: 503, code: 'APPS_NOT_PROVISIONED' });
    expect(classifyAppsError({ code: 'P2022' })).toMatchObject({ status: 503, code: 'APPS_NOT_PROVISIONED' });
  });
  it('a Prisma client generated before the models existed is named as such', () => {
    const e = new TypeError("Cannot read properties of undefined (reading 'findMany')");
    expect(classifyAppsError(e)).toMatchObject({ status: 503, code: 'APPS_CLIENT_OUTDATED' });
  });
  it('an unreachable database is a 503', () => {
    expect(classifyAppsError({ code: 'P1001' })).toMatchObject({ status: 503, code: 'DATABASE_UNAVAILABLE' });
    expect(classifyAppsError({ name: 'PrismaClientInitializationError' })).toMatchObject({ status: 503, code: 'DATABASE_UNAVAILABLE' });
  });
  it('anything else is a plain 500', () => {
    expect(classifyAppsError(new Error('boom'))).toMatchObject({ status: 500, code: 'INTERNAL' });
    expect(classifyAppsError(undefined)).toMatchObject({ status: 500, code: 'INTERNAL' });
  });
});

describe('appsRoute', () => {
  it('passes a normal response through untouched', async () => {
    const ok = new Response('fine', { status: 200 });
    const handler = appsRoute('test', async () => ok);
    expect(await handler()).toBe(ok);
  });

  it('turns a thrown error into JSON with a code and an id, without the raw message', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = appsRoute('test', async () => {
      throw Object.assign(new Error('relation "CommunityApp" does not exist at postgres://user:secret@host'), { code: 'P2021' });
    });
    const res = await handler();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe('APPS_NOT_PROVISIONED');
    expect(body.errorId).toMatch(/^[0-9a-f]{10}$/);
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(JSON.stringify(body)).not.toContain('postgres://');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});

describe('appsRoute with no response', () => {
  it('answers 500 instead of nothing', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await appsRoute('test', async () => undefined)();
    expect(res.status).toBe(500);
    spy.mockRestore();
  });
});
