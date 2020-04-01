import * as React from 'react';

import PropTypes from '../../../../lib/PropTypes';
import { BASIC_FIELDS } from '../../../../lib/constants/settings/svg-preset';
import FieldBuilder from '../../../form/FieldBuilder';

const Basic = ({ options, onChange }) => {
  console.log('Basic options', options);
  return (
    <div>
      {Object.keys(BASIC_FIELDS).map(key => {
        const field = BASIC_FIELDS[key];
        return (
          <FieldBuilder
            value={options[key]}
            key={key}
            name={key}
            {...field}
            onChange={onChange}
          />
        );
      })}
    </div>
  );

  // return (
  //   <Formik
  //     initialValues={initialValues}
  //     onSubmit={onSubmit}
  //     enableReinitialize
  //   >
  //     {props => (
  //       <Form>
  //         {Object.keys(BASIC_FIELDS).map(key => {
  //           const field = BASIC_FIELDS[key];
  //           return (
  //             <FieldBuilder
  //               key={key}
  //               name={key}
  //               {...field}
  //               {...props}
  //               onChange={onChange}
  //               onKeyDown={onChange}
  //             />
  //           );
  //         })}
  //       </Form>
  //     )}
  //   </Formik>
  // );
};

Basic.propTypes = {
  options: PropTypes.shape({}),
  onChange: PropTypes.func.isRequired,
};

export default Basic;
