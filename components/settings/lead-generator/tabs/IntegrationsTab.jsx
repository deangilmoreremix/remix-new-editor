import React from 'react';
import classnames from 'classnames';

import PropTypes from '../../../../lib/PropTypes';

import FieldBuilder from '../../../form/FieldBuilder';
import useProjectStore from '../../../hooks/useProjectStore';

import { BUTTON_DISABLED_HINT as buttonText } from '../../../../lib/constants/text-info';

const IntegrationsTab = ({ values, fields, onChange }) => {
  const { item: { project }, downloadOptinStatistic } = useProjectStore();

  const toDownloadOptin = async (projectId) => {
    const getForCSV = await downloadOptinStatistic(projectId);
    const link = document.createElement('a');
    const blob = new Blob([getForCSV], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', 'optin.csv');
    link.click();
  };

  return (
    <div className="intergrations-container">
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
      <div className="download-optin-container">
        <button
          className={classnames('btn-custom', { 'button-disabled': !project._id })}
          onClick={() => toDownloadOptin(project._id)}
          disabled={!project._id}
          title={!project._id ? buttonText.title : ''}
        >
          Download all opt-ins
        </button>
      </div>
    </div>
  );
};

IntegrationsTab.propTypes = {
  values: PropTypes.shape({
    webhookEnabled: PropTypes.bool,
    webhook: PropTypes.string,
    dialEnabled: PropTypes.bool,
    phone: PropTypes.string,
    callNotifyAddress: PropTypes.string,
    emailEnabled: PropTypes.bool,
    emailAddress: PropTypes.string,
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
