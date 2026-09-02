import React, { useMemo } from 'react';
import classnames from 'classnames';
import { observer } from 'mobx-react';

import SVGInline from 'react-svg-inline';
import PropTypes from '../../../../lib/PropTypes';

import FieldBuilder from '../../../form/FieldBuilder';
import useMakeStore from '../../../hooks/useMakeStore';
import useProjectStore from '../../../hooks/useProjectStore';
import useUserStore from '../../../hooks/useUserStore';

import { BUTTON_DISABLED_HINT as buttonText } from '../../../../lib/constants/text-info';
import { settingsTooltips } from '../../../../lib/constants/tooltips';
import trashIcon from '../../../../public/static/svgImages/common/trash.svg';
import { TYPES } from '../../../../lib/constants/validator';
import withValidation from '../../../hoc/withValidation';
import { POPCORN_ELEMENT_TYPES } from '../../../../lib/constants/popcorn';
import router from 'next/router';

const IntegrationsTab = observer(({ values, fields, onChange, checkValue, type }) => {
  const { item: { project } } = useProjectStore();
  const { fbLbPixelEnabled, fbLgPixelEnabled } = useUserStore();

  const { downloadOptinStatistic } = useMakeStore();

  const hasMaxWebhooks = React.useMemo(() => !values.webhookEnabled || (values.webhook3
    && values.webhook2 && !values.webhook2.hidden && !values.webhook3.hidden), [
    values?.webhook2,
    values?.webhook2?.hidden,
    values?.webhook3,
    values?.webhook3?.hidden,
    values.webhookEnabled,
  ]);

  const onChangeWebhook = (e) => {
    const fieldName = Object.keys(e)[0];
    const value = e[fieldName];
    const error = checkValue(value, { type: TYPES.WEBHOOK });
    if (!error) {
      onChange({ [fieldName]: value });
    }
  };

  const idPixelAvailable = useMemo(() => (
    (fbLbPixelEnabled && type === POPCORN_ELEMENT_TYPES.RETARGET)
    || (fbLgPixelEnabled && type === POPCORN_ELEMENT_TYPES.LEAD_GENERATOR)),
    [fbLbPixelEnabled, fbLgPixelEnabled]);

  return (
    <div className="integrations-container">
      {idPixelAvailable && (
        <FieldBuilder
          className="input-fb-pixel"
          value={values.fbPixelId ?? fields.fbPixelId.default}
          onChange={onChange}
          {...fields.fbPixelId}
        />
      )}
      <FieldBuilder
        isTooltip
        tooltipMessage={settingsTooltips.webhookAddress}
        tooltipHeight={35}
        tooltipPlacement="right"
        value={values.webhookEnabled ?? fields.webhookEnabled.default}
        onChange={onChange}
        {...fields.webhookEnabled}
      />
      <FieldBuilder
        value={values.webhook ?? fields.webhook.default}
        disabled={!values.webhookEnabled}
        onChange={onChange}
        {...fields.webhook}
      />
      {type === POPCORN_ELEMENT_TYPES.RETARGET && !values.webhook2.hidden
        && (
          <div className="webhook-container">
            <FieldBuilder
              disabled={!values.webhookEnabled}
              onChange={onChangeWebhook}
              {...fields.webhook2}
              inputClassName="item-retarget-container-input"
              value={values.webhook2.value}
            />
            <div className="item-delete">
              <SVGInline
                className="icon trash"
                classSuffix=""
                svg={trashIcon}
                cleanup={['title']}
                alt="Remove item"
                data-tip="Remove item"
                onClick={() => onChange({ removeWebhook: 2 })}
              />
            </div>
          </div>
        )}
      {type === POPCORN_ELEMENT_TYPES.RETARGET && !values.webhook3.hidden
        && (
          <div className="webhook-container">
            <FieldBuilder
              disabled={!values.webhookEnabled}
              onChange={onChangeWebhook}
              {...fields.webhook3}
              inputClassName="item-retarget-container-input"
              value={values.webhook3.value}
            />
            <div className="item-delete">
              <SVGInline
                className="icon trash"
                classSuffix=""
                svg={trashIcon}
                cleanup={['title']}
                alt="Remove item"
                data-tip="Remove item"
                onClick={() => onChange({ removeWebhook: 3 })}
              />
            </div>
          </div>
        )}
      {type === POPCORN_ELEMENT_TYPES.RETARGET
        && (
          <div className="add-field-container">
            <button
              className={classnames('btn-custom', { 'button-disabled': hasMaxWebhooks })}
              onClick={() => { onChange({ addWebhook: true }); }}
              disabled={hasMaxWebhooks}
            >
              +Add Webhook Address
            </button>
          </div>
        )}
      {/* <FieldBuilder */}
      {/*  value={values.dialEnabled ?? fields.dialEnabled.default} */}
      {/*  onChange={onChange} */}
      {/*  {...fields.dialEnabled} */}
      {/* /> */}
      {/* <FieldBuilder */}
      {/*  labelHint={HINTS.PHONE_FORM} */}
      {/*  value={values.phone ?? fields.phone.default} */}
      {/*  onChange={onChange} */}
      {/*  disabled={!values.dialEnabled} */}
      {/*  {...fields.phone} */}
      {/*  className="input-field-container" */}
      {/* /> */}
      {/* <FieldBuilder */}
      {/*  value={values.callNotifyAddress ?? fields.callNotifyAddress.default} */}
      {/*  onChange={onChange} */}
      {/*  disabled={!values.dialEnabled} */}
      {/*  {...fields.callNotifyAddress} */}
      {/*  className="input-field-container" */}
      {/* /> */}
      <FieldBuilder
        isTooltip
        tooltipMessage={settingsTooltips.emailNotification}
        tooltipHeight={35}
        tooltipPlacement="right"
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
          onClick={() => downloadOptinStatistic(project._id)}
          disabled={!project._id}
          title={!project._id ? buttonText.title : ''}
        >
          Download leads
        </button>
      </div>
      <a href='https://zapier.com/apps/videoremix/integrations' target='_blank' style={{ textDecoration:'none'}}>
        <button
          className={classnames('btn-custom zap-btn', { 'button-disabled': !project._id })}
          // onClick={() => router.push('https://zapier.com/apps/videoremix/integrations')}
          disabled={!project._id}
          title={!project._id ? buttonText.title : ''}
        >

          Zapier Integration

        </button>
      </a>
    </div>
  );
});

IntegrationsTab.propTypes = {
  values: PropTypes.shape({
    webhookEnabled: PropTypes.bool,
    webhook: PropTypes.string,
    webhook2: PropTypes.shape({
      value: PropTypes.string,
      hidden: PropTypes.bool,
    }),
    webhook3: PropTypes.shape({
      value: PropTypes.string,
      hidden: PropTypes.bool,
    }),
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
    webhook2: PropTypes.shape({
      default: PropTypes.shape({
        value: PropTypes.string,
        hidden: PropTypes.bool,
      }),
      hidden: PropTypes.bool,
    }),
    webhook3: PropTypes.shape({
      default: PropTypes.shape({
        value: PropTypes.string,
        hidden: PropTypes.bool,
      }),
      hidden: PropTypes.bool,
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
    fbPixelId: PropTypes.shape({
      default: PropTypes.number,
    }),
  }),
};

export default withValidation(IntegrationsTab);
