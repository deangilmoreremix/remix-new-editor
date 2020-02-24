import { Component } from 'react';
import PropTypes from '../../../../lib/PropTypes';

class StageComponent extends Component {
  constructor(props) {
    super(props);

    this.state = {
      ...this.props,
      ...{
        onVariablesUpdated: (variables) => {
          this.setState(variables);
        },
      },
    };
  }

  render() {
    const { render } = this.props;
    return render(this.state);
  }
}

StageComponent.propTypes = {
  render: PropTypes.func.isRequired,
  variables: PropTypes.shape({
    embedLocation: PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      prompt: PropTypes.string,
      embedGenerator: PropTypes.func,
    }),
    embedPage: PropTypes.string,
    preload: PropTypes.boolean,
    autoplay: PropTypes.boolean,
    selectedFbPage: PropTypes.string,
    facebookPageTab: PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
    }),
    postData: PropTypes.shape({
      link: PropTypes.string,
      title: PropTypes.string,
      thumbnail: PropTypes.string,
      description: PropTypes.string,
    }),
    userData: PropTypes.shape({
      name: PropTypes.string.isRequired,
      userpic: PropTypes.string.isRequired,
    }),
  }),
};

export default StageComponent;