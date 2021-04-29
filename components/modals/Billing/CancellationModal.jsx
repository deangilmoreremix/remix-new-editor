import React, { useState, useMemo } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import PropTypes from '../../../lib/PropTypes';
import FormSelect from '../../form/FormSelect';

import useUserStore from '../../hooks/useUserStore';

import { showError, showSuccess } from '../../../lib/services/alertService';
import { CANCELLATION_REASONS } from '../../../lib/constants/text-info';
import { LibrarySpinner } from '../../media/Loader';

const CancellationModal = observer(({ handleClose, options }) => {
  const { id, requestHasBeenSend } = options;

  const { cancelPlan } = useUserStore();

  const [reason, setReason] = useState(CANCELLATION_REASONS[0].value);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const disabledButton = useMemo(() => {
    if (reason === CANCELLATION_REASONS[CANCELLATION_REASONS.length - 1].value) {
      return !description;
    }
    return reason === CANCELLATION_REASONS[0].value;
  }, [reason, description]);

  const onSendCancelRequest = async () => {
    try {
      setLoading(true);
      await cancelPlan({
        reason,
        description,
        payment: id,
      });
      showSuccess('Request sent successfully!');
      setLoading(false);
      requestHasBeenSend();
      handleClose();
    } catch (e) {
      showError(e.message);
      setLoading(false);
    }
  };

  return (
    <div className="cancellation-modal-content">
      <h4>Submit a Cancellation Request</h4>
      <div className="cancellation-modal-content__description">
        <span>When your account is cancelled, the following will happen...</span>
        <ul>
          <li>
            Access to all templates, courses, and feature
            attached with this product will be removed.
          </li>
        </ul>
        <span>
          Please note that your account is not officially
          cancelled until you receive a cancellation email from us.
        </span>
      </div>
      <div className="cancellation-modal-content__reasons">
        <FormSelect
          label="Please select a reason for cancelling..."
          className="cancellation-modal-content__reasons-select"
          labelClassName="cancellation-modal-content__reasons-label"
          value={reason}
          onChange={(value) => setReason(value)}
          items={CANCELLATION_REASONS}
        />
        <div className="cancellation-modal-content__reasons-text">
          <span>Please provide some additional feedback regard your decision...</span>
          <textarea onChange={({ target }) => setDescription(target.value)} />
        </div>
        <div className="cancellation-modal-content__buttons">
          <button onClick={() => handleClose()}>Nevermind, I don’t want to cancel</button>
          <button
            disabled={disabledButton || loading}
            onClick={onSendCancelRequest}
            className={classnames({ 'cancellation-modal-content__buttons-loading': loading })}
          >
            {loading ? <LibrarySpinner /> : 'Submit Cancellation Request'}
          </button>
        </div>
      </div>
    </div>
  );
});

CancellationModal.propTypes = {
  options: PropTypes.shape({
    id: PropTypes.string.isRequired,
    requestHasBeenSend: PropTypes.func.isRequired,
  }).isRequired,
  handleClose: PropTypes.func.isRequired,
};

export default CancellationModal;
