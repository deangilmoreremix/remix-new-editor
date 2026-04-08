// Main application class
import { ModalManager } from './utils/ModalManager.js'
import { ContactImporterModal } from './modals/ContactImporterModal.js'

export class App {
    constructor() {
        this.modalManager = new ModalManager()
        this.contacts = []
    }

    init() {
        this.setupEventListeners()
        this.renderInitialView()
    }

    setupEventListeners() {
        // Global event delegation for modal triggers
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-modal-trigger]')) {
                const modalType = e.target.dataset.modalTrigger
                this.showModal(modalType)
            }
        })
    }

    renderInitialView() {
        const app = document.getElementById('app')
        app.innerHTML = `
            <div class="app-container">
                <header class="app-header">
                    <h1>VideoRemix Editor</h1>
                    <nav>
                        <button data-modal-trigger="contact-importer">Import Contacts</button>
                        <button data-modal-trigger="teleprompter">Teleprompter</button>
                        <button data-modal-trigger="template-generator">Templates</button>
                    </nav>
                </header>
                <main class="app-main">
                    <div id="canvas-container">
                        <div class="welcome-message">
                            <h2>Welcome to VideoRemix</h2>
                            <p>Import contacts and start creating personalized videos</p>
                            <div class="contact-count">
                                ${this.contacts.length > 0 ?
                                    `Imported ${this.contacts.length} contacts` :
                                    'No contacts imported yet'
                                }
                            </div>
                        </div>
                    </div>
                    <div id="sidebar">
                        <div class="sidebar-content">
                            <h3>Quick Actions</h3>
                            <ul>
                                <li><a href="#" data-modal-trigger="contact-importer">Import Contacts</a></li>
                                <li><a href="#" data-modal-trigger="teleprompter">Teleprompter</a></li>
                                <li><a href="#" data-modal-trigger="template-generator">Templates</a></li>
                            </ul>
                        </div>
                    </div>
                </main>
            </div>
        `
    }

    showModal(modalType) {
        const modalData = {
            onContactsImported: (contacts) => {
                this.contacts = contacts
                this.updateContactCount()
            }
        }

        this.modalManager.show(modalType, ContactImporterModal, modalData)
    }

    updateContactCount() {
        const contactCountEl = document.querySelector('.contact-count')
        if (contactCountEl) {
            contactCountEl.textContent = `Imported ${this.contacts.length} contacts`
        }
    }
}