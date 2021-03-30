import React from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import Stepper from '@material-ui/core/Stepper';
import Step from '@material-ui/core/Step';
import StepLabel from '@material-ui/core/StepLabel';

const HorizontalStepper = (props) => {
  const {
    classNameContainer,
    steps,
    activeStep,
  } = props;

  return (
    <div className={classnames('stepper-container', classNameContainer)}>
      <Stepper activeStep={activeStep} alternativeLabel>
        {steps.map((item, index) => (
          <Step key={item.label}>
            <StepLabel
              className={classnames('stepper-button',
                { active: activeStep === index },
                { passed: item.passed })}
            >
              {item.label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>
    </div>
  );
};

HorizontalStepper.propTypes = {
  classNameContainer: PropTypes.string,
  steps: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    passed: PropTypes.bool,
  })).isRequired,
  activeStep: PropTypes.number.isRequired,
};

export default HorizontalStepper;
