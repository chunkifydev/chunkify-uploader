// src/chunkify-error-message.ts
export class ChunkifyUploaderError extends HTMLElement {
    static get observedAttributes() {
        return ['message'];
    }
    
    connectedCallback() {
        this.attachShadow({ mode: 'open' });
        this.render();
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
    
    setMessage(message: string) {
        this.textContent = message;
    }
    
    clear() {
        this.textContent = '';
    }
}

customElements.define('chunkify-uploader-error', ChunkifyUploaderError);