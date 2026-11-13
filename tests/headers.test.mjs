import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const config = require('../next.config.js');
const { buildCustomRoute } = require('next/dist/lib/build-custom-route');

// Headers Next would send for a path (same matching as Next's custom headers).
async function headersFor(path) {
    const out = {};
    for (const rule of await config.headers()) {
        if (new RegExp(buildCustomRoute('header', rule).regex).test(path)) {
            for (const h of rule.headers) out[h.key] = h.value;
        }
    }
    return out;
}

test('every page gets the basic security headers', async () => {
    for (const path of ['/', '/login', '/widget.js', '/api/chat/abc']) {
        const h = await headersFor(path);
        assert.equal(h['X-Content-Type-Options'], 'nosniff', path);
        assert.equal(h['Referrer-Policy'], 'strict-origin-when-cross-origin', path);
        assert.equal(h['Permissions-Policy'], 'camera=(), microphone=(), geolocation=()', path);
        assert.equal(h['Strict-Transport-Security'], 'max-age=31536000; includeSubDomains', path);
    }
});

test('the app cannot be framed, the chat widget can be used anywhere', async () => {
    for (const path of ['/', '/dashboard', '/s/abc/messages', '/login', '/api/sms/send', '/widget.js.map', '/api/chatty']) {
        const h = await headersFor(path);
        assert.equal(h['X-Frame-Options'], 'DENY', path);
        assert.equal(h['Content-Security-Policy'], "frame-ancestors 'none'", path);
    }
    for (const path of ['/widget.js', '/api/chat/abc']) {
        const h = await headersFor(path);
        assert.equal(h['X-Frame-Options'], undefined, path);
        assert.equal(h['Content-Security-Policy'], undefined, path);
    }
});
