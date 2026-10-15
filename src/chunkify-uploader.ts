import './chunkify-uploader-progress-text';
import './chunkify-uploader-progress-bar';
import './chunkify-uploader-file-select';
import './chunkify-uploader-error';
import type { ChunkifyUploaderError } from './chunkify-uploader-error';
import './chunkify-uploader-success';
import './chunkify-uploader-heading';
import './chunkify-uploader-retry';

export interface SingleUploadSession {
    upload_mode: 'single';
    upload_url: string;
    completion_url: string;
    expires_at: string;
}

export interface MultipartUploadSession {
    upload_mode: 'multipart';
    completion_url: string;
    expires_at?: string;
    multipart: {
        part_size_bytes: number;
        parts: { part_number: number; upload_url: string }[];
        expires_at: string;
    };
}

export type UploadSession = SingleUploadSession | MultipartUploadSession;
export interface UploadPart { part_number: number; etag: string; }

interface UploadState {
    file: File;
    session?: UploadSession;
    parts: UploadPart[];
    transferred: boolean;
}

export type UploadProvider = UploadSession | ((file: File) => Promise<UploadSession>);
export interface UploadSuccessDetail { file: File; }
export interface UploadErrorDetail { error: string; status: number; }

class UploadRequestError extends Error {
    constructor(message: string, readonly status: number = 0, readonly retryAfter: number = 0) {
        super(message);
    }

    get retryable() {
        return this.status === 0 || this.status === 408 || this.status === 429 ||
            (this.status >= 500 && this.status < 600);
    }

    get recoverable() {
        // Permissions and exposed ETags can be fixed without replacing the session.
        return this.retryable || this.status === 403 || this.status === -3;
    }
}

export class ChunkifyUploader extends HTMLElement {
    private dropListenersSetup: boolean = false;
    static get observedAttributes() {
        return ['drop'];
    }
    private _upload?: UploadProvider;
    private operation?: AbortController;
    private initialized = false;
    private state?: UploadState;
    private usedSessions = new Set<string>();
    private fileInput!: HTMLInputElement;

    private _onUploadSuccess?: (event: CustomEvent) => void;
    private _onUploadError?: (event: CustomEvent) => void;
    private _onUploadProgress?: (event: CustomEvent) => void;
    private _onFileSelected?: (event: CustomEvent) => void;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        if (!this.initialized) {
            this.render();
            this.cacheElements();
            this.setupEventListeners();
            this.initialized = true;
        }
    }

    disconnectedCallback() {
        this.reset();
    }

    attributeChangedCallback(name: string) {
        if (name === 'drop' && this.drop && !this.dropListenersSetup) {
            this.setupDropListeners();
            this.dropListenersSetup = true;
        }
    }

    private cacheElements() {
        this.fileInput = this.shadowRoot!.querySelector('input[type="file"]')!;
    }

    get onUploadError() {
        return this._onUploadError;
    }

    set onUploadProgress(handler: ((event: CustomEvent) => void) | undefined) {
        if (this._onUploadProgress) this.removeEventListener('upload-progress', this._onUploadProgress as EventListener);
        this._onUploadProgress = handler;
        if (handler) {
            this.addEventListener('upload-progress', handler as EventListener);
        }
    }

    set onUploadSuccess(handler: ((event: CustomEvent) => void) | undefined) {
        if (this._onUploadSuccess) this.removeEventListener('upload-success', this._onUploadSuccess as EventListener);
        this._onUploadSuccess = handler;
        if (handler) {
            this.addEventListener('upload-success', handler as EventListener);
        }
    }

    get onUploadSuccess() {
        return this._onUploadSuccess;
    }

    set onUploadError(handler: ((event: CustomEvent) => void) | undefined) {
        if (this._onUploadError) this.removeEventListener('upload-error', this._onUploadError as EventListener);
        this._onUploadError = handler;
        if (handler) {
            this.addEventListener('upload-error', handler as EventListener);
        }
    }

    get onUploadProgress() {
        return this._onUploadProgress;
    }

    set onFileSelected(handler: ((event: CustomEvent) => void) | undefined) {
        if (this._onFileSelected) this.removeEventListener('file-selected', this._onFileSelected as EventListener);
        this._onFileSelected = handler;
        if (handler) {
            this.addEventListener('file-selected', handler as EventListener);
        }
    }

    get onFileSelected() {
        return this._onFileSelected;
    }

    get upload(): UploadProvider | undefined {
        return this._upload;
    }

    set upload(value: UploadProvider | undefined) {
        this._upload = value;
    }

    get maxFileSize(): number {
        const value = this.getAttribute('max-file-size');
        return value ? parseInt(value, 10) : 0; // 0 means no limit
    }
    
    set maxFileSize(value: number) {
        if (value > 0) {
            this.setAttribute('max-file-size', value.toString());
        } else {
            this.removeAttribute('max-file-size');
        }
    }
    private isDisabled(): boolean {
        return this.hasAttribute('uploading') || this.hasAttribute('error') || this.hasAttribute('success');
    }

    get drop(): boolean {
        return this.hasAttribute('drop');
    }
    
    set drop(value: boolean) {
        this.toggleAttribute('drop', Boolean(value));
    }

    private render() {
        this.shadowRoot!.innerHTML = `
            <style>
                :host {
                    display: flex;
                    flex-direction: column;
                }
                    
                /* Hide sub-components during uploading */
                :host([uploading]) {
                   --file-select-display: none;
                   --progress-text-display: block;
                   --progress-bar-display: block;
                   --heading-display: none;
                }

                :host([error]) {
                    --file-select-display: none;
                    --progress-text-display: none;
                    --progress-bar-display: none;
                    --error-message-display: block;
                    --heading-display: none;
                    --retry-display: block;
                }

                :host([error]:not([retryable])) {
                    --retry-display: none;
                }

                :host([success]) {
                    --file-select-display: none;
                    --progress-text-display: none;
                    --progress-bar-display: none;
                    --success-message-display: block;
                    --heading-display: none;
                }

            </style>
            
            <input type="file" accept="video/*,audio/*" style="display: none;">
            
            <slot></slot>
        `;
    }

    private setupEventListeners() {
        this.addEventListener('file-select-clicked', () => {
            if (!this.isDisabled()) {
                this.fileInput.click();
            }
        });

        if (!this.fileInput) {
            // console.log('FileInput not ready, skipping setupEventListeners');
            return;
        }
    

        this.fileInput.addEventListener('change', (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                this.handleFile(file);
            }
        });

        if (this.hasAttribute('drop') && !this.dropListenersSetup) {
            this.setupDropListeners();
            this.dropListenersSetup = true;
        }

        this.addEventListener('reset', () => {
            this.reset();
        });
        this.addEventListener('retry', () => this.retry());
    }

    private setupDropListeners() {
        this.addEventListener('dragover', (e) => {
            if (!this.drop || this.isDisabled()) return;
            e.preventDefault();
            this.setAttribute('dragover', ''); // Just set the attribute
        });
    
        this.addEventListener('dragleave', (e) => {
            if (!this.drop || this.isDisabled()) return;
            if (!this.contains(e.relatedTarget as Node)) {
                this.removeAttribute('dragover'); // Just remove the attribute
            }
        });
    
        this.addEventListener('drop', (e) => {
            if (!this.drop || this.isDisabled()) return;
            e.preventDefault();
            this.removeAttribute('dragover');
            
            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                this.handleFile(files[0]);
            }
        });
    }


    /** Abort browser requests and discard this file/session. Select a file to start over. */
    reset() {
        this.operation?.abort();
        this.operation = undefined;
        this.state = undefined;
        this.removeAttribute('retryable');
        this.removeAttribute('progress');
        this.removeAttribute('dragover');
        this.removeAttribute('error');
        this.removeAttribute('success');
        this.removeAttribute('uploading');

        // Reset sub-components
        const progressText = this.querySelector('chunkify-uploader-progress-text');
        const progressBar = this.querySelector('chunkify-uploader-progress-bar');
 
        progressText?.setAttribute('value', '0');
        progressBar?.setAttribute('value', '0');
           
        // Reset file input
        if (this.fileInput) this.fileInput.value = '';

        this.dispatchEvent(new CustomEvent('upload-reset', {
            bubbles: true
        }));
    }

    private async handleFile(file: File) {
        if (this.isDisabled()) return;
        if (!this.upload) {
            this.setError('No upload session provider configured.', -1);
            return;
        }
        const maxSize = this.maxFileSize;
        if (maxSize > 0 && file.size > maxSize * 1024 * 1024) {
            this.setError(`File size exceeds the maximum allowed of ${maxSize} MB`, -2);
            return;
        }

        this.state = { file, parts: [], transferred: false };
        await this.runUpload(true);
    }

    /** Resume the current session without creating another session or resending completed parts. */
    retry() {
        if (!this.operation && this.state && this.hasAttribute('retryable')) {
            void this.runUpload();
        }
    }

    private async runUpload(selected = false) {
        const state = this.state!;
        const operation = new AbortController();
        this.operation = operation;
        const { signal } = operation;
        this.removeAttribute('error');
        this.removeAttribute('retryable');
        this.setAttribute('uploading', '');
        if (selected) this.dispatchEvent(new CustomEvent('file-selected', { detail: { file: state.file } }));

        try {
            signal.throwIfAborted();
            if (!state.session) {
                const upload = this.upload;
                const session = typeof upload === 'function' ? await upload(state.file) : upload;
                signal.throwIfAborted();
                state.session = this.validateSession(session, state.file);
                this.usedSessions.add(state.session.completion_url);
            }
            if (!state.transferred) {
                await this.uploadFile(state, signal);
                signal.throwIfAborted();
                state.transferred = true;
            }
            this.updateProgress(100);
            signal.throwIfAborted();
            await this.withRetries(state.session, signal, () => this.completeUpload(state, signal));
            signal.throwIfAborted();
            this.operation = undefined;
            this.state = undefined;
            this.removeAttribute('uploading');
            this.setAttribute('success', '');
            this.dispatchEvent(new CustomEvent<UploadSuccessDetail>('upload-success', {
                detail: { file: state.file },
            }));
        } catch (error) {
            if (signal.aborted) return;
            this.operation = undefined;
            const failure = error as { message?: unknown; status?: unknown } | null;
            const message = typeof failure?.message === 'string' ? failure.message : 'Upload failed';
            const status = typeof failure?.status === 'number' ? failure.status : 0;
            this.toggleAttribute('retryable', new UploadRequestError(message, status).recoverable);
            this.setError(message, status);
        }
    }

    private validateSession(session: UploadSession | undefined, file: File): UploadSession {
        if (!session || !['single', 'multipart'].includes(session.upload_mode)) {
            throw new UploadRequestError('Invalid upload session. Expected single or multipart mode.', -1);
        }
        const urls = [session.completion_url];
        const dates = session.expires_at === undefined ? [] : [session.expires_at];
        let result: UploadSession;
        if (session.upload_mode === 'multipart') {
            const multipart = session.multipart;
            if (!multipart || !Number.isSafeInteger(multipart.part_size_bytes) || multipart.part_size_bytes <= 0 ||
                !Array.isArray(multipart.parts) || multipart.parts.length === 0 || multipart.parts.length > 10000 ||
                multipart.parts.length !== Math.ceil(file.size / multipart.part_size_bytes)) {
                throw new UploadRequestError('Invalid multipart session. Expected a signed URL for every file part.', -1);
            }
            const parts = multipart.parts.map(part => ({ ...part })).sort((a, b) => a.part_number - b.part_number);
            if (parts.some((part, index) => part.part_number !== index + 1)) {
                throw new UploadRequestError('Invalid multipart session. Part numbers must be consecutive, starting at 1.', -1);
            }
            urls.push(...parts.map(part => part.upload_url));
            dates.push(multipart.expires_at);
            result = { ...session, multipart: { ...multipart, parts } };
        } else {
            urls.push(session.upload_url);
            dates.push(session.expires_at);
            result = { ...session };
        }
        for (const url of urls) {
            try {
                if (typeof url !== 'string' || !['https:', 'http:'].includes(new URL(url).protocol)) throw new Error();
            } catch {
                throw new UploadRequestError('Invalid upload session URL.', -1);
            }
        }
        if (dates.some(date => typeof date !== 'string' || !Number.isFinite(Date.parse(date)))) {
            throw new UploadRequestError('Invalid upload session expiry.', -1);
        }
        if (this.usedSessions.has(session.completion_url)) {
            throw new UploadRequestError('This upload session has already been used. Provide a new session.', -1);
        }
        return result;
    }

    private checkExpiry(session: UploadSession) {
        const dates = [session.expires_at];
        if (session.upload_mode === 'multipart') dates.push(session.multipart.expires_at);
        if (dates.some(date => date !== undefined && Date.now() >= Date.parse(date))) {
            throw new UploadRequestError('The upload session expired. Start over with a new session.', 410);
        }
    }

    private async uploadFile(state: UploadState, signal: AbortSignal) {
        const { file } = state;
        const session = state.session!;
        if (session.upload_mode !== 'multipart') {
            await this.withRetries(session, signal, () => this.putFile(file, session.upload_url, file.size, 0, false, signal));
            return;
        }
        const { multipart } = session;
        for (const part of multipart.parts.slice(state.parts.length)) {
            const offset = (part.part_number - 1) * multipart.part_size_bytes;
            const body = file.slice(offset, offset + multipart.part_size_bytes);
            const etag = await this.withRetries(session, signal, () =>
                this.putFile(body, part.upload_url, file.size, offset, true, signal));
            signal.throwIfAborted();
            state.parts.push({ part_number: part.part_number, etag: etag! });
        }
    }

    private putFile(body: Blob, url: string, total: number, offset: number, requireETag: boolean, signal: AbortSignal): Promise<string | null> {
        return new Promise((resolve, reject) => {
            signal.throwIfAborted();
            const xhr = new XMLHttpRequest();
            let settled = false;
            let timeout: ReturnType<typeof setTimeout>;
            const abort = () => xhr.abort();
            const finish = (error?: UploadRequestError, etag: string | null = null) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                signal.removeEventListener('abort', abort);
                if (error) {
                    if (!signal.aborted) this.updateProgress(total ? offset / total * 100 : 0);
                    reject(error);
                } else resolve(etag);
            };
            // An idle timeout allows large single PUTs to keep making progress.
            const resetTimeout = () => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    finish(new UploadRequestError('Upload timed out. Retry the upload.'));
                    xhr.abort();
                }, 120000);
            };
            xhr.upload.onprogress = (event) => {
                if (!signal.aborted && !settled) {
                    resetTimeout();
                    if (event.lengthComputable && total) {
                        this.updateProgress((offset + Math.min(event.loaded, body.size)) / total * 100);
                    }
                }
            };
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    const etag = xhr.getResponseHeader('ETag');
                    if (requireETag && !etag?.trim()) {
                        finish(new UploadRequestError('Storage did not expose the part ETag. Add ETag to the storage CORS exposed headers, then retry.', -3));
                    } else finish(undefined, etag);
                } else {
                    let message = `Upload failed with status: ${xhr.status}`;
                    if (xhr.status === 403) message = 'Storage refused the upload (403). Check storage permissions and signed URL validity, then retry or start over.';
                    if (xhr.status === 410) message = 'The upload session is no longer available. Start over with a new session.';
                    finish(new UploadRequestError(message, xhr.status, this.retryAfter(xhr.getResponseHeader('Retry-After'))));
                }
            };
            xhr.onerror = () => finish(new UploadRequestError('Network error during upload.'));
            xhr.ontimeout = () => finish(new UploadRequestError('Upload timed out. Retry the upload.'));
            xhr.onabort = () => finish(new UploadRequestError('Upload cancelled.'));
            try {
                xhr.open('PUT', url);
                xhr.setRequestHeader('Content-Type', 'application/octet-stream');
                signal.addEventListener('abort', abort, { once: true });
                resetTimeout();
                xhr.send(body);
            } catch {
                finish(new UploadRequestError('Could not send the file to storage.'));
            }
        });
    }

    private async completeUpload(state: UploadState, signal: AbortSignal) {
        signal.throwIfAborted();
        const controller = new AbortController();
        const abort = () => controller.abort();
        const timeout = setTimeout(abort, 30000);
        signal.addEventListener('abort', abort, { once: true });
        try {
            const response = await fetch(state.session!.completion_url, {
                method: 'POST', credentials: 'omit', signal: controller.signal,
                ...(state.session!.upload_mode === 'multipart' ? {
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ parts: state.parts }),
                } : {}),
            });
            if (response.status === 204) return;
            let message = `Upload completion failed with status: ${response.status}`;
            try {
                const body = await response.json();
                if (typeof body?.error?.message === 'string') message = body.error.message;
            } catch { /* Proxies may return errors without a JSON body. */ }
            if (response.status === 410) message = 'The upload session expired or is no longer available. Start over with a new session.';
            throw new UploadRequestError(message, response.status, this.retryAfter(response.headers.get('Retry-After')));
        } catch (error) {
            if (error instanceof UploadRequestError) throw error;
            throw new UploadRequestError('Could not confirm upload completion. Retry to confirm without uploading the file again.');
        } finally {
            clearTimeout(timeout);
            signal.removeEventListener('abort', abort);
        }
    }

    private retryAfter(value: string | null): number {
        return value === null ? 0 : /^\d+$/.test(value)
            ? Number(value) * 1000 : Math.max(0, Date.parse(value) - Date.now()) || 0;
    }

    private async withRetries<T>(session: UploadSession, signal: AbortSignal, request: () => Promise<T>): Promise<T> {
        for (let attempt = 0; ; attempt++) {
            signal.throwIfAborted();
            this.checkExpiry(session);
            try {
                const result = await request();
                signal.throwIfAborted();
                return result;
            } catch (error) {
                signal.throwIfAborted();
                this.checkExpiry(session);
                if (!(error instanceof UploadRequestError)) throw error;
                const delay = Math.max(500 * 2 ** attempt, error.retryAfter);
                if (!error.retryable || attempt === 2 || delay > 30000) throw error;
                await new Promise<void>((resolve, reject) => {
                    const abortWait = () => {
                        clearTimeout(timer);
                        reject(signal.reason);
                    };
                    const timer = setTimeout(() => {
                        signal.removeEventListener('abort', abortWait);
                        resolve();
                    }, delay);
                    signal.addEventListener('abort', abortWait, { once: true });
                });
            }
        }
    }

    private updateProgress(percent: number) {
        this.setAttribute('progress', Math.round(percent).toString());

        // Update sub-components directly
        const progressText = this.querySelector('chunkify-uploader-progress-text');
        const progressBar = this.querySelector('chunkify-uploader-progress-bar');

        progressText?.setAttribute('value', Math.round(percent).toString());
        progressBar?.setAttribute('value', Math.round(percent).toString());

        this.dispatchEvent(
            new CustomEvent('upload-progress', {
                detail: { progress: percent },
            })
        );
    }

    private setError(message: string, status: number) {
        this.setAttribute('error', '');
        this.removeAttribute('uploading');
        const errorDisplay = this.querySelector<ChunkifyUploaderError>('chunkify-uploader-error');
        if (status === -1 || status === -2) {
            errorDisplay?.setMessage(message);
        } else {
            errorDisplay?.setDefaultMessage(message);
        }
        this.dispatchEvent(new CustomEvent<UploadErrorDetail>('upload-error', {
            detail: { error: message, status },
        }));
    }
}

customElements.define('chunkify-uploader', ChunkifyUploader);
