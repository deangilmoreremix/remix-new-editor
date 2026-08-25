import React, { useState, Fragment, useCallback } from 'react';
import { Progress } from 'reactstrap';

import PropTypes from '../../../lib/PropTypes';
import { FACEBOOK_STAGES as STAGES } from '../../../lib/constants/campaigns/stages';
import { SERVICE_PROVIDER } from '../../../lib/constants/campaigns/constants';
import { FacebookShareButton } from 'react-share';
import { SOCIAL_CAMPAIGN_MODAL } from '../../../lib/constants/modals';
import useProjectStore from '../../hooks/useProjectStore';

const CampaignStage = ({
  index,
  stage,
  closeModal,
  showInfo,
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

  const closeHandler = async ( ) => {
    // setStage(SERVICE_PROVIDER)
    await closeModal(SOCIAL_CAMPAIGN_MODAL)
    await showInfo('Success');
  }
  const { item : project } = useProjectStore()
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
        
        {(key == 'facebook-login' && completionPercentage == 75) ?
        <button  className={
          `go-button`
        }>
          <FacebookShareButton 
             url={project.url}
             quote={project.title}
             onShareWindowClose={closeHandler}
          >
          <i className={actionButtonIconClassName || 'hidden'} />
              {
                actionButtonCaption

              }
          </FacebookShareButton>
        </button> :
          // <FacebookShareButton
            // url={'item?.url'}
            // quote={'title'}
            // onShareWindowClose={'handleClose'}
          // >

          //   <button
          //     className={
          //       `go-button}`
          //     }

          //     onClick={completionPercentage === 100 ? closeAndSave : handleNextButtonClick}
          //     type="button"
          //   >
              // <i className={actionButtonIconClassName || 'hidden'} />
              // {
              //   actionButtonCaption

              // }
          //   </button>
          // </FacebookShareButton> :
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

        }

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
