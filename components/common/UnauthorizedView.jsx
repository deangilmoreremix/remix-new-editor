import React from 'react';
import SVGInline from 'react-svg-inline';
import { Button } from '@material-ui/core';

import UnauthorizedViewIcon from '../../public/static/svgImages/unathorized-view.svg';

import { PAYMENT_URL } from '../../lib/constants/features';

const goToPayment = () => window.open(PAYMENT_URL);

const UnauthorizedView = () => (
  <div className="unathorized-view__screen">
    <SVGInline
      svg={UnauthorizedViewIcon}
      className="unathorized-view__icon"
      cleanup={['title']}
    />
    <p className="text-main">
      Unable to access content
    </p>
    <p className="text-message">
      You don&#39;t have enough rights to use this editor.
    </p>
    <Button
      disableRipple
      onClick={goToPayment}
      className="go-to-payment_button"
      color="primary"
    >
      Go to payment
    </Button>
  </div>
);

export default UnauthorizedView;
