// src/chunkify-success-message.ts
export class ChunkifyUploaderSuccess extends HTMLElement {
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
                    display: var(--success-message-display, none);
                }
            </style>
            
            <slot></slot>
        `;
    }
    
    private updateMessage() {
        const message = this.getAttribute('message');
        if (message) {
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

customElements.define('chunkify-uploader-success', ChunkifyUploaderSuccess);