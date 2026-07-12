// Token Editor Component - Manage and customize token replacement system
import React, { useState, useEffect } from 'react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';

import PropTypes from '../lib/PropTypes';
import { showError, showSuccess } from '../lib/services/alertService';
import { TOKEN_EDITOR } from '../lib/constants/components';

import addIcon from '../public/static/svgImages/add.svg';
import deleteIcon from '../public/static/svgImages/delete.svg';
import editIcon from '../public/static/svgImages/edit.svg';

const TokenEditor = ({ onTokensChange, initialTokens = {} }) => {
  const [tokens, setTokens] = useState(initialTokens);
  const [isEditing, setIsEditing] = useState(false);
  const [editingToken, setEditingToken] = useState(null);
  const [newTokenKey, setNewTokenKey] = useState('');
  const [newTokenLabel, setNewTokenLabel] = useState('');
  const [newTokenValue, setNewTokenValue] = useState('');

  // Default system tokens that are always available
  const systemTokens = {
    '{{email}}': { label: 'Email', type: 'system', required: true },
    '{{firstName}}': { label: 'First Name', type: 'system', required: false },
    '{{lastName}}': { label: 'Last Name', type: 'system', required: false },
    '{{company}}': { label: 'Company', type: 'system', required: false },
    '{{website}}': { label: 'Website', type: 'system', required: false },
    '{{linkedin}}': { label: 'LinkedIn Profile', type: 'system', required: false },
    '{{phone}}': { label: 'Phone', type: 'system', required: false },
    '{{title}}': { label: 'Job Title', type: 'system', required: false },
    '{{industry}}': { label: 'Industry', type: 'system', required: false }
  };

  // Merge system tokens with custom tokens
  const allTokens = { ...systemTokens, ...tokens };

  useEffect(() => {
    if (onTokensChange) {
      onTokensChange(allTokens);
    }
  }, [tokens, onTokensChange]);

  const addCustomToken = () => {
    if (!newTokenKey.trim() || !newTokenLabel.trim()) {
      showError('Please enter both token key and label');
      return;
    }

    const tokenKey = `{{${newTokenKey.trim()}}}`;

    if (allTokens[tokenKey]) {
      showError('Token key already exists');
      return;
    }

    const updatedTokens = {
      ...tokens,
      [tokenKey]: {
        label: newTokenLabel.trim(),
        type: 'custom',
        required: false,
        defaultValue: newTokenValue.trim()
      }
    };

    setTokens(updatedTokens);
    setNewTokenKey('');
    setNewTokenLabel('');
    setNewTokenValue('');
    showSuccess('Custom token added successfully');
  };

  const updateToken = (tokenKey, updates) => {
    const updatedTokens = {
      ...tokens,
      [tokenKey]: {
        ...tokens[tokenKey],
        ...updates
      }
    };
    setTokens(updatedTokens);
  };

  const deleteCustomToken = (tokenKey) => {
    if (systemTokens[tokenKey]) {
      showError('Cannot delete system tokens');
      return;
    }

    const updatedTokens = { ...tokens };
    delete updatedTokens[tokenKey];
    setTokens(updatedTokens);
    showSuccess('Custom token deleted');
  };

  const startEditing = (tokenKey, token) => {
    setEditingToken(tokenKey);
    setNewTokenKey(tokenKey.replace(/\{\{/g, '').replace(/\}\}/g, ''));
    setNewTokenLabel(token.label);
    setNewTokenValue(token.defaultValue || '');
    setIsEditing(true);
  };

  const saveEdit = () => {
    if (!newTokenKey.trim() || !newTokenLabel.trim()) {
      showError('Please enter both token key and label');
      return;
    }

    const newTokenKeyFormatted = `{{${newTokenKey.trim()}}}`;

    // If key changed, remove old and add new
    if (newTokenKeyFormatted !== editingToken) {
      if (allTokens[newTokenKeyFormatted]) {
        showError('Token key already exists');
        return;
      }

      const updatedTokens = { ...tokens };
      delete updatedTokens[editingToken];
      updatedTokens[newTokenKeyFormatted] = {
        ...tokens[editingToken],
        label: newTokenLabel.trim(),
        defaultValue: newTokenValue.trim()
      };
      setTokens(updatedTokens);
    } else {
      updateToken(editingToken, {
        label: newTokenLabel.trim(),
        defaultValue: newTokenValue.trim()
      });
    }

    cancelEdit();
    showSuccess('Token updated successfully');
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditingToken(null);
    setNewTokenKey('');
    setNewTokenLabel('');
    setNewTokenValue('');
  };

  const renderTokenRow = (tokenKey, token) => (
    <div key={tokenKey} className="token-row">
      <div className="token-info">
        <code className="token-key">{tokenKey}</code>
        <span className="token-label">{token.label}</span>
        {token.type === 'system' && (
          <span className="token-type system">System</span>
        )}
        {token.type === 'custom' && (
          <span className="token-type custom">Custom</span>
        )}
        {token.required && (
          <span className="token-required">Required</span>
        )}
        {token.defaultValue && (
          <span className="token-default">
            Default: {token.defaultValue}
          </span>
        )}
      </div>

      <div className="token-actions">
        {token.type === 'custom' && (
          <>
            <button
              className="action-btn edit-btn"
              onClick={() => startEditing(tokenKey, token)}
              title="Edit token"
            >
              <SVGInline svg={editIcon} />
            </button>
            <button
              className="action-btn delete-btn"
              onClick={() => deleteCustomToken(tokenKey)}
              title="Delete token"
            >
              <SVGInline svg={deleteIcon} />
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="token-editor">
      <div className="editor-header">
        <h2 className="editor-title">Token Management</h2>
        <p className="editor-subtitle">
          Manage tokens used for personalizing your videos
        </p>
      </div>

      <div className="tokens-section">
        <h3 className="section-title">Available Tokens</h3>
        <div className="tokens-list">
          {Object.entries(allTokens).map(([key, token]) =>
            renderTokenRow(key, token)
          )}
        </div>
      </div>

      <div className="add-token-section">
        <h3 className="section-title">
          <SVGInline svg={addIcon} className="add-icon" />
          Add Custom Token
        </h3>

        {isEditing ? (
          <div className="edit-token-form">
            <div className="form-row">
              <label>Token Key:</label>
              <input
                type="text"
                value={newTokenKey}
                onChange={(e) => setNewTokenKey(e.target.value)}
                placeholder="Enter token key (without {{}})"
              />
            </div>
            <div className="form-row">
              <label>Label:</label>
              <input
                type="text"
                value={newTokenLabel}
                onChange={(e) => setNewTokenLabel(e.target.value)}
                placeholder="Display label for the token"
              />
            </div>
            <div className="form-row">
              <label>Default Value:</label>
              <input
                type="text"
                value={newTokenValue}
                onChange={(e) => setNewTokenValue(e.target.value)}
                placeholder="Optional default value"
              />
            </div>
            <div className="form-actions">
              <button onClick={saveEdit} className="save-btn">Save</button>
              <button onClick={cancelEdit} className="cancel-btn">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="add-token-form">
            <div className="form-row">
              <label>Token Key:</label>
              <input
                type="text"
                value={newTokenKey}
                onChange={(e) => setNewTokenKey(e.target.value)}
                placeholder="Enter token key (without {{}})"
              />
            </div>
            <div className="form-row">
              <label>Label:</label>
              <input
                type="text"
                value={newTokenLabel}
                onChange={(e) => setNewTokenLabel(e.target.value)}
                placeholder="Display label for the token"
              />
            </div>
            <div className="form-row">
              <label>Default Value:</label>
              <input
                type="text"
                value={newTokenValue}
                onChange={(e) => setNewTokenValue(e.target.value)}
                placeholder="Optional default value"
              />
            </div>
            <button onClick={addCustomToken} className="add-btn">
              Add Custom Token
            </button>
          </div>
        )}
      </div>

      <div className="usage-info">
        <h4 className="info-title">How to Use Tokens</h4>
        <div className="info-content">
          <p>Use these tokens in your video scripts or overlays:</p>
          <ul>
            <li>System tokens are automatically populated from contact data</li>
            <li>Custom tokens can be set per contact or use default values</li>
            <li>Tokens will be replaced with actual contact information during video generation</li>
          </ul>
          <div className="example">
            <strong>Example:</strong><br />
            "Hello {{firstName}}, welcome to {{company}}!"
          </div>
        </div>
      </div>
    </div>
  );
};

TokenEditor.propTypes = {
  onTokensChange: PropTypes.func,
  initialTokens: PropTypes.object
};

export default TokenEditor;