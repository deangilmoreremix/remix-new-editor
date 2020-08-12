import React, { useState, Fragment, useCallback } from 'react';
import { Progress } from 'reactstrap';

import PropTypes from '../../../lib/PropTypes';
import { FACEBOOK_STAGES as STAGES } from '../../../lib/constants/campaigns/stages';
import { SERVICE_PROVIDER } from '../../../lib/constants/campaigns/constants';

const CampaignStage = ({
  index,
  stage,
  handleBackButtonClick,
  handleNextButtonClick,
  canBypassStage,
  isLoading,
  handleClose,
  ...props
}) => {
  const {
    key,
    completionPercentage,
    element: Stage,
    actionButtonClassName,
    actionButtonIconClassName,
    actionButtonCaption,
  } = stage;

  const [link, setLink] = useState();

  const closeAndSave = useCallback(() => {
    link.select();
    document.execCommand('copy');
    handleClose();
  }, [link, handleClose]);

  return (
    <Fragment>
      {
        isLoading ? <div className="spinner">Loading...</div> : <Stage {...props} setLink={setLink} />
      }
      <Progress
        className="embed-progress mb-3"
        value={completionPercentage}
      />
      <div className="controls">
        <button
          disabled={isLoading || index === 0}
          className={`go-button back ${key === STAGES[0].key ? 'hidden' : ''}`}
          onClick={handleBackButtonClick}
          type="button"
        >
        Back
        </button>
        <button
          className={
        `go-button ${`next ${actionButtonClassName || ''}`}`
      }
          disabled={isLoading || !canBypassStage(stage)}
          onClick={completionPercentage === 100 ? closeAndSave : handleNextButtonClick}
          type="button"
        >
          <i className={actionButtonIconClassName || 'hidden'} />
          {
            actionButtonCaption
            || (completionPercentage === 100 && key === SERVICE_PROVIDER && 'Save and Close')
            || (completionPercentage === 100 && 'Close')
            || 'Next'
          }
        </button>
      </div>
    </Fragment>
  );
};

CampaignStage.propTypes = {
  index: PropTypes.number.isRequired,
  stage: PropTypes.shape({
    key: PropTypes.string.isRequired,
    completionPercentage: PropTypes.number.isRequired,
    element: PropTypes.func.isRequired,
    actionButtonClassName: PropTypes.string,
    actionButtonIconClassName: PropTypes.string,
    actionButtonCaption: PropTypes.string,
    bootstrap: PropTypes.func,
  }),
  handleBackButtonClick: PropTypes.func.isRequired,
  handleNextButtonClick: PropTypes.func.isRequired,
  canBypassStage: PropTypes.func.isRequired,
  handleClose: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
};

export default CampaignStage;
