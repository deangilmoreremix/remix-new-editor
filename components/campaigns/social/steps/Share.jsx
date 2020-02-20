import React, { Component } from 'react';
import { Input } from 'reactstrap';
import { observer } from 'mobx-react';

import PropTypes from '../../../../lib/PropTypes';
import ProjectPropType from '../../../../lib/prop-types/ProjectPropType';
import FormInputGroup from '../../../form/FormInputGroup/FormInputGroup';

export default provider => {
  class Share extends Component {
    onChange = (e, name) => {
      const { value, error } = e;
      const { onChangeData } = this.props;
      onChangeData({ error, [name]: value });
    };

    render() {
      const { data, project, className } = this.props;
      return (
        <>
          <div className={className || ''}>
            {project.shares.find(item => item.provider === provider)
              ? (
                <>
                  <p>Your video has been published successfully!</p>
                  <div className="sharing-result">
                    <Input
                      className="url-input"
                      type="text"
                      value={project.shares.find(item => item.provider === provider).url}
                      readOnly
                    />
                  </div>
                </>
              )
              : (
                <>
                  <p>What do you want the Post to look like?</p>
                  <div className="sharing-container">
                    <div className="post-data">
                      <FormInputGroup
                        className="input-group"
                        inputType="text"
                        placeholder="title"
                        handler={this.onChange}
                        label="Post Title"
                        name="title"
                        valueHolder={{ value: data.title }}
                        required
                        hint={false}
                      />
                      <FormInputGroup
                        className="textarea-group"
                        inputType="textarea"
                        placeholder="description"
                        handler={this.onChange}
                        label="Post Description"
                        name="description"
                        valueHolder={{ value: data.description }}
                        hint={false}
                      />
                    </div>
                    <div className="project-container">
                      <div className="tile" style={{ backgroundImage: `url(${project.cover})` }} />
                    </div>
                  </div>
                </>
              )}
          </div>
        </>
      );
    }
  }

  Share.propTypes = {
    data: PropTypes.shape({
      description: PropTypes.string,
      title: PropTypes.string.isRequired,
    }).isRequired,
    project: ProjectPropType.isRequired,
    onChangeData: PropTypes.func.isRequired,
    className: PropTypes.string,
  };

  return observer(Share);
};
