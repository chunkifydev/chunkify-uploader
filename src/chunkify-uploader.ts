import './chunkify-uploader-progress-text';
import './chunkify-uploader-progress-bar';
import './chunkify-uploader-file-select';
import './chunkify-uploader-error';
import type { ChunkifyUploaderError } from './chunkify-uploader-error';
import './chunkify-uploader-success';
import './chunkify-uploader-heading';
import './chunkify-uploader-retry';

export interface UploadSession {
    upload_url: string;
    completion_url: string;
}

export type UploadProvider = UploadSession | ((file: File) => Promise<UploadSession>);
export interface UploadSuccessDetail { file: File; }
export interface UploadErrorDetail { error: string; status: number; }

class UploadRequestError extends Error {
    constructor(message: string, readonly status: number = 0, readonly retryAfter: number = 0) {
        super(message);
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
        if (this.operation) this.resetState();
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
            this.resetState();
        });
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


    private resetState() {
        this.operation?.abort();
        this.operation = undefined;
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
        this.fileInput.value = '';

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

        const operation = new AbortController();
        this.operation = operation;
        const { signal } = operation;
        this.setAttribute('uploading', '');
        this.dispatchEvent(new CustomEvent('file-selected', { detail: { file } }));

        try {
            signal.throwIfAborted();
            const upload = this.upload;
            const session = typeof upload === 'function' ? await upload(file) : upload;
            signal.throwIfAborted();
            this.validateSession(session);
            this.usedSessions.add(session.completion_url);
            await this.uploadFile(file, session, signal);
            signal.throwIfAborted();
            this.updateProgress(100);
            await this.completeUpload(session, signal);
            signal.throwIfAborted();
            this.operation = undefined;
            this.removeAttribute('uploading');
            this.setAttribute('success', '');
            this.dispatchEvent(new CustomEvent<UploadSuccessDetail>('upload-success', {
                detail: { file },
            }));
        } catch (error) {
            if (signal.aborted) return;
            this.operation = undefined;
            const failure = error as { message?: unknown; status?: unknown } | null;
            const message = typeof failure?.message === 'string' ? failure.message : 'Upload failed';
            const status = typeof failure?.status === 'number' ? failure.status : 0;
            this.setError(message, status);
        }
    }

    private validateSession(session: UploadSession | undefined): asserts session is UploadSession {
        if (!session) {
            throw new UploadRequestError('Invalid upload session. Expected upload_url and completion_url.', -1);
        }
        for (const url of [session.upload_url, session.completion_url]) {
            try {
                if (!['https:', 'http:'].includes(new URL(url).protocol)) throw new Error();
            } catch {
                throw new UploadRequestError('Invalid upload session URL.', -1);
            }
        }
        if (this.usedSessions.has(session.completion_url)) {
            throw new UploadRequestError('This upload session has already been used. Provide a new session.', -1);
        }
    }

    private uploadFile(file: File, session: UploadSession, signal: AbortSignal): Promise<void> {
        return new Promise((resolve, reject) => {
            signal.throwIfAborted();
            const xhr = new XMLHttpRequest();
            const abort = () => xhr.abort();
            const finish = (error?: UploadRequestError) => {
                signal.removeEventListener('abort', abort);
                error ? reject(error) : resolve();
            };
            xhr.upload.onprogress = (event) => {
                if (!signal.aborted && event.lengthComputable) {
                    this.updateProgress(event.loaded / event.total * 100);
                }
            };
            xhr.onload = () => xhr.status >= 200 && xhr.status < 300
                ? finish()
                : finish(new UploadRequestError(`Upload failed with status: ${xhr.status}`, xhr.status));
            xhr.onerror = () => finish(new UploadRequestError('Network error during upload.'));
            xhr.onabort = () => finish(new UploadRequestError('Upload cancelled.'));
            xhr.open('PUT', session.upload_url);
            xhr.setRequestHeader('Content-Type', 'application/octet-stream');
            signal.addEventListener('abort', abort, { once: true });
            xhr.send(file);
        });
    }

    private async completeUpload(session: UploadSession, signal: AbortSignal) {
        for (let attempt = 0; attempt < 3; attempt++) {
            signal.throwIfAborted();
            const controller = new AbortController();
            const abort = () => controller.abort();
            const timeout = setTimeout(abort, 30000);
            signal.addEventListener('abort', abort, { once: true });
            let failure: UploadRequestError;
            try {
                const response = await fetch(session.completion_url, {
                    method: 'POST', credentials: 'omit', signal: controller.signal,
                });
                if (response.status === 204) return;
                let message = `Upload completion failed with status: ${response.status}`;
                try {
                    const body = await response.json();
                    if (typeof body?.error?.message === 'string') message = body.error.message;
                } catch { /* Proxies may return errors without a JSON body. */ }
                const retryAfter = response.headers.get('Retry-After');
                const delay = retryAfter === null ? 0 : /^\d+$/.test(retryAfter)
                    ? Number(retryAfter) * 1000 : Math.max(0, Date.parse(retryAfter) - Date.now()) || 0;
                failure = new UploadRequestError(message, response.status, delay);
            } catch {
                failure = new UploadRequestError('Could not confirm upload completion.');
            } finally {
                clearTimeout(timeout);
                signal.removeEventListener('abort', abort);
            }
            signal.throwIfAborted();
            const retryable = failure.status === 0 || failure.status === 429 || failure.status >= 500;
            const delay = Math.max(500 * 2 ** attempt, failure.retryAfter);
            if (!retryable || attempt === 2 || delay > 30000) throw failure;
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
        if (status < 0) {
            this.querySelector<ChunkifyUploaderError>('chunkify-uploader-error')?.setMessage(message);
        }
        this.dispatchEvent(new CustomEvent<UploadErrorDetail>('upload-error', {
            detail: { error: message, status },
        }));
    }
}

customElements.define('chunkify-uploader', ChunkifyUploader);
