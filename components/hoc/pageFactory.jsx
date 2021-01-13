import React from 'react';

import Layout from '../Layout';


const PageFactory = (scope) => (
  class Page extends React.Component {
    static async getInitialProps(props) {
      const { preloader } = scope;
      return Layout.getInitialProps(props, preloader);
    }

    render() {
      const { RootComponent, className, options, Header, layoutClassName } = scope;
      return (
        <Layout
          className={className}
          Header={Header}
          layoutClassName={layoutClassName}
          {...this.props}
        >
          <RootComponent {...options} />
        </Layout>
      );
    }
  }
);

export default PageFactory;
