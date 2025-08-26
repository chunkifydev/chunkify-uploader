// src/chunkify-error-message.ts
export class ChunkifyUploaderError extends HTMLElement {
    static get observedAttributes() {
        return ['message'];
    }
    
    connectedCallback() {
        this.attachShadow({ mode: 'open' });
        this.render();
    }
    
    attributeChangedCallback() {
        this.updateMessage();
    }
    
    private render() {
        this.shadowRoot!.innerHTML = `
            <style>
                :host {
                    display: var(--error-message-display, none) !important;
                }
            </style>
            <slot></slot>
        `;
    }
    
    private updateMessage() {
        const message = this.getAttribute('message');
        if (message) {
            // Set text content directly on the host
            this.textContent = message;
        }
    }
    
    setMessage(message: string) {
        this.setAttribute('message', message);
    }
    
    clear() {
        this.removeAttribute('message');
        this.textContent = '';
    }
}

customElements.define('chunkify-uploader-error', ChunkifyUploaderError);