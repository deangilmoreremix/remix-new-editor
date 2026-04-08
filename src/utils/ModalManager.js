// Base Modal class for all modals
export class BaseModal {
    constructor(data = {}) {
        this.data = data
        this.overlay = null
        this.content = null
        this.isVisible = false
    }

    createOverlay() {
        this.overlay = document.createElement('div')
        this.overlay.className = 'modal-overlay'
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.hide()
            }
        })
        document.body.appendChild(this.overlay)
    }

    createContent() {
        this.content = document.createElement('div')
        this.content.className = 'modal-content'
        this.overlay.appendChild(this.content)
    }

    show() {
        if (this.isVisible) return

        this.createOverlay()
        this.createContent()
        this.render()
        this.isVisible = true

        // Prevent body scroll
        document.body.style.overflow = 'hidden'

        // Focus management
        this.content.focus()
    }

    hide() {
        if (!this.isVisible) return

        if (this.overlay) {
            this.overlay.remove()
            this.overlay = null
        }
        this.content = null
        this.isVisible = false

        // Restore body scroll
        document.body.style.overflow = ''
    }

    render() {
        // Override in subclasses
        this.content.innerHTML = '<div class="modal-loading">Loading...</div>'
    }

    destroy() {
        this.hide()
    }
}

// Modal state management
export class ModalManager {
    constructor() {
        this.activeModals = new Map()
        this.modalStack = []
    }

    show(modalId, ModalClass, data = {}) {
        // Hide current modal if exists
        if (this.modalStack.length > 0) {
            const currentModal = this.modalStack[this.modalStack.length - 1]
            currentModal.hide()
        }

        // Create and show new modal
        const modal = new ModalClass(data)
        modal.id = modalId

        this.activeModals.set(modalId, modal)
        this.modalStack.push(modal)

        modal.show()

        return modal
    }

    hide(modalId) {
        const modal = this.activeModals.get(modalId)
        if (modal) {
            modal.hide()
            this.activeModals.delete(modalId)
            this.modalStack = this.modalStack.filter(m => m.id !== modalId)
        }

        // Show previous modal if exists
        if (this.modalStack.length > 0) {
            const previousModal = this.modalStack[this.modalStack.length - 1]
            previousModal.show()
        }
    }

    hideTop() {
        if (this.modalStack.length > 0) {
            const topModal = this.modalStack.pop()
            topModal.hide()
            this.activeModals.delete(topModal.id)
        }
    }
}