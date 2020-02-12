import React, { Component } from 'react';
import Head from 'next/head';
import { Provider } from 'mobx-react';
// import stylesheet from '../styles/index.scss';
// import stylesheet from '../styles/index.scss';

import { initStoreAndPreload, initStore } from '../globals/store';

class Layout extends Component {
  static async getInitialProps({ query, req }, preloader) {
    const isServer = !!req;
    const store = await initStoreAndPreload(isServer, query, req, preloader);
    return { store };
  }

  constructor(props) {
    super(props);
    this.store = initStore(props.store);
  }

  render() {
    return (
      <Provider store={this.store} api={this.api}>
        <Head>
          <title>New Video Editor</title>
          {/* <style dangerouslySetInnerHTML={{ __html: stylesheet }} /> */}
        </Head>
        <div>
          <div {...this.props} className="main">
            {this.props.children}
          </div>
        </div>
      </Provider>
    );
  }
}

export default Layout;
