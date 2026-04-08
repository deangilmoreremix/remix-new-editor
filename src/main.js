// Main entry point for vanilla JS application
import { App } from './App.js'
import './styles/main.css'
import './styles/contact-importer.css'

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    const app = new App()
    app.init()

    // Make app globally available for debugging
    window.app = app
})