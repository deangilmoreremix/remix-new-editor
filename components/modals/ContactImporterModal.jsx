// Contact Importer Modal - Upload and map CSV contacts for personalized video generation
import React, { useState, useRef } from 'react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../lib/PropTypes';
import { showError, showSuccess } from '../../lib/services/alertService';
import { CONTACT_IMPORTER_MODAL } from '../../lib/constants/modals';

import uploadIcon from '../../public/static/svgImages/upload.svg';
import csvIcon from '../../public/static/svgImages/csv.svg';

const ContactImporterModal = ({ handleClose, onContactsImported }) => {
  const [step, setStep] = useState(1); // 1: Upload, 2: Map, 3: Preview, 4: Import
  const [file, setFile] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewContacts, setPreviewContacts] = useState([]);
  const fileInputRef = useRef(null);

  // Available token fields
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
  ];

  const parseCSV = (csvText) => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) return { headers: [], rows: [] };

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const contact = {};
      headers.forEach((header, index) => {
        contact[header] = values[index] || '';
      });
      return contact;
    });

    return { headers, rows };
  };

  const handleFileUpload = async (event) => {
    const uploadedFile = event.target.files[0];
    if (!uploadedFile) return;

    if (!uploadedFile.name.toLowerCase().endsWith('.csv')) {
      showError('Please upload a CSV file');
      return;
    }

    setFile(uploadedFile);
    setIsProcessing(true);

    try {
      const text = await uploadedFile.text();
      const { headers, rows } = parseCSV(text);

      if (headers.length === 0) {
        showError('Invalid CSV format');
        return;
      }

      // Auto-detect column mappings
      const autoMapping = {};
      headers.forEach(header => {
        const lowerHeader = header.toLowerCase();
        if (lowerHeader.includes('email')) autoMapping.email = header;
        else if (lowerHeader.includes('first name') || lowerHeader === 'firstname') autoMapping.firstName = header;
        else if (lowerHeader.includes('last name') || lowerHeader === 'lastname') autoMapping.lastName = header;
        else if (lowerHeader.includes('company')) autoMapping.company = header;
        else if (lowerHeader.includes('website') || lowerHeader.includes('site')) autoMapping.website = header;
        else if (lowerHeader.includes('linkedin')) autoMapping.linkedin = header;
        else if (lowerHeader.includes('phone')) autoMapping.phone = header;
        else if (lowerHeader.includes('title') || lowerHeader.includes('job')) autoMapping.title = header;
      });

      setColumnMapping(autoMapping);
      setContacts(rows);
      setPreviewContacts(rows.slice(0, 5)); // Show first 5 rows
      setStep(2);

    } catch (error) {
      showError('Failed to parse CSV file');
      console.error('CSV parsing error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const validateContacts = (contactList) => {
    const validated = [];
    const errors = [];

    contactList.forEach((contact, index) => {
      const validatedContact = {};
      let hasEmail = false;

      // Map CSV columns to token fields
      Object.entries(columnMapping).forEach(([tokenField, csvColumn]) => {
        if (contact[csvColumn]) {
          validatedContact[tokenField] = contact[csvColumn];

          if (tokenField === 'email') {
            hasEmail = true;
            // Basic email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(contact[csvColumn])) {
              errors.push(`Row ${index + 2}: Invalid email format`);
            }
          }
        }
      });

      if (hasEmail) {
        validated.push(validatedContact);
      } else {
        errors.push(`Row ${index + 2}: Missing email address`);
      }
    });

    if (errors.length > 0) {
      showError(`Found ${errors.length} validation errors:\n${errors.slice(0, 5).join('\n')}`);
      return validated.slice(0, validated.length - errors.length);
    }

    return validated;
  };

  const handleImport = () => {
    const validatedContacts = validateContacts(contacts);

    if (validatedContacts.length === 0) {
      showError('No valid contacts found');
      return;
    }

    // Remove duplicates based on email
    const uniqueContacts = validatedContacts.filter((contact, index, self) =>
      index === self.findIndex(c => c.email === contact.email)
    );

    const duplicates = validatedContacts.length - uniqueContacts.length;

    if (duplicates > 0) {
      showSuccess(`Imported ${uniqueContacts.length} contacts (${duplicates} duplicates removed)`);
    } else {
      showSuccess(`Successfully imported ${uniqueContacts.length} contacts`);
    }

    if (onContactsImported) {
      onContactsImported(uniqueContacts);
    }

    handleClose();
  };

  const updateMapping = (tokenField, csvColumn) => {
    setColumnMapping(prev => ({
      ...prev,
      [tokenField]: csvColumn
    }));
  };

  const renderStep1 = () => (
    <div className="contact-importer-step">
      <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
        <SVGInline svg={uploadIcon} className="upload-icon" />
        <h3 className="upload-title">Upload Contacts CSV</h3>
        <p className="upload-subtitle">
          Drag and drop your CSV file here, or click to browse
        </p>
        <div className="upload-requirements">
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
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="contact-importer-step">
      <h3 className="step-title">Map CSV Columns to Contact Fields</h3>
      <div className="mapping-grid">
        {tokenFields.map(field => (
          <div key={field.key} className="mapping-row">
            <label className="field-label">
              {field.label}
              {field.required && <span className="required">*</span>}
            </label>
            <select
              value={columnMapping[field.key] || ''}
              onChange={(e) => updateMapping(field.key, e.target.value)}
              className="csv-column-select"
            >
              <option value="">-- Select Column --</option>
              {Object.keys(contacts[0] || {}).map(column => (
                <option key={column} value={column}>{column}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="step-actions">
        <button onClick={() => setStep(1)} className="back-btn">Back</button>
        <button onClick={() => setStep(3)} className="next-btn">Preview</button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="contact-importer-step">
      <h3 className="step-title">Preview Contacts ({contacts.length} total)</h3>
      <div className="preview-table">
        <div className="preview-header">
          {Object.keys(columnMapping).map(field => (
            <div key={field} className="preview-cell header">
              {tokenFields.find(f => f.key === field)?.label || field}
            </div>
          ))}
        </div>
        {previewContacts.map((contact, index) => (
          <div key={index} className="preview-row">
            {Object.keys(columnMapping).map(field => (
              <div key={field} className="preview-cell">
                {contact[columnMapping[field]] || '-'}
              </div>
            ))}
          </div>
        ))}
        {contacts.length > 5 && (
          <div className="preview-more">
            ... and {contacts.length - 5} more contacts
          </div>
        )}
      </div>
      <div className="step-actions">
        <button onClick={() => setStep(2)} className="back-btn">Back</button>
        <button onClick={handleImport} className="import-btn">
          Import {contacts.length} Contacts
        </button>
      </div>
    </div>
  );

  return (
    <div className="contact-importer-modal">
      <div className="modal-header">
        <div className="modal-title-section">
          <SVGInline svg={csvIcon} className="modal-icon" />
          <div>
            <h2 className="modal-title">Import Contacts</h2>
            <p className="modal-subtitle">Upload CSV file to create personalized videos</p>
          </div>
        </div>
        <button onClick={handleClose} className="close-btn">×</button>
      </div>

      <div className="modal-content">
        {isProcessing && (
          <div className="processing-overlay">
            <div className="spinner"></div>
            <p>Processing CSV file...</p>
          </div>
        )}

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </div>
    </div>
  );
};

ContactImporterModal.propTypes = {
  handleClose: PropTypes.func.isRequired,
  onContactsImported: PropTypes.func,
};

export default ContactImporterModal;