import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { Window } from 'happy-dom';

// Bundle the public React entry together with React DOM, as a consumer would.
const { outputFiles } = await build({
    stdin: {
        contents: `import React from 'react';
            import { createRoot } from 'react-dom/client';
            import * as components from './src/react/index';
            export { React, createRoot, components };`,
        resolveDir: process.cwd(), loader: 'js',
    },
    bundle: true, write: false, format: 'iife', globalName: 'integration',
});

test('React provider, error children, progress and Retry use the same retained session', async t => {
    const window = new Window();
    window.IS_REACT_ACT_ENVIRONMENT = true;
    const channels = [];
    window.MessageChannel = class extends MessageChannel {
        constructor() { super(); channels.push(this); }
    };
    const puts = [], posts = [];
    let fail = true;
    window.XMLHttpRequest = class {
        upload = {};
        open(method, url) { this.url = url; }
        setRequestHeader() {}
        getResponseHeader() { return '"part-etag"'; }
        send(body) {
            puts.push({ url: this.url, body });
            queueMicrotask(() => {
                this.status = 200;
                this.upload.onprogress({ lengthComputable: true, loaded: body.size, total: body.size });
                this.onload();
            });
        }
        abort() { this.onabort?.(); }
    };
    window.fetch = async (url, init) => {
        posts.push({ url, ...init });
        return { status: fail ? 503 : 204, headers: new Headers({ 'Retry-After': '31' }), json: async () => ({}) };
    };
    window.eval(outputFiles[0].text);
    const { React, createRoot, components: C } = window.integration;
    const container = window.document.createElement('div');
    window.document.body.append(container);
    const root = createRoot(container);
    const selected = [], errors = [], success = [], progress = [];
    let calls = 0;
    const session = {
        upload_mode: 'multipart', completion_url: 'https://api.test/completion',
        multipart: { part_size_bytes: 4, expires_at: '2099-01-01T00:00:00Z', parts: [
            { part_number: 1, upload_url: 'https://storage.test/1' },
            { part_number: 2, upload_url: 'https://storage.test/2' },
        ] },
    };
    await React.act(async () => root.render(React.createElement(C.ChunkifyUploader, {
        upload: async file => { calls++; assert.equal(file.size, 6); return session; },
        drop: true, maxFileSize: 10,
        onFileSelected: e => selected.push(e.detail),
        onUploadError: e => errors.push(e.detail),
        onUploadSuccess: e => success.push(e.detail),
        onUploadProgress: e => progress.push(e.detail),
    },
    React.createElement(C.ChunkifyUploaderError, null, React.createElement('strong', null, 'My error display')),
    React.createElement(C.ChunkifyUploaderRetry, null, 'Try again'),
    React.createElement(C.ChunkifyUploaderProgressBar))));
    t.after(async () => {
        await React.act(async () => root.unmount());
        channels.forEach(channel => { channel.port1.close(); channel.port2.close(); });
        await window.happyDOM.abort();
    });
    const uploader = container.querySelector('chunkify-uploader');
    assert.equal(uploader.drop, true);
    assert.equal(uploader.maxFileSize, 10);
    const file = new window.File(['abcdef'], 'test.mp4');
    const input = uploader.shadowRoot.querySelector('input');
    Object.defineProperty(input, 'files', { value: [file] });
    await React.act(async () => input.dispatchEvent(new window.Event('change')));
    assert.equal(errors.length, 1);
    assert.equal(selected.length, 1);
    assert.equal(success.length, 0);
    assert.equal(progress.at(-1).progress, 100);
    assert.equal(uploader.querySelector('chunkify-uploader-error strong').textContent, 'My error display');
    fail = false;
    await React.act(async () => uploader.querySelector('chunkify-uploader-retry').click());
    assert.equal(calls, 1);
    assert.equal(puts.length, 2);
    assert.equal(posts.length, 2);
    assert.equal(posts[0].body, posts[1].body);
    assert.equal(success.length, 1);
    assert.equal(success[0].file, file);
});
