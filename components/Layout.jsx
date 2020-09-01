import React, { Component } from 'react';
import Head from 'next/head';
import { Provider, observer } from 'mobx-react';
import ThemeProvider from '@material-ui/styles/ThemeProvider';
import { createMuiTheme } from '@material-ui/core/styles';

import 'styles/index.scss';

import Header from './Header';
import UnauthorizedView from './common/UnauthorizedView';

import ModalContainer from './common/ModalContainer';
import { init, initCreateStores } from '../globals/storesCreator';

import PopcornProxy from '../lib/PopcornProxy';

import PropTypes from '../lib/PropTypes';

import Intercom from './common/Intercom';
import HelpCrunch from './common/HelpCrunch';

import { DEFAULT_TITLE } from '../lib/constants/project';

@observer
class Layout extends Component {
  static async getInitialProps({ query, req }, preloader) {
    const isServer = !!req;
    const data = await initCreateStores(isServer, query, req, preloader);
    return { ...data };
  }

  theme = createMuiTheme({
    typography: {
      fontFamily: '"Proxima Nova", sans-serif',
    },
  });

  constructor(props) {
    super(props);
    const data = init(props.creator);
    this.stores = data.stores;

    const { userStore: { hasPermissions, currentUser } } = this.stores;
    this.hasPermissions = hasPermissions;
    this.currentUser = currentUser;
  }

  render() {
    if (process.browser) {
      PopcornProxy.init(window);
    }
    const { children } = this.props;
    return (
      <ThemeProvider theme={this.theme}>
        <Provider {...this.stores}>
          {this.stores.common.whiteLabelManager.domain === 'videoremix.io'
          && this.stores.common.scriptStatistic && (
            <>
              <noscript dangerouslySetInnerHTML={{
                __html: `<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-WMCHG8T"
                        height="0" width="0" style="display:none;visibility:hidden"></iframe>`,
              }}
              />
              <noscript dangerouslySetInnerHTML={{
                __html: `<img height="1" width="1" style="display:none"
                src="https://www.facebook.com/tr?id=205065714219509&ev=PageView&noscript=1"
            />`,
              }}
              />
            </>
          )}
          <div className="layout-container">
            <Head>
              <title>{DEFAULT_TITLE}</title>
              <link
                rel="shortcut icon"
                href={
                  this.stores.common.whiteLabelManager.shouldOverride
                    ? `//cdn.vidcloud.io/wl/${this.stores.common.whiteLabelManager.domain}/resources/vc_favicon`
                    : '//cdn.vidcloud.io/resources/revolution/favicon.png'
                }
              />
              {/* Google Tag Manager */}
              {this.stores.common.whiteLabelManager.domain === 'videoremix.io'
              && this.stores.common.scriptStatistic && (
                <>
                  <script dangerouslySetInnerHTML={{
                    __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                  new Date().getTime(),event:'gtm.js'});
              var f=d.getElementsByTagName(s)[0],
                j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','GTM-WMCHG8T')`,
                  }}
                  />
                  {/* End Google Tag Manager */}
                  {/* Facebook Pixel Code */}
                  <script dangerouslySetInnerHTML={{
                    __html: `!function (f, b, e, v, n, t, s) {
                  if (f.fbq) return;
                  n = f.fbq = function () {
                    n.callMethod ?
                      n.callMethod.apply(n, arguments) : n.queue.push(arguments)
                  };
                  if (!f._fbq) f._fbq = n;
                  n.push = n;
                  n.loaded = !0;
                  n.version = '2.0';
                  n.queue = [];
                  t = b.createElement(e);
                  t.async = !0;
                  t.src = v;
                  s = b.getElementsByTagName(e)[0];
                  s.parentNode.insertBefore(t, s);
                 }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
                  fbq('init', '205065714219509');
                  fbq('track', 'PageView');`,
                  }}
                  />
                </>
              )}
              {/* End Facebook Pixel Code */}
            </Head>
            {this.hasPermissions ? (
              <div>
                <Header {...this.props} />
                <div {...this.props} className="main">
                  <ModalContainer />
                  {children}
                  {this.currentUser && this.stores.common.whiteLabelManager && this.stores.common.whiteLabelManager.domain === 'videoremix.io'
                    ? (
                      <HelpCrunch
                        userStore={this.stores.userStore}
                        applicationId={this.stores.common.helpCrunch.applicationId}
                        applicationSecret={this.stores.common.helpCrunch.applicationSecret}
                      />
                    ) : null}
                  {this.currentUser && this.stores.common.whiteLabelManager && this.stores.common.whiteLabelManager.domain === 'videoremix.io'
                    ? (
                      <Intercom
                        appID={this.stores.common.intercom.appId}
                        user={{
                          email: this.currentUser.email,
                          fullName: this.currentUser.fullName,
                          hash: this.currentUser.intercomHash,
                          createdAt: Math.floor(
                            Date.parse(this.currentUser.createdAt) / 1000,
                          ).toString(),
                        }}
                        domain="videoremix.io"
                      />
                    ) : null}
                </div>
              </div>
            )
              : <UnauthorizedView />}
          </div>
        </Provider>
      </ThemeProvider>
    );
  }
}

Layout.propTypes = {
  children: PropTypes.element.isRequired,
  // eslint-disable-next-line react/forbid-prop-types
  stores: PropTypes.any,
  // eslint-disable-next-line react/forbid-prop-types
  creator: PropTypes.any,
};

export default Layout;
