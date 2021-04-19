import React, { memo, useMemo } from 'react';
import PropTypes from '../../../lib/PropTypes';

const AccountField = memo(({ item, value, variableField, onChange, maxSymbols }) => {
  const extraProps = useMemo(() => (
    item.onClick && { onClick: () => item.onClick() }
  ), [item.onClick]);

  return (
    <div key={`field-${item.label}`} className="user-panel__data-field">
      <span className="user-panel__data-field-label">
        {item.label}
      </span>
      <>
        <input
          type="text"
          value={value !== undefined ? value : item?.input}
          onChange={onChange}
          readOnly={!variableField}
          className="user-panel__data-field-input"
          max={maxSymbols || null}
        />
        {item.link && (
          <button
            className="user-panel__data-field-link"
            {...extraProps}
          >
            {item.link}
          </button>
        )}
      </>
    </div>
  );
});

AccountField.propTypes = {
  item: PropTypes.shape({
    label: PropTypes.string.isRequired,
    input: PropTypes.string,
    link: PropTypes.string,
    onClick: PropTypes.func,
  }).isRequired,
  variableField: PropTypes.bool,
  onChange: PropTypes.func,
  value: PropTypes.string,
  maxSymbols: PropTypes.number,
};

AccountField.defaultProps = {
  variableField: false,
};

export default AccountField;
