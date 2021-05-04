import React, { memo, useMemo } from 'react';
import { useFormik } from 'formik';
import * as yup from 'yup';
import { Button } from '@material-ui/core';
import _ from 'lodash';

import PropTypes from '../../../lib/PropTypes';
import FormTextField from '../../form/FormTextField';

const validationSchema = yup.object({
  password: yup
    .string('Enter your password')
    .matches(
      '^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!_\\-@#\\$%\\^&\\*])(?=.{0,})',
      'Must Contain One Uppercase, One Lowercase, One Number and one special case Character',
    )
    .min(8, 'Password should be of minimum 8 characters length')
    .max(100, 'Password should be of maximum 100 characters length')
    .required('New password is required'),
  repeatPassword: yup
    .mixed().oneOf([yup.ref('password'), null], 'Passwords must match')
    .required('Repeating password is required'),
  currentPassword: yup
    .string('Enter your current password')
    .min(8, 'Password should be of minimum 8 characters length')
    .required('Current password is required'),
});


const AccountPasswordField = memo(({ updatePassword }) => {
  const formik = useFormik({
    initialValues: {
      password: '',
      repeatPassword: '',
      currentPassword: '',
    },
    validationSchema,
    onSubmit: (values) => {
      const { password, currentPassword } = values;
      updatePassword(password, currentPassword);
    },
  });

  const hasErrors = useMemo(() => _.size(formik.errors), [formik.errors]);

  return (
    <form onSubmit={formik.handleSubmit}>
      <div className="user-panel__data-field">
        <span className="user-panel__data-field-label">
          New password
          <p>*</p>
        </span>
        <FormTextField
          type="password"
          id="password"
          name="password"
          value={formik.values.password}
          onEdit={formik.handleChange}
          placeholder="********"
          inputClass="user-panel__data-field-input-password"
          error={formik.errors.password}
          helperText={formik.errors.password}
        />
        <div className="user-panel__data-field-dummy" />
      </div>
      <div className="user-panel__data-field">
        <span className="user-panel__data-field-label">
          Confirm new password
          <p>*</p>
        </span>
        <FormTextField
          id="repeatPassword"
          name="repeatPassword"
          placeholder="********"
          type="password"
          value={formik.values.repeatPassword}
          onEdit={formik.handleChange}
          inputClass="user-panel__data-field-input-password"
          error={Boolean(formik.errors.repeatPassword)}
          helperText={formik.errors.repeatPassword}
        />
        <div className="user-panel__data-field-dummy" />
      </div>
      <div className="user-panel__data-field">
        <span className="user-panel__data-field-label">
          Current password
          <p>*</p>
        </span>
        <FormTextField
          id="currentPassword"
          name="currentPassword"
          placeholder="********"
          type="password"
          value={formik.values.currentPassword}
          onEdit={formik.handleChange}
          inputClass="user-panel__data-field-input-password"
          error={Boolean(formik.errors.currentPassword)}
          helperText={formik.errors.currentPassword}
        />
        <div className="user-panel__data-field-dummy" />
      </div>
      <div className="user-panel__buttons-box">
        <div className="user-panel__data-field-label" />
        <div className="user-panel__data-field-button">
          <Button
            className="user-panel__buttons-box-button"
            type="submit"
            disabled={Boolean(hasErrors) || !formik.values.password}
          >
            Confirm
          </Button>
        </div>
        <div className="user-panel__data-field-link" />
      </div>
    </form>
  );
});

AccountPasswordField.propTypes = {
  updatePassword: PropTypes.func.isRequired,
};

export default AccountPasswordField;
