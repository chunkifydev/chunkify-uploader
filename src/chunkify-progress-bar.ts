// src/chunkify-progress-bar.ts
export class ChunkifyProgressBar extends HTMLElement {
    static get observedAttributes() {
        return ['value'];
    }
    
    connectedCallback() {
        this.attachShadow({ mode: 'open' });
        this.render();
    }
    
    attributeChangedCallback() {
        this.updateProgress();
    }
    
    private render() {
        this.shadowRoot!.innerHTML = `
            <style>
                :host {
                    display: var(--progress-bar-display, none);
                    width: 100%;
                }
                
                .progress-container {
                    width: 100%;
                    height: var(--progress-height, 8px);
                    background: var(--progress-background, #e9ecef);
                    border-radius: var(--progress-radius, 4px);
                    border: var(--progress-border, none);
                    overflow: hidden;
                    position: relative;
                }
                
                .progress-fill {
                    height: 100%;
                    width: 0%;
                    background: var(--progress-fill-color, #007bff);
                    border-radius: var(--progress-radius, 4px);
                    transition: width var(--progress-transition, 0.3s ease);
                }
            </style>
            
            <div class="progress-container">
                <div class="progress-fill"></div>
            </div>
        `;
    }
    
    private updateProgress() {
        const value = this.getAttribute('value') || '0';
        const fill = this.shadowRoot?.querySelector('.progress-fill') as HTMLElement;
        if (fill) {
            fill.style.width = `${value}%`;
        }
    }
    
    reset() {
        this.setAttribute('value', '0');
    }
}

customElements.define('chunkify-progress-bar', ChunkifyProgressBar);