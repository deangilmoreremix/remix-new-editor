import React from 'react';

import Layout from '../Layout';


const WithTerms = (scope) => (
  class Page extends React.Component {
    static async getInitialProps(props) {
      const { preloader } = scope;
      return Layout.getInitialProps(props, preloader);
    }

    render() {
      const { RootComponent, options } = scope;
      return (
        <Layout {...this.props}>
          <RootComponent {...options} />
        </Layout>

      );
    }
  }
);

export default WithTerms;
