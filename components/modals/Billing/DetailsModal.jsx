import React, { memo } from 'react';
import moment from 'moment';
import PropTypes from '../../../lib/PropTypes';

const DetailsModal = memo(({ options }) => {
  const { details } = options;
  const {
    amount,
    createdAt,
    customerEmail,
    customerName,
    productName,
  } = details;

  const fields = [
    { label: 'Amount', data: `${amount}$` },
    { label: 'Transaction Date', data: moment(createdAt).format('MMMM Do YYYY, h:mm:ss a') },
    { label: 'Customer PayPal Email', data: customerEmail },
    { label: 'Product Name', data: productName },
    { label: 'Customer Name', data: customerName },
    { label: 'Customer Email', data: customerEmail },
  ];

  return (
    <div className="details-modal-content">
      <h4>Transaction Details</h4>
      <div className="details-modal-content__data">
        {fields.map((field) => (
          <div key={field.label} className="details-modal-content__data-field">
            <span>{field.label}</span>
            <p>{field.data}</p>
          </div>
        ))}
      </div>
    </div>
  );
});

DetailsModal.propTypes = {
  options: PropTypes.shape({
    details: PropTypes.shape({
      amount: PropTypes.number.isRequired,
      createdAt: PropTypes.string.isRequired,
      customerEmail: PropTypes.string.isRequired,
      customerName: PropTypes.string.isRequired,
      productName: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
};

export default DetailsModal;
