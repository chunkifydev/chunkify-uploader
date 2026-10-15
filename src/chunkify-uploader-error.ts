// src/chunkify-error-message.ts
export class ChunkifyUploaderError extends HTMLElement {
    private defaultMessage = '';
    private contentObserver = new MutationObserver(() => this.updateDefaultMessage());

    static get observedAttributes() {
        return ['message'];
    }
    
    connectedCallback() {
        if (!this.shadowRoot) {
            this.attachShadow({ mode: 'open' });
            this.render();
        }
        this.contentObserver.observe(this, { childList: true, characterData: true, subtree: true });
        this.updateDefaultMessage();
    }

    disconnectedCallback() {
        this.contentObserver.disconnect();
    }
      
    private render() {
        this.shadowRoot!.innerHTML = `
            <style>
                :host {
                    display: var(--error-message-display, none) !important;
                }
            </style>
            <slot></slot>
            <span class="fallback-message" hidden></span>
        `;
    }
    
    setDefaultMessage(message: string) {
        this.defaultMessage = message;
        this.updateDefaultMessage();
    }

    private updateDefaultMessage() {
        const slot = this.shadowRoot?.querySelector('slot');
        const fallback = this.shadowRoot?.querySelector<HTMLElement>('.fallback-message');
        if (!slot || !fallback) return;
        // Keep formatting whitespace in place so React retains ownership of its nodes.
        const hasCustomContent = slot.assignedNodes().some(node =>
            node.nodeType === Node.ELEMENT_NODE || Boolean(node.textContent?.trim()));
        fallback.textContent = this.defaultMessage;
        fallback.hidden = hasCustomContent || !this.defaultMessage;
    }

    setMessage(message: string) {
        this.textContent = message;
        this.updateDefaultMessage();
    }
    
    clear() {
        this.defaultMessage = '';
        this.textContent = '';
        this.updateDefaultMessage();
    }
}

customElements.define('chunkify-uploader-error', ChunkifyUploaderError);
