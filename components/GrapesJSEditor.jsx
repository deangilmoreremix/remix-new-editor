// GrapesJSEditor - Professional visual landing page builder using GrapesJS
import React, { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import PropTypes from '../lib/PropTypes';
import { showError, showSuccess } from '../lib/services/alertService';

// Dynamic imports to avoid SSR issues
let grapesjs = null;
let webpagePreset = null;
let basicBlocks = null;
let formsPlugin = null;
let navbarPlugin = null;

const GrapesJSEditor = ({
  video,
  contact = {},
  initialTemplate,
  onPageChange,
  onSave,
  className
}) => {
  const editorRef = useRef(null);
  const editorInstanceRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Available tokens for personalization
  const availableTokens = [
    { label: 'First Name', token: '{{firstName}}', value: contact.firstName || 'John' },
    { label: 'Last Name', token: '{{lastName}}', value: contact.lastName || 'Doe' },
    { label: 'Company', token: '{{company}}', value: contact.company || 'Acme Inc' },
    { label: 'Email', token: '{{email}}', value: contact.email || 'john@acme.com' },
    { label: 'Website', token: '{{website}}', value: contact.website || 'https://acme.com' },
    { label: 'Industry', token: '{{industry}}', value: contact.industry || 'Technology' },
    { label: 'Title', token: '{{title}}', value: contact.title || 'CEO' },
    { label: 'Video URL', token: '{{videoUrl}}', value: video?.url || '' },
    { label: 'Thumbnail URL', token: '{{thumbnail}}', value: video?.thumbnail || '' }
  ];

  // Load GrapesJS dynamically (client-side only)
  useEffect(() => {
    const loadGrapesJS = async () => {
      try {
        // Import GrapesJS and plugins
        grapesjs = (await import('grapesjs')).default;
        webpagePreset = (await import('grapesjs-preset-webpage')).default;
        basicBlocks = (await import('grapesjs-blocks-basic')).default;
        formsPlugin = (await import('grapesjs-plugin-forms')).default;
        navbarPlugin = (await import('grapesjs-navbar')).default;

        initializeEditor();
      } catch (error) {
        console.error('Failed to load GrapesJS:', error);
        showError('Failed to load page editor');
        setIsLoading(false);
      }
    };

    if (typeof window !== 'undefined') {
      loadGrapesJS();
    }

    return () => {
      // Cleanup editor instance
      if (editorInstanceRef.current) {
        editorInstanceRef.current.destroy();
        editorInstanceRef.current = null;
      }
    };
  }, []);

  // Initialize GrapesJS editor
  const initializeEditor = () => {
    if (!grapesjs || !editorRef.current) return;

    const editor = grapesjs.init({
      container: editorRef.current,
      height: '600px',
      width: 'auto',

      // Storage manager (disable auto-save)
      storageManager: {
        type: 'none'
      },

      // Asset manager
      assetManager: {
        assets: [],
        upload: false,
        uploadText: 'Upload images',
        addBtnText: 'Add Image',
        modalTitle: 'Select Image'
      },

      // Block manager
      blockManager: {
        appendTo: '#blocks-container'
      },

      // Style manager
      styleManager: {
        appendTo: '#styles-container',
        sectors: [
          {
            name: 'General',
            open: false,
            buildProps: ['float', 'display', 'position', 'top', 'right', 'bottom', 'left']
          },
          {
            name: 'Dimension',
            open: false,
            buildProps: ['width', 'height', 'max-width', 'min-height', 'margin', 'padding']
          },
          {
            name: 'Typography',
            open: false,
            buildProps: ['font-family', 'font-size', 'font-weight', 'letter-spacing', 'color', 'line-height', 'text-align', 'text-decoration', 'text-shadow']
          },
          {
            name: 'Decorations',
            open: false,
            buildProps: ['background-color', 'border-radius', 'border', 'box-shadow', 'background']
          },
          {
            name: 'Extra',
            open: false,
            buildProps: ['opacity', 'transition', 'perspective', 'transform']
          }
        ]
      },

      // Layer manager
      layerManager: {
        appendTo: '#layers-container'
      },

      // Device manager for responsive design
      deviceManager: {
        devices: [
          { name: 'Desktop', width: '', widthMedia: '' },
          { name: 'Tablet', width: '768px', widthMedia: '768px' },
          { name: 'Mobile', width: '320px', widthMedia: '320px' }
        ]
      },

      // Plugins
      plugins: [
        webpagePreset,
        basicBlocks,
        formsPlugin,
        navbarPlugin
      ],

      pluginsOpts: {
        'grapesjs-preset-webpage': {
          modalImportTitle: 'Import Template',
          modalImportLabel: 'Paste here your HTML/CSS and click import',
          modalImportContent: function(editor) {
            return editor.getHtml() + '<style>' + editor.getCss() + '</style>';
          }
        },
        'grapesjs-blocks-basic': {},
        'grapesjs-plugin-forms': {},
        'grapesjs-navbar': {}
      }
    });

    editorInstanceRef.current = editor;

    // Add custom components for video personalization
    addCustomComponents(editor);

    // Load initial template
    if (initialTemplate) {
      loadTemplate(editor, initialTemplate);
    } else {
      loadDefaultTemplate(editor);
    }

    // Listen for changes
    editor.on('change', () => {
      const html = editor.getHtml();
      const css = editor.getCss();
      const js = editor.getJs();

      if (onPageChange) {
        onPageChange({ html, css, js });
      }
    });

    setIsLoading(false);
  };

  // Add custom components for video personalization
  const addCustomComponents = (editor) => {
    // Personalized Video Component
    editor.Blocks.add('personalized-video', {
      label: 'Personalized Video',
      category: 'Video',
      attributes: { class: 'fa fa-video-camera' },
      content: {
        type: 'video',
        src: '{{videoUrl}}',
        controls: true,
        poster: '{{thumbnail}}',
        style: {
          width: '100%',
          maxWidth: '600px',
          margin: '0 auto',
          borderRadius: '8px'
        }
      }
    });

    // Personalized Text Component
    editor.Blocks.add('personalized-text', {
      label: 'Personalized Text',
      category: 'Basic',
      attributes: { class: 'fa fa-font' },
      content: {
        type: 'text',
        content: 'Hi {{firstName}} from {{company}}!',
        style: {
          padding: '20px',
          textAlign: 'center',
          fontSize: '24px',
          fontWeight: 'bold'
        }
      }
    });

    // Call-to-Action Button
    editor.Blocks.add('cta-button', {
      label: 'CTA Button',
      category: 'Basic',
      attributes: { class: 'fa fa-hand-pointer-o' },
      content: {
        type: 'link',
        content: 'Schedule a Call',
        href: 'https://calendly.com',
        style: {
          display: 'inline-block',
          padding: '12px 24px',
          backgroundColor: '#007bff',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '6px',
          fontWeight: '600',
          margin: '10px auto',
          textAlign: 'center'
        }
      }
    });

    // Contact Info Card
    editor.Blocks.add('contact-card', {
      label: 'Contact Card',
      category: 'Basic',
      attributes: { class: 'fa fa-user' },
      content: {
        type: 'div',
        style: {
          backgroundColor: '#f8f9fa',
          padding: '20px',
          borderRadius: '8px',
          textAlign: 'center',
          margin: '20px auto',
          maxWidth: '400px'
        },
        components: [
          {
            type: 'text',
            content: '{{firstName}} {{lastName}}',
            style: { fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }
          },
          {
            type: 'text',
            content: '{{title}} at {{company}}',
            style: { color: '#666', marginBottom: '8px' }
          },
          {
            type: 'text',
            content: '{{email}}',
            style: { color: '#007bff', marginBottom: '8px' }
          }
        ]
      }
    });

    // Add token insertion panel
    addTokenPanel(editor);
  };

  // Add token insertion panel
  const addTokenPanel = (editor) => {
    const panelManager = editor.Panels;

    // Add custom panel for tokens
    panelManager.addPanel({
      id: 'tokens-panel',
      el: '#tokens-panel',
      buttons: []
    });

    // Add token buttons
    availableTokens.forEach(token => {
      panelManager.addButton('tokens-panel', {
        id: `token-${token.token}`,
        className: 'token-btn',
        label: token.label,
        command: (editor) => {
          const selected = editor.getSelected();
          if (selected) {
            const content = selected.get('content') || '';
            selected.set('content', content + token.token);
          }
        }
      });
    });
  };

  // Load template into editor
  const loadTemplate = (editor, template) => {
    if (template.html && template.css) {
      editor.setComponents(template.html);
      editor.setStyle(template.css);
      if (template.js) {
        editor.setScript(template.js);
      }
    }
  };

  // Load default template
  const loadDefaultTemplate = (editor) => {
    const defaultTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <header style="text-align: center; padding: 40px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 32px;">Personal Video Message</h1>
          <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">Just for you, {{firstName}}!</p>
        </header>

        <div style="text-align: center; margin-bottom: 30px;">
          <video controls poster="{{thumbnail}}" style="width: 100%; max-width: 500px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            <source src="{{videoUrl}}" type="video/mp4">
          </video>
        </div>

        <div style="background: #f8f9fa; padding: 30px; border-radius: 8px; margin-bottom: 30px; text-align: center;">
          <h2 style="margin-top: 0; color: #333;">Hi {{firstName}} from {{company}}!</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #666; margin-bottom: 20px;">
            I recorded this personal video just for you. I noticed {{company}} is doing great work in the {{industry}} space.
          </p>
        </div>

        <div style="text-align: center;">
          <a href="https://calendly.com" style="display: inline-block; padding: 15px 30px; background-color: #007bff; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 8px rgba(0,123,255,0.3);">
            Schedule a Call
          </a>
        </div>

        <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 14px;">
          <p>This video was personalized for {{firstName}} {{lastName}} ({{email}})</p>
        </footer>
      </div>
    `;

    editor.setComponents(defaultTemplate);
  };

  // Save current page
  const handleSave = async () => {
    if (!editorInstanceRef.current) return;

    setIsSaving(true);

    try {
      const editor = editorInstanceRef.current;
      const html = editor.getHtml();
      const css = editor.getCss();
      const js = editor.getJs();

      const pageData = {
        html,
        css,
        js,
        video,
        contact,
        createdAt: new Date().toISOString(),
        tokens: availableTokens
      };

      if (onSave) {
        await onSave(pageData);
      }

      showSuccess('Landing page saved successfully!');
    } catch (error) {
      console.error('Failed to save page:', error);
      showError('Failed to save landing page');
    } finally {
      setIsSaving(false);
    }
  };

  // Replace tokens in content
  const replaceTokens = (content) => {
    if (!content) return content;
    let result = content;
    availableTokens.forEach(token => {
      result = result.replace(new RegExp(token.token, 'g'), token.value);
    });
    return result;
  };

  // Preview with tokens replaced
  const handlePreview = () => {
    if (!editorInstanceRef.current) return;

    const editor = editorInstanceRef.current;
    const html = editor.getHtml();
    const css = editor.getCss();

    // Create preview window
    const previewWindow = window.open('', '_blank');
    previewWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Landing Page Preview</title>
          <style>${css}</style>
        </head>
        <body>
          ${replaceTokens(html)}
        </body>
      </html>
    `);
  };

  if (isLoading) {
    return (
      <div className="grapesjs-loading">
        <div className="loading-spinner"></div>
        <p>Loading page editor...</p>
      </div>
    );
  }

  return (
    <div className={classnames('grapesjs-editor', className)}>
      {/* Toolbar */}
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <h3>Visual Page Editor</h3>
          <span className="editor-subtitle">Drag and drop to build your landing page</span>
        </div>
        <div className="toolbar-right">
          <button
            className="btn btn-secondary"
            onClick={handlePreview}
            disabled={!editorInstanceRef.current}
          >
            👁️ Preview
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? '💾 Saving...' : '💾 Save Page'}
          </button>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="editor-main">
        {/* Sidebar */}
        <div className="editor-sidebar">
          {/* Blocks Panel */}
          <div className="panel-section">
            <h4>📦 Components</h4>
            <div id="blocks-container"></div>
          </div>

          {/* Styles Panel */}
          <div className="panel-section">
            <h4>🎨 Styles</h4>
            <div id="styles-container"></div>
          </div>

          {/* Layers Panel */}
          <div className="panel-section">
            <h4>📑 Layers</h4>
            <div id="layers-container"></div>
          </div>

          {/* Tokens Panel */}
          <div className="panel-section">
            <h4>🏷️ Personalization Tokens</h4>
            <div id="tokens-container">
              <p className="tokens-help">
                Click any token to insert it into selected text:
              </p>
              <div id="tokens-panel" className="tokens-panel">
                {availableTokens.map(token => (
                  <button
                    key={token.token}
                    className="token-btn"
                    onClick={() => {
                      if (editorInstanceRef.current) {
                        const selected = editorInstanceRef.current.getSelected();
                        if (selected) {
                          const content = selected.get('content') || '';
                          selected.set('content', content + token.token);
                        }
                      }
                    }}
                    title={`Inserts: ${token.value}`}
                  >
                    {token.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="editor-canvas">
          <div className="canvas-header">
            <div className="device-selector">
              <button className="device-btn active">🖥️ Desktop</button>
              <button className="device-btn">📱 Tablet</button>
              <button className="device-btn">📱 Mobile</button>
            </div>
          </div>
          <div
            ref={editorRef}
            className="grapesjs-canvas"
            style={{ height: '600px', border: '1px solid #ddd' }}
          ></div>
        </div>
      </div>

      {/* Help Section */}
      <div className="editor-help">
        <h4>💡 Tips for Creating Great Landing Pages</h4>
        <div className="help-grid">
          <div className="help-item">
            <span className="help-icon">🎬</span>
            <div>
              <strong>Video First</strong>
              <p>Place your personalized video prominently at the top</p>
            </div>
          </div>
          <div className="help-item">
            <span className="help-icon">🏷️</span>
            <div>
              <strong>Use Tokens</strong>
              <p>Personalize with {{firstName}}, {{company}}, etc.</p>
            </div>
          </div>
          <div className="help-item">
            <span className="help-icon">📱</span>
            <div>
              <strong>Mobile Friendly</strong>
              <p>Test on tablet and mobile views</p>
            </div>
          </div>
          <div className="help-item">
            <span className="help-icon">🎯</span>
            <div>
              <strong>Clear CTA</strong>
              <p>Include one prominent call-to-action button</p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .grapesjs-editor {
          background: #f8f9fa;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .grapesjs-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 400px;
          color: #666;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #007bff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .editor-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          background: white;
          border-bottom: 1px solid #e0e0e0;
        }

        .toolbar-left h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }

        .editor-subtitle {
          color: #666;
          font-size: 14px;
        }

        .toolbar-right {
          display: flex;
          gap: 12px;
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #007bff;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #0056b3;
        }

        .btn-secondary {
          background: #f8f9fa;
          color: #333;
          border: 1px solid #ddd;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #e9ecef;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .editor-main {
          display: flex;
          height: 600px;
        }

        .editor-sidebar {
          width: 300px;
          background: white;
          border-right: 1px solid #e0e0e0;
          overflow-y: auto;
        }

        .panel-section {
          padding: 16px;
          border-bottom: 1px solid #f0f0f0;
        }

        .panel-section h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 600;
          color: #333;
        }

        .editor-canvas {
          flex: 1;
          background: #f0f2f5;
        }

        .canvas-header {
          padding: 8px 16px;
          background: white;
          border-bottom: 1px solid #e0e0e0;
        }

        .device-selector {
          display: flex;
          gap: 4px;
        }

        .device-btn {
          padding: 6px 12px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
        }

        .device-btn.active {
          background: #007bff;
          color: white;
          border-color: #007bff;
        }

        .grapesjs-canvas {
          background: white;
        }

        .tokens-help {
          font-size: 12px;
          color: #666;
          margin-bottom: 8px;
        }

        .tokens-panel {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .token-btn {
          padding: 4px 8px;
          font-size: 11px;
          background: #e3f2fd;
          color: #1565c0;
          border: 1px solid #bbdefb;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .token-btn:hover {
          background: #bbdefb;
          border-color: #90caf9;
        }

        .editor-help {
          padding: 20px;
          background: white;
          border-top: 1px solid #e0e0e0;
        }

        .editor-help h4 {
          margin: 0 0 16px 0;
          font-size: 16px;
          font-weight: 600;
        }

        .help-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
        }

        .help-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px;
          background: #f8f9fa;
          border-radius: 6px;
        }

        .help-icon {
          font-size: 20px;
          flex-shrink: 0;
        }

        .help-item strong {
          display: block;
          margin-bottom: 4px;
          color: #333;
        }

        .help-item p {
          margin: 0;
          font-size: 14px;
          color: #666;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .editor-toolbar {
            flex-direction: column;
            gap: 12px;
            align-items: stretch;
          }

          .editor-main {
            flex-direction: column;
            height: auto;
          }

          .editor-sidebar {
            width: 100%;
            order: 2;
          }

          .editor-canvas {
            order: 1;
            height: 400px;
          }

          .help-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

GrapesJSEditor.propTypes = {
  video: PropTypes.object,
  contact: PropTypes.object,
  initialTemplate: PropTypes.object,
  onPageChange: PropTypes.func,
  onSave: PropTypes.func,
  className: PropTypes.string
};

export default observer(GrapesJSEditor);