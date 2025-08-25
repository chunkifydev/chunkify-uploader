// src/chunkify-heading.ts
export class ChunkifyHeading extends HTMLElement {
    connectedCallback() {
        this.attachShadow({ mode: 'open' });
        this.render();
    }
    
    private render() {
        this.shadowRoot!.innerHTML = `
            <style>
                :host {
                    display: var(--heading-display, block);
                }
            </style>
            
            <slot>Drop your file here</slot>
        `;
    }
}

customElements.define('chunkify-heading', ChunkifyHeading);