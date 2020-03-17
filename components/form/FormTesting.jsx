import React from 'react';
import { Form, Formik } from 'formik';
import FieldBuilder from './FieldBuilder';

const FormTesting = () => {
  const initialValues = {
    name: '',
    email: '',
    phone: '',
    city: '',
  };

  const formikSettings = {
    initialValues,
    validateOnMount: true,
    onSubmit: (values) => console.log(values),
  };

  const onChange = (e) => {
      console.log(e);
  }

  return (
    <Formik {...formikSettings}>
      { formikProps => (
        <Form>
          <FieldBuilder
            name="name"
            onChange={onChange}
            placeholder={"Your name"}
            type="text"
          />
        </Form>
      )}
    </Formik>
  );
};

export default FormTesting;
