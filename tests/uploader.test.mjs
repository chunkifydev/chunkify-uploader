import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Window } from 'happy-dom';

const bundle = readFileSync(new URL('../dist/chunkify-uploader.js', import.meta.url), 'utf8');
const expiry = '2099-01-01T00:00:00Z';
const single = () => ({ upload_mode: 'single', expires_at: expiry, upload_url: 'https://storage.test/file', completion_url: 'https://api.test/complete' });
const multipart = () => ({
    upload_mode: 'multipart', completion_url: 'https://api.test/complete',
    multipart: {
        part_size_bytes: 4, expires_at: expiry,
        parts: [1, 2, 3].map(part_number => ({ part_number, upload_url: `https://storage.test/${part_number}` })),
    },
});
const flush = async () => { for (let i = 0; i < 50; i++) await Promise.resolve(); };

function setup(t, session = multipart()) {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.parse('2026-10-15T10:00:00Z') });
    const window = new Window();
    window.setTimeout = (...args) => setTimeout(...args);
    window.clearTimeout = id => clearTimeout(id);
    window.Date = Date;
    const puts = [], posts = [], outcomes = [], completions = [], events = [];
    class XHR {
        upload = {};
        headers = {};
        open(method, url) { this.method = method; this.url = url; }
        setRequestHeader(name, value) { this.headers[name] = value; }
        getResponseHeader(name) { return name === 'ETag' ? this.etag : this.retryAfter ?? null; }
        send(body) {
            this.body = body;
            puts.push(this);
            const outcome = outcomes.shift() ?? {};
            this.respond = () => {
                this.upload.onprogress?.({ lengthComputable: true, loaded: body.size, total: body.size });
                this.status = outcome.status ?? 200;
                this.etag = Object.hasOwn(outcome, 'etag') ? outcome.etag : `"etag-${this.url.split('/').pop()}"`;
                this.retryAfter = outcome.retryAfter;
                if (outcome.error) this.onerror();
                else if (outcome.timeout) this.ontimeout();
                else this.onload();
            };
            if (!outcome.hold) queueMicrotask(this.respond);
        }
        abort() { this.aborted = true; this.onabort?.(); }
    }
    window.XMLHttpRequest = XHR;
    window.fetch = async (url, init) => {
        posts.push({ url, ...init });
        const outcome = completions.shift() ?? {};
        if (typeof outcome === 'function') return outcome(init);
        if (outcome.error) throw new TypeError('Response lost');
        return {
            status: outcome.status ?? 204,
            headers: new Headers(outcome.retryAfter ? { 'Retry-After': outcome.retryAfter } : {}),
            json: async () => outcome.body ?? {},
        };
    };
    window.eval(bundle);
    const uploader = window.document.createElement('chunkify-uploader');
    uploader.innerHTML = '<chunkify-uploader-error></chunkify-uploader-error><chunkify-uploader-retry></chunkify-uploader-retry><chunkify-uploader-progress-text></chunkify-uploader-progress-text>';
    window.document.body.append(uploader);
    let providerCalls = 0;
    uploader.upload = async () => { providerCalls++; return session; };
    for (const type of ['file-selected', 'upload-progress', 'upload-error', 'upload-success', 'upload-reset']) {
        uploader.addEventListener(type, event => events.push({ type, detail: event.detail }));
    }
    const file = new window.File(['abcdefghij'], 'test.mp4');
    function choose(selected = file) {
        const input = uploader.shadowRoot.querySelector('input');
        Object.defineProperty(input, 'files', { configurable: true, value: [selected] });
        input.dispatchEvent(new window.Event('change'));
    }
    const retry = () => uploader.querySelector('chunkify-uploader-retry').click();
    const tick = async ms => { t.mock.timers.tick(ms); await flush(); };
    t.after(() => { uploader.remove(); window.happyDOM.abort(); });
    return { window, uploader, file, puts, posts, outcomes, completions, events, choose, retry, tick,
        providerCalls: () => providerCalls,
        error: () => events.filter(e => e.type === 'upload-error').at(-1)?.detail,
    };
}

test(`single PUT uses the returned URL and empty completion; only 204 succeeds`, async t => {
    const session = single();
    const h = setup(t, session);
    let finish;
    h.completions.push(() => new Promise(resolve => { finish = resolve; }));
    h.choose(); await flush();
    assert.equal(h.puts.length, 1);
    assert.equal(h.puts[0].body, h.file);
    assert.equal(h.puts[0].headers['Content-Type'], 'application/octet-stream');
    assert.equal(h.posts[0].method, 'POST');
    assert.equal(h.posts[0].body, undefined);
    assert.equal(h.posts[0].headers, undefined);
    assert.equal(h.posts[0].credentials, 'omit');
    assert.equal(h.uploader.getAttribute('progress'), '100');
    assert.equal(h.uploader.hasAttribute('uploading'), true);
    assert.equal(h.uploader.hasAttribute('success'), false);
    finish({ status: 204 }); await flush();
    assert.equal(h.uploader.hasAttribute('success'), true);
});


test('multipart slices by part number, transfers sequentially, aggregates progress and preserves exact ETags', async t => {
    const session = multipart();
    session.multipart.parts.reverse();
    const h = setup(t, session);
    h.outcomes.push({ hold: true, etag: '"first"' }, { hold: true, etag: '"second"' }, { etag: '"last"' });
    h.choose(); await flush();
    assert.equal(h.puts.length, 1);
    h.puts[0].upload.onprogress({ lengthComputable: true, loaded: 2, total: 4 });
    assert.equal(h.uploader.getAttribute('progress'), '20');
    h.puts[0].respond(); await flush();
    assert.equal(h.puts.length, 2);
    h.puts[1].upload.onprogress({ lengthComputable: true, loaded: 2, total: 4 });
    assert.equal(h.uploader.getAttribute('progress'), '60');
    h.puts[1].respond(); await flush();
    assert.deepEqual(await Promise.all(h.puts.map(p => p.body.text())), ['abcd', 'efgh', 'ij']);
    assert.deepEqual(h.puts.map(p => p.url), [1, 2, 3].map(n => `https://storage.test/${n}`));
    assert.deepEqual(JSON.parse(h.posts[0].body), { parts: [
        { part_number: 1, etag: '"first"' }, { part_number: 2, etag: '"second"' }, { part_number: 3, etag: '"last"' },
    ] });
    assert.equal(h.posts[0].headers['Content-Type'], 'application/json');
    assert.equal(h.uploader.hasAttribute('success'), true);
});

for (const failure of [{ error: true }, { timeout: true }, { status: 408 }, { status: 429 }, { status: 503 }]) {
    test(`transient part failure ${JSON.stringify(failure)} retries the same slice and URL`, async t => {
        const h = setup(t);
        h.outcomes.push({}, failure);
        h.choose(); await flush();
        assert.equal(h.uploader.getAttribute('progress'), '40');
        await h.tick(500);
        assert.equal(h.puts.length, 4);
        assert.equal(h.puts[1].body, h.puts[2].body);
        assert.equal(h.puts[1].url, h.puts[2].url);
        assert.equal(h.providerCalls(), 1);
        assert.equal(h.uploader.hasAttribute('success'), true);
    });
}

test('Retry after three failed attempts retains successful parts and the selected file', async t => {
    const h = setup(t);
    h.outcomes.push({}, { error: true }, { error: true }, { error: true });
    h.choose(); await flush(); await h.tick(500); await h.tick(1000);
    assert.equal(h.puts.length, 4);
    assert.equal(h.posts.length, 0);
    assert.equal(h.uploader.hasAttribute('error'), true);
    h.retry(); h.retry(); await flush();
    assert.equal(h.providerCalls(), 1);
    assert.deepEqual(h.puts.map(p => p.url.split('/').pop()), ['1', '2', '2', '2', '2', '3']);
    assert.equal(await h.puts[4].body.text(), 'efgh');
    assert.equal(h.events.filter(e => e.type === 'file-selected').length, 1);
    assert.equal(h.events.filter(e => e.type === 'upload-reset').length, 0);
    assert.equal(h.uploader.hasAttribute('success'), true);
});

for (const session of [single(), multipart()]) {
    test(`${session.upload_mode} lost completion responses retry without bytes or a new Source`, async t => {
        const h = setup(t, session);
        const sources = new Set();
        for (let i = 0; i < 3; i++) h.completions.push(() => {
            // Contract fixture: completion creates once, but each response is lost.
            sources.add(h.posts.at(-1).url);
            throw new TypeError('Response lost after server committed');
        });
        h.choose(); await flush(); await h.tick(500); await h.tick(1000);
        assert.equal(h.posts.length, 3);
        assert.equal(h.uploader.hasAttribute('success'), false);
        const transferred = h.puts.length;
        h.retry(); await flush();
        assert.equal(h.posts.length, 4);
        assert.equal(h.puts.length, transferred);
        assert.equal(h.providerCalls(), 1);
        assert.equal(sources.size, 1);
        assert.equal(new Set(h.posts.map(p => p.url)).size, 1);
        assert.equal(new Set(h.posts.map(p => p.body)).size, 1);
        assert.equal(h.uploader.hasAttribute('success'), true);
    });
}

for (const status of [408, 429, 500, 503]) {
    test(`completion ${status} retries only completion`, async t => {
        const h = setup(t);
        h.completions.push({ status });
        h.choose(); await flush(); await h.tick(500);
        assert.equal(h.posts.length, 2);
        assert.equal(h.puts.length, 3);
        assert.equal(h.uploader.hasAttribute('success'), true);
    });
}

test('completion timeout remains 30 seconds and retries the identical request', async t => {
    const h = setup(t);
    h.completions.push(init => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('timeout')))));
    h.choose(); await flush(); await h.tick(29999);
    assert.equal(h.posts[0].signal.aborted, false);
    await h.tick(1);
    assert.equal(h.posts[0].signal.aborted, true);
    await h.tick(500);
    assert.equal(h.posts.length, 2);
    assert.equal(h.posts[0].body, h.posts[1].body);
    assert.equal(h.puts.length, 3);
});

test('stalled transfer times out after 120 seconds of inactivity', async t => {
    const h = setup(t);
    h.outcomes.push({ hold: true });
    h.choose(); await flush(); await h.tick(119999);
    h.puts[0].upload.onprogress({ lengthComputable: true, loaded: 1, total: 4 });
    await h.tick(119999);
    assert.equal(h.puts[0].aborted, undefined);
    await h.tick(1);
    assert.equal(h.puts[0].aborted, true);
    await h.tick(500);
    assert.equal(h.uploader.hasAttribute('success'), true);
});

for (const target of ['transfer', 'completion']) {
    for (const retryAfter of ['2', 'Thu, 15 Oct 2026 10:00:02 GMT', '31']) {
        test(`${target} respects bounded Retry-After ${retryAfter}`, async t => {
            const h = setup(t, single());
            (target === 'transfer' ? h.outcomes : h.completions).push({ status: 429, retryAfter });
            h.choose(); await flush();
            if (retryAfter === '31') {
                assert.equal(h.uploader.hasAttribute('error'), true);
                await h.tick(30000);
                assert.equal((target === 'transfer' ? h.puts : h.posts).length, 1);
            } else {
                await h.tick(1999);
                assert.equal((target === 'transfer' ? h.puts : h.posts).length, 1);
                await h.tick(1);
                assert.equal(h.uploader.hasAttribute('success'), true);
            }
        });
    }
}

for (const session of [
    { ...single(), upload_mode: 'single', expires_at: '2020-01-01T00:00:00Z' },
    { ...multipart(), multipart: { ...multipart().multipart, expires_at: '2020-01-01T00:00:00Z' } },
]) {
    test(`expired ${session.upload_mode} session requires start-over without requests`, async t => {
        const h = setup(t, session);
        h.choose(); await flush(); h.retry(); await flush();
        assert.match(h.error().error, /expired.*new session/i);
        assert.equal(h.uploader.hasAttribute('retryable'), false);
        assert.equal(h.puts.length, 0);
        assert.equal(h.providerCalls(), 1);
    });
}

test('expiry during backoff stops requests and disables retry', async t => {
    const session = multipart();
    session.multipart.expires_at = '2026-10-15T10:00:01Z';
    const h = setup(t, session);
    h.outcomes.push({ status: 503 }, { status: 503 });
    h.choose(); await flush(); await h.tick(500); await h.tick(1000);
    assert.equal(h.puts.length, 2);
    assert.match(h.error().error, /expired/);
    h.retry(); await flush();
    assert.equal(h.providerCalls(), 1);
});

for (const status of [200, 400, 401, 409, 410]) {
    test(`completion ${status} does not succeed or retry`, async t => {
        const h = setup(t);
        h.completions.push({ status });
        h.choose(); await flush(); h.retry(); await flush();
        assert.equal(h.uploader.hasAttribute('success'), false);
        assert.equal(h.posts.length, 1);
        assert.equal(h.uploader.hasAttribute('retryable'), false);
        if (status === 410) assert.match(h.error().error, /new session/);
    });
}

for (const step of ['transfer', 'completion']) {
    test(`${step} 403 is not assumed expired and allows manual recovery`, async t => {
        const h = setup(t);
        (step === 'transfer' ? h.outcomes : h.completions).push({ status: 403 });
        h.choose(); await flush();
        assert.doesNotMatch(h.error().error, /expired/);
        assert.equal(h.uploader.hasAttribute('retryable'), true);
        h.retry(); await flush();
        assert.equal(h.providerCalls(), 1);
        assert.equal(h.uploader.hasAttribute('success'), true);
    });
}

test('missing ETag explains storage CORS and retries only that part after a manual retry', async t => {
    const h = setup(t);
    h.outcomes.push({}, { etag: null });
    h.choose(); await flush();
    assert.match(h.error().error, /ETag.*CORS/);
    assert.match(h.uploader.querySelector('chunkify-uploader-error').shadowRoot.querySelector('.fallback-message').textContent, /ETag.*CORS/);
    assert.equal(h.posts.length, 0);
    h.retry(); await flush();
    assert.deepEqual(h.puts.map(p => p.url.split('/').pop()), ['1', '2', '2', '3']);
});

test('custom error content and event handlers remain application-controlled', async t => {
    const h = setup(t);
    const display = h.uploader.querySelector('chunkify-uploader-error');
    display.innerHTML = '<strong>My custom error</strong>';
    h.outcomes.push({ etag: null });
    h.choose(); await flush();
    assert.equal(display.innerHTML, '<strong>My custom error</strong>');
    assert.equal(display.shadowRoot.querySelector('.fallback-message').hidden, true);
    assert.match(h.error().error, /ETag/);
});

for (const failure of ['expiry', 'missing ETag']) {
    test(`formatting whitespace does not hide ${failure} explanations`, async t => {
        const session = multipart();
        if (failure === 'expiry') session.multipart.expires_at = '2020-01-01T00:00:00Z';
        const h = setup(t, session);
        const display = h.uploader.querySelector('chunkify-uploader-error');
        display.textContent = '\n  \t';
        const whitespace = display.firstChild;
        h.outcomes.push({ etag: null });
        h.choose(); await flush();
        const fallback = display.shadowRoot.querySelector('.fallback-message');
        assert.equal(fallback.hidden, false);
        assert.equal(fallback.textContent, h.error().error);
        assert.match(fallback.textContent, failure === 'expiry' ? /expired.*new session/ : /ETag.*CORS/);
        assert.equal(display.firstChild, whitespace);
        assert.equal(display.textContent, '\n  \t');
    });
}

test('fallback visibility follows updates to application-owned text and elements', async t => {
    const h = setup(t);
    const display = h.uploader.querySelector('chunkify-uploader-error');
    const text = h.window.document.createTextNode(' ');
    display.append(text);
    display.setDefaultMessage('Storage CORS needs ETag exposure.');
    const fallback = display.shadowRoot.querySelector('.fallback-message');
    assert.equal(fallback.hidden, false);
    text.data = 'Application error message'; await flush();
    assert.equal(fallback.hidden, true);
    text.data = '\n '; await flush();
    assert.equal(fallback.hidden, false);
    const custom = h.window.document.createElement('strong');
    display.append(custom); await flush();
    assert.equal(fallback.hidden, true);
    custom.remove(); await flush();
    assert.equal(fallback.hidden, false);
    assert.equal(display.firstChild, text);
});

test('clear removes custom and fallback messages without revealing a stale error', async t => {
    const h = setup(t);
    const display = h.uploader.querySelector('chunkify-uploader-error');
    display.setDefaultMessage('Session expired.');
    display.setMessage('Application error message');
    display.clear(); await flush();
    const fallback = display.shadowRoot.querySelector('.fallback-message');
    assert.equal(display.textContent, '');
    assert.equal(fallback.textContent, '');
    assert.equal(fallback.hidden, true);
    display.setDefaultMessage('A new error.');
    assert.equal(fallback.hidden, false);
    assert.equal(fallback.textContent, 'A new error.');
});

for (const failure of ['missing provider', 'invalid session', 'file size']) {
    test(`${failure} displays the validation error instead of custom content`, async t => {
        const h = setup(t);
        const display = h.uploader.querySelector('chunkify-uploader-error');
        display.innerHTML = '<strong>My custom error</strong>';
        if (failure === 'missing provider') h.uploader.upload = undefined;
        if (failure === 'invalid session') h.uploader.upload = { ...multipart(), completion_url: '' };
        if (failure === 'file size') h.uploader.maxFileSize = 1;
        h.choose(failure === 'file size'
            ? new h.window.File([new Uint8Array(1024 * 1024 + 1)], 'large.mp4')
            : h.file);
        await flush();
        assert.equal(display.textContent, h.error().error);
        assert.equal(display.querySelector('strong'), null);
        assert.equal(h.error().status, failure === 'file size' ? -2 : -1);
        assert.equal(h.puts.length, 0);
        assert.equal(h.posts.length, 0);
    });
}

for (const action of ['reset', 'disconnect']) {
    for (const stage of ['provider', 'transfer', 'completion', 'backoff', 'failed']) {
        test(`${action} during ${stage} aborts requests and ignores late results`, async t => {
            const h = setup(t);
            let release;
            if (stage === 'provider') h.uploader.upload = () => new Promise(resolve => { release = resolve; });
            if (stage === 'transfer') h.outcomes.push({ hold: true });
            if (stage === 'completion') h.completions.push(() => new Promise(resolve => { release = resolve; }));
            if (stage === 'backoff') h.outcomes.push({ status: 503 });
            if (stage === 'failed') h.outcomes.push({ status: 403 });
            h.choose(); await flush();
            const errors = h.events.filter(e => e.type === 'upload-error').length;
            if (action === 'reset') h.uploader.dispatchEvent(new h.window.CustomEvent('reset'));
            else h.uploader.remove();
            if (stage === 'transfer') {
                assert.equal(h.puts[0].aborted, true);
                h.puts[0].respond();
            }
            if (stage === 'provider') release(multipart());
            if (stage === 'completion') {
                assert.equal(h.posts[0].signal.aborted, true);
                release({ status: 204 });
            }
            await flush(); await h.tick(300000);
            h.uploader.retry(); await flush();
            assert.equal(h.events.filter(e => e.type === 'upload-error').length, errors);
            assert.equal(h.events.filter(e => e.type === 'upload-success').length, 0);
            assert.equal(h.uploader.hasAttribute('uploading'), false);
            assert.equal(h.uploader.getAttribute('progress'), null);
            assert.equal(h.puts.length, stage === 'provider' ? 0 : stage === 'completion' ? 3 : 1);
            assert.equal(h.posts.length, stage === 'completion' ? 1 : 0);
        });
    }
}

test('explicit reset allows a fresh session, while a used static session cannot be reused', async t => {
    const h = setup(t, single());
    h.choose(); await flush();
    h.uploader.reset();
    h.choose(); await flush();
    assert.match(h.error().error, /already been used/);
    assert.equal(h.puts.length, 1);
    h.uploader.reset();
    h.uploader.upload = { ...single(), completion_url: 'https://api.test/complete-new' };
    h.choose(); await flush();
    assert.equal(h.puts.length, 2);
    assert.equal(h.uploader.hasAttribute('success'), true);
});

for (const session of [
    { ...single(), upload_mode: 'auto' },
    { ...single(), expires_at: undefined },
    { upload_url: single().upload_url, completion_url: single().completion_url },
    { ...multipart(), multipart: { ...multipart().multipart, part_size_bytes: 0 } },
    { ...multipart(), multipart: { ...multipart().multipart, parts: multipart().multipart.parts.slice(1) } },
    { ...multipart(), multipart: { ...multipart().multipart, parts: [1, 1, 3].map(part_number => ({ part_number, upload_url: 'https://storage.test/part' })) } },
    { ...multipart(), multipart: { ...multipart().multipart, expires_at: 'invalid' } },
    { ...single(), upload_url: 'javascript:alert(1)' },
]) {
    test(`invalid session rejected before transfer: ${JSON.stringify(session)}`, async t => {
        const h = setup(t, session);
        h.choose(); await flush();
        assert.equal(h.puts.length, 0);
        assert.equal(h.posts.length, 0);
        assert.equal(h.uploader.hasAttribute('retryable'), false);
        assert.match(h.error().error, /Invalid/);
    });
}


test('session expiry before manual retry does not transfer bytes or request a new session', async t => {
    const session = multipart();
    session.multipart.expires_at = '2026-10-15T10:00:01Z';
    const h = setup(t, session);
    h.outcomes.push({ status: 403 });
    h.choose(); await flush(); await h.tick(1000);
    h.retry(); await flush();
    assert.equal(h.providerCalls(), 1);
    assert.equal(h.puts.length, 1);
    assert.match(h.error().error, /expired.*new session/);
    assert.equal(h.uploader.hasAttribute('retryable'), false);
});

test('transfer 410 explains that a new session is needed', async t => {
    const h = setup(t);
    h.outcomes.push({ status: 410 });
    h.choose(); await flush(); h.retry(); await flush();
    assert.match(h.error().error, /new session/);
    assert.equal(h.puts.length, 1);
});

test('a provider failure can retry with the retained file before any session was accepted', async t => {
    const h = setup(t);
    const files = [];
    h.uploader.upload = async file => {
        files.push(file);
        if (files.length === 1) throw new TypeError('Server unavailable');
        return multipart();
    };
    h.choose(); await flush();
    assert.equal(h.puts.length, 0);
    h.retry(); await flush();
    assert.equal(files.length, 2);
    assert.equal(files[0], files[1]);
    assert.equal(h.uploader.hasAttribute('success'), true);
});

test('a late completion response after reset cannot alter a new upload', async t => {
    const h = setup(t);
    let release;
    h.completions.push(() => new Promise(resolve => { release = resolve; }));
    h.choose(); await flush();
    h.uploader.reset();
    h.uploader.upload = { ...multipart(), completion_url: 'https://api.test/new-completion' };
    h.outcomes.push({ hold: true });
    h.choose(); await flush();
    release({ status: 204 }); await flush();
    assert.equal(h.uploader.hasAttribute('success'), false);
    assert.equal(h.uploader.hasAttribute('uploading'), true);
    h.puts.at(-1).respond(); await flush();
    assert.equal(h.uploader.hasAttribute('success'), true);
    assert.equal(h.events.filter(e => e.type === 'upload-success').length, 1);
});
