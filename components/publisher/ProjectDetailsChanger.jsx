import React, { Component } from 'react';
import { observer } from 'mobx-react';
import { Input, FormGroup, Label } from 'reactstrap';
import { PopupboxManager } from 'react-popupbox';

import PropTypes from '../../lib/PropTypes';
import ImageUpload from '../common/ImageUpload';

const recommendedResolution = {
  width: 1200,
  height: 630,
};

@observer
class ProjectDetailsChanger extends Component {
  constructor(props) {
    super(props);

    const { project: { name: title, description, thumbnail } } = props;
    this.state = { title, description, thumbnail };
  }

  onValueChange = () => {
    const { onChange, project } = this.props;
    const { title, description, thumbnail } = this.state;
    project.name = title;
    project.description = description;
    project.thumbnail = thumbnail;
    onChange(project);
  };

  isDataValid = () => {
    const { title } = this.state;
    return title && title.length > 0;
  };

  onFileUploaded = (thumbnail) => {
    this.setState({ thumbnail });
    PopupboxManager.close();
  };

  render() {
    const { className } = this.props;
    const { title, description, thumbnail } = this.state;
    return (
      <div className={className}>
        <FormGroup>
          <Label for="project-details-description">Project Title</Label>
          <Input
            id="project-details-title"
            className="overview-item title-field"
            type="text"
            value={title}
            onChange={({ target: { value } }) => this.setState({ title: value })}
          />
        </FormGroup>
        <FormGroup>
          <Label for="project-details-description">Project Description</Label>
          <Input
            id="project-details-description"
            className="overview-item description-field"
            type="textarea"
            rows={4}
            value={description}
            onChange={({ target: { value } }) => this.setState({ description: value })}
          />
        </FormGroup>
        <FormGroup className="thumbnail-field">
          <Label for="project-details-thumbnail">Project Thumbnail</Label>
          <img
            id="project-details-thumbnail"
            src={thumbnail}
            alt="Project Posterframe"
          />
          <div className="upload-box">

            <ImageUpload
              onFileUploaded={this.onFileUploaded}
              recommendedResolution={recommendedResolution}
            />
            <button
              className={`go-button button-primary submit ${this.isDataValid() ? '' : 'inactive'}`}
              onClick={() => {
                if (this.isDataValid()) {
                  this.onValueChange();
                }
              }}
              type="button"
            >
              save
            </button>
          </div>
        </FormGroup>
      </div>
    );
  }
}

ProjectDetailsChanger.propTypes = {
  className: PropTypes.string,
  project: PropTypes.shape({
    name: PropTypes.string,
    description: PropTypes.string,
    thumbnail: PropTypes.string,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
};

export default ProjectDetailsChanger;
