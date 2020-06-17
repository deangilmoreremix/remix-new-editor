import React from 'react';

import PropTypes from '../../../../lib/PropTypes';

import FieldBuilder from '../../../form/FieldBuilder';

const IntegrationsTab = ({ values, fields, onChange }) => (
  <div>
    <FieldBuilder
      value={values.webhookEnabled ?? fields.webhookEnabled.default}
      onChange={onChange}
      {...fields.webhookEnabled}
    />
    <FieldBuilder
      value={values.webhook ?? fields.webhook.default}
      disabled={!values.webhookEnabled}
      onChange={onChange}
      {...fields.webhook}
      className="input-field-conatainer"
    />
    <FieldBuilder
      value={values.dialEnabled ?? fields.dialEnabled.default}
      onChange={onChange}
      {...fields.dialEnabled}
    />
    <FieldBuilder
      value={values.phone ?? fields.phone.default}
      onChange={onChange}
      disabled={!values.dialEnabled}
      {...fields.phone}
      className="input-field-conatainer"
    />
    <FieldBuilder
      value={values.callNotifyAddress ?? fields.callNotifyAddress.default}
      onChange={onChange}
      disabled={!values.dialEnabled}
      {...fields.callNotifyAddress}
      className="input-field-conatainer"
    />
    <FieldBuilder
      value={values.emailEnabled ?? fields.emailEnabled.default}
      onChange={onChange}
      {...fields.emailEnabled}
    />
    <FieldBuilder
      value={values.emailAddress ?? fields.emailAddress.default}
      disabled={!values.emailEnabled}
      onChange={onChange}
      {...fields.emailAddress}
    />
  </div>
);

IntegrationsTab.propTypes = {
  values: PropTypes.shape({
    webhookEnabled: PropTypes.bool,
    webhook: PropTypes.string,
    dialEnabled: PropTypes.bool,
    phone: PropTypes.string,
    callNotifyAddress: PropTypes.string,
    emailEnabled: PropTypes.bool,
    emailAddress: PropTypes.bool,
  }),
  onChange: PropTypes.func.isRequired,
  fields: PropTypes.shape({
    webhookEnabled: PropTypes.shape({
      default: PropTypes.bool,
    }),
    webhook: PropTypes.shape({
      default: PropTypes.string,
    }),
    dialEnabled: PropTypes.shape({
      default: PropTypes.bool,
    }),
    phone: PropTypes.shape({
      default: PropTypes.string,
    }),
    callNotifyAddress: PropTypes.shape({
      default: PropTypes.string,
    }),
    emailEnabled: PropTypes.shape({
      default: PropTypes.bool,
    }),
    emailAddress: PropTypes.shape({
      default: PropTypes.string,
    }),
  }),
};

export default IntegrationsTab;
