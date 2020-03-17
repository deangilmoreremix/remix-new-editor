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
  };

  const fields = [
    {
      type: 'text',
      name: 'name',
      onChange,
      placeholder: 'Your name',
    },
    {
      type: 'radio',
      name: "Radio btns",
      groupName: 'Radio btn for test',
      onChange,
      items: [
        { label: 'first btn', position: 'start' },
        { label: 'second btn', position: 'start' },
      ],
    },
    {
      type: 'color',
      name: 'color',
      onChange,
      placeholder: 'Select item',
    },
    // {
    //   type: 'select',
    //   name: 'cars',
    //   onChange,
    //   items: [
    //     {value: "BMW"},
    //     {value: "MAZDA"}
    //   ],
    // },
  ];

  return (
    <Formik {...formikSettings}>
      { formikProps => (
        <Form>
          {
            fields.map(field => <FieldBuilder {...field} />)
          }
        </Form>
      )}
    </Formik>
  );
};

export default FormTesting;
