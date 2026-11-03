import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants.js';
import { RequestMethod } from '@nestjs/common';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

import { AuthenticationGuard } from './authentication.guard.js';
import { REQUIRED_ROLES } from './require-roles.decorator.js';
import { RolesGuard } from './roles.guard.js';

/**
 * V5 PR 10 security audit: every API route must run the AuthenticationGuard,
 * except the reviewed public routes below. Controllers are found on disk, so a
 * new controller cannot be added without this test seeing it.
 */
const PUBLIC_ROUTES = new Set([
  // Load balancer and uptime check; returns no data.
  'GET health',
  // Local passwords: refused outside development and test, and when AUTH_PROVIDER=cognito.
  'POST identity/login',
  // Development storage driver only (refused in production); each link carries its own signed token.
  'PUT storage/local/:token',
  'GET storage/local/:token',
]);

/**
 * Signed-in routes whose handler never receives the user: each must still name
 * the roles allowed (RolesGuard), unless its answer is the same for everyone.
 */
const SAME_FOR_EVERY_SIGNED_IN_USER = new Set([
  // District names and society counts (the dashboard shows "DM · Kurunegala").
  'GET districts',
  // Ends the caller's own session, read from the Authorization header.
  'POST identity/logout',
]);

const SRC = join(import.meta.dirname, '..');

function controllerFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'generated' ? [] : controllerFiles(path);
    return entry.name.endsWith('.controller.ts') ? [path] : [];
  });
}

type Route = { route: string; guarded: boolean; readsUser: boolean; roles: string[]; file: string };

async function routes(): Promise<Route[]> {
  const found: Route[] = [];
  for (const file of controllerFiles(SRC)) {
    const module = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
    for (const exported of Object.values(module)) {
      if (typeof exported !== 'function' || Reflect.getMetadata(PATH_METADATA, exported) === undefined) continue;
      const base = String(Reflect.getMetadata(PATH_METADATA, exported) ?? '').replace(/^\/|\/$/g, '');
      const classGuards: unknown[] = Reflect.getMetadata(GUARDS_METADATA, exported) ?? [];
      const prototype = (exported as { prototype: Record<string, unknown> }).prototype;
      for (const name of Object.getOwnPropertyNames(prototype)) {
        const handler = prototype[name];
        if (name === 'constructor' || typeof handler !== 'function') continue;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
        if (method === undefined) continue;
        const path = String(Reflect.getMetadata(PATH_METADATA, handler) ?? '').replace(/^\/|\/$/g, '');
        const guards = [...classGuards, ...((Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[]) ?? [])];
        const roles: string[] = guards.includes(RolesGuard)
          ? (Reflect.getMetadata(REQUIRED_ROLES, handler) ?? Reflect.getMetadata(REQUIRED_ROLES, exported) ?? [])
          : [];
        // @CurrentPrincipal() is a custom parameter decorator.
        const args = Object.keys(Reflect.getMetadata(ROUTE_ARGS_METADATA, exported, name) ?? {});
        found.push({
          route: `${RequestMethod[method]} ${[base, path].filter(Boolean).join('/')}`,
          guarded: guards.includes(AuthenticationGuard),
          readsUser: args.some((key) => key.includes('__customRouteArgs__')),
          roles,
          file: relative(SRC, file),
        });
      }
    }
  }
  return found;
}

describe('API route guards', () => {
  it('requires sign-in on every route except the reviewed public ones', async () => {
    const all = await routes();
    // Discovery check: the API maps 94 routes at start-up (V5 PR 10); a drop means controllers were missed.
    expect(all.length).toBeGreaterThanOrEqual(94);
    const unguarded = all.filter((route) => !route.guarded).map((route) => route.route);
    expect(unguarded.filter((route) => !PUBLIC_ROUTES.has(route))).toEqual([]);
  });

  it('checks role or scope on every signed-in route: the handler gets the user, or the route names its roles', async () => {
    const unchecked = (await routes())
      .filter((route) => route.guarded && !route.readsUser && route.roles.length === 0)
      .map((route) => route.route);
    expect(unchecked.filter((route) => !SAME_FOR_EVERY_SIGNED_IN_USER.has(route))).toEqual([]);
  });

  it('keeps the national dashboard, reports and Registrar totals HQ-only', async () => {
    const hqOnly = (await routes()).filter((route) => /^GET (national\/|reports\/|registrar-documents\/(totals|missing)|hq-tasks)/.test(route.route));
    expect(hqOnly.length).toBeGreaterThanOrEqual(10);
    for (const route of hqOnly) expect(route.roles, route.route).toEqual(['HQ_ADMIN']);
  });

  it('keeps the public list honest: each public route exists and is public', async () => {
    const all = new Map((await routes()).map((route) => [route.route, route.guarded]));
    for (const route of PUBLIC_ROUTES) if (all.has(route)) expect(all.get(route), route).toBe(false);
    expect(all.has('POST identity/login')).toBe(true);
    expect(all.has('GET health')).toBe(true);
  });
});
