import * as React from 'react';
import { Progress } from 'reactstrap';

import PropTypes from '../../../lib/PropTypes';
import { FACEBOOK_STAGES as STAGES } from '../../../lib/constants/campaigns/stages';

const CampaignStage = ({
  index,
  stage,
  handleBackButtonClick,
  handleNextButtonClick,
  canBypassStage,
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

  return (
    <React.Fragment>
      <Stage {...props} />
      <Progress
        className="embed-progress"
        value={completionPercentage}
      />
      <div className="controls">
        <button
          disabled={index === 0}
          className={`go-button back ${key === STAGES[0].key ? 'hidden' : ''}`}
          onClick={handleBackButtonClick}
          type="button"
        >
          Back
        </button>
        <button
          className={
            `go-button ${`next ${actionButtonClassName || ''}`} ${
              canBypassStage(stage) ? '' : 'inactive'}`
          }
          onClick={handleNextButtonClick}
          type="button"
        >
          <i className={actionButtonIconClassName || 'hidden'} />
          {actionButtonCaption || 'Next'}
        </button>
      </div>
    </React.Fragment>
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
};

export default CampaignStage;
