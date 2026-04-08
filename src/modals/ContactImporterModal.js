// Contact Importer Modal - Vanilla JS version
import { BaseModal } from '../utils/ModalManager.js'
import Papa from 'papaparse'

export class ContactImporterModal extends BaseModal {
    constructor(data = {}) {
        super(data)
        this.step = 1
        this.file = null
        this.contacts = []
        this.columnMapping = {}
        this.isProcessing = false
        this.previewContacts = []
        this.onContactsImported = data.onContactsImported || (() => {})
    }

    render() {
        this.content.innerHTML = `
            <div class="contact-importer-modal">
                <div class="modal-header">
                    <div class="modal-title-section">
                        <div class="modal-icon">📊</div>
                        <div>
                            <h2 class="modal-title">Import Contacts</h2>
                            <p class="modal-subtitle">Upload CSV file to create personalized videos</p>
                        </div>
                    </div>
                    <button class="close-btn" id="close-btn">×</button>
                </div>

                <div class="modal-body">
                    ${this.renderStepContent()}
                </div>
            </div>
        `

        this.attachEventListeners()
    }

    renderStepContent() {
        if (this.isProcessing) {
            return '<div class="processing-overlay"><div class="spinner"></div><p>Processing CSV file...</p></div>'
        }

        switch (this.step) {
            case 1: return this.renderStep1()
            case 2: return this.renderStep2()
            case 3: return this.renderStep3()
            default: return ''
        }
    }

    renderStep1() {
        return `
            <div class="contact-importer-step">
                <div class="upload-zone" id="upload-zone">
                    <div class="upload-icon">📁</div>
                    <h3 class="upload-title">Upload Contacts CSV</h3>
                    <p class="upload-subtitle">
                        Drag and drop your CSV file here, or click to browse
                    </p>
                    <div class="upload-requirements">
                        <p>CSV should include columns like:</p>
                        <ul>
                            <li>Email (required)</li>
                            <li>First Name</li>
                            <li>Last Name</li>
                            <li>Company</li>
                            <li>Website</li>
                            <li>LinkedIn Profile</li>
                        </ul>
                    </div>
                    <input type="file" id="file-input" accept=".csv" style="display: none;">
                </div>
            </div>
        `
    }

    renderStep2() {
        const tokenFields = [
            { key: 'email', label: 'Email', required: true },
            { key: 'firstName', label: 'First Name', required: false },
            { key: 'lastName', label: 'Last Name', required: false },
            { key: 'company', label: 'Company', required: false },
            { key: 'website', label: 'Website', required: false },
            { key: 'linkedin', label: 'LinkedIn Profile', required: false },
            { key: 'phone', label: 'Phone', required: false },
            { key: 'title', label: 'Job Title', required: false },
            { key: 'industry', label: 'Industry', required: false },
            { key: 'custom1', label: 'Custom Field 1', required: false },
            { key: 'custom2', label: 'Custom Field 2', required: false }
        ]

        return `
            <div class="contact-importer-step">
                <h3 class="step-title">Map CSV Columns to Contact Fields</h3>
                <div class="mapping-grid">
                    ${tokenFields.map(field => `
                        <div class="mapping-row">
                            <label class="field-label">
                                ${field.label}
                                ${field.required ? '<span class="required">*</span>' : ''}
                            </label>
                            <select class="csv-column-select" data-field="${field.key}">
                                <option value="">-- Select Column --</option>
                                ${Object.keys(this.contacts[0] || {}).map(column => `
                                    <option value="${column}" ${this.columnMapping[field.key] === column ? 'selected' : ''}>
                                        ${column}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                    `).join('')}
                </div>
                <div class="step-actions">
                    <button class="back-btn" id="back-btn">Back</button>
                    <button class="next-btn" id="next-btn">Preview</button>
                </div>
            </div>
        `
    }

    renderStep3() {
        return `
            <div class="contact-importer-step">
                <h3 class="step-title">Preview Contacts (${this.contacts.length} total)</h3>
                <div class="preview-table">
                    <div class="preview-header">
                        ${Object.keys(this.columnMapping).map(field => `
                            <div class="preview-cell header">${field}</div>
                        `).join('')}
                    </div>
                    ${this.previewContacts.map((contact, index) => `
                        <div class="preview-row">
                            ${Object.keys(this.columnMapping).map(field => `
                                <div class="preview-cell">${contact[this.columnMapping[field]] || '-'}</div>
                            `).join('')}
                        </div>
                    `).join('')}
                    ${this.contacts.length > 5 ? `
                        <div class="preview-more">... and ${this.contacts.length - 5} more contacts</div>
                    ` : ''}
                </div>
                <div class="step-actions">
                    <button class="back-btn" id="back-btn-step3">Back</button>
                    <button class="import-btn" id="import-btn">Import ${this.contacts.length} Contacts</button>
                </div>
            </div>
        `
    }

    attachEventListeners() {
        // Close button
        const closeBtn = this.content.querySelector('#close-btn')
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide())
        }

        if (this.step === 1) {
            this.attachStep1Listeners()
        } else if (this.step === 2) {
            this.attachStep2Listeners()
        } else if (this.step === 3) {
            this.attachStep3Listeners()
        }
    }

    attachStep1Listeners() {
        const uploadZone = this.content.querySelector('#upload-zone')
        const fileInput = this.content.querySelector('#file-input')

        if (uploadZone && fileInput) {
            uploadZone.addEventListener('click', () => fileInput.click())
            fileInput.addEventListener('change', (e) => this.handleFileUpload(e))
        }
    }

    attachStep2Listeners() {
        const backBtn = this.content.querySelector('#back-btn')
        const nextBtn = this.content.querySelector('#next-btn')
        const selects = this.content.querySelectorAll('.csv-column-select')

        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.step = 1
                this.render()
            })
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.step = 3
                this.setPreviewContacts()
                this.render()
            })
        }

        selects.forEach(select => {
            select.addEventListener('change', (e) => {
                this.columnMapping[e.target.dataset.field] = e.target.value
            })
        })
    }

    attachStep3Listeners() {
        const backBtn = this.content.querySelector('#back-btn-step3')
        const importBtn = this.content.querySelector('#import-btn')

        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.step = 2
                this.render()
            })
        }

        if (importBtn) {
            importBtn.addEventListener('click', () => this.handleImport())
        }
    }

    async handleFileUpload(event) {
        const file = event.target.files[0]
        if (!file) return

        if (!file.name.toLowerCase().endsWith('.csv')) {
            this.showError('Please upload a CSV file')
            return
        }

        this.file = file
        this.isProcessing = true
        this.render()

        try {
            const text = await file.text()
            const result = Papa.parse(text, {
                header: true,
                skipEmptyLines: true
            })

            this.contacts = result.data
            this.autoDetectMappings()
            this.step = 2
            this.isProcessing = false
            this.render()
        } catch (error) {
            this.showError('Failed to parse CSV file')
            console.error('CSV parsing error:', error)
            this.isProcessing = false
            this.render()
        }
    }

    autoDetectMappings() {
        if (this.contacts.length === 0) return

        const firstRow = this.contacts[0]
        Object.keys(firstRow).forEach(header => {
            const lowerHeader = header.toLowerCase()
            if (lowerHeader.includes('email')) {
                this.columnMapping.email = header
            } else if (lowerHeader.includes('first name') || lowerHeader === 'firstname') {
                this.columnMapping.firstName = header
            } else if (lowerHeader.includes('last name') || lowerHeader === 'lastname') {
                this.columnMapping.lastName = header
            } else if (lowerHeader.includes('company')) {
                this.columnMapping.company = header
            } else if (lowerHeader.includes('website') || lowerHeader.includes('site')) {
                this.columnMapping.website = header
            } else if (lowerHeader.includes('linkedin')) {
                this.columnMapping.linkedin = header
            } else if (lowerHeader.includes('phone')) {
                this.columnMapping.phone = header
            } else if (lowerHeader.includes('title') || lowerHeader.includes('job')) {
                this.columnMapping.title = header
            }
        })
    }

    setPreviewContacts() {
        this.previewContacts = this.contacts.slice(0, 5)
    }

    validateContacts() {
        const validated = []
        const errors = []

        this.contacts.forEach((contact, index) => {
            const validatedContact = {}
            let hasEmail = false

            Object.entries(this.columnMapping).forEach(([tokenField, csvColumn]) => {
                if (contact[csvColumn]) {
                    validatedContact[tokenField] = contact[csvColumn]
                    if (tokenField === 'email') {
                        hasEmail = true
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                        if (!emailRegex.test(contact[csvColumn])) {
                            errors.push(`Row ${index + 2}: Invalid email format`)
                        }
                    }
                }
            })

            if (hasEmail) {
                validated.push(validatedContact)
            } else {
                errors.push(`Row ${index + 2}: Missing email address`)
            }
        })

        if (errors.length > 0) {
            this.showError(`Found ${errors.length} validation errors:\n${errors.slice(0, 5).join('\n')}`)
            return validated.slice(0, validated.length - errors.length)
        }

        return validated
    }

    handleImport() {
        const validatedContacts = this.validateContacts()

        if (validatedContacts.length === 0) {
            this.showError('No valid contacts found')
            return
        }

        // Remove duplicates based on email
        const uniqueContacts = validatedContacts.filter((contact, index, self) =>
            index === self.findIndex(c => c.email === contact.email)
        )

        const duplicates = validatedContacts.length - uniqueContacts.length

        if (duplicates > 0) {
            this.showSuccess(`Imported ${uniqueContacts.length} contacts (${duplicates} duplicates removed)`)
        } else {
            this.showSuccess(`Successfully imported ${uniqueContacts.length} contacts`)
        }

        if (this.onContactsImported) {
            this.onContactsImported(uniqueContacts)
        }

        this.hide()
    }

    showError(message) {
        // Simple alert for now - could be enhanced with toast notifications
        alert(`Error: ${message}`)
    }

    showSuccess(message) {
        alert(`Success: ${message}`)
    }
}