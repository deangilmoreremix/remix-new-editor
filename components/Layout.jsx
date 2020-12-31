import React, { Component } from 'react';
import Head from 'next/head';
import { Provider, observer } from 'mobx-react';
import ThemeProvider from '@material-ui/styles/ThemeProvider';

import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

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

import { DEFAULT_TITLE, DOMAIN_VIDEOREMIX } from '../lib/constants/project';

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

  componentDidMount() {
    const { common: { whiteLabelManager } } = this.stores;
    document.body.classList.add(`theme-${whiteLabelManager.key}`);
  }

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
    const { common: { whiteLabelManager } } = this.stores;
    return (
      <ThemeProvider theme={this.theme}>
        <Provider {...this.stores}>
          <DndProvider backend={HTML5Backend}>
            {whiteLabelManager.domain === DOMAIN_VIDEOREMIX
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
            <div className={`theme-${whiteLabelManager.key} layout-container`}>
              <Head>
                <link
                  rel="preload"
                  href="../public/static/fonts/ProximaNova/Proxima-Nova-Regular.otf"
                  as="font"
                  crossOrigin=""
                />
                <link
                  rel="preload"
                  href="../public/static/fonts/ProximaNova/Proxima-Nova-Light.otf"
                  as="font"
                  crossOrigin=""
                />
                <link
                  rel="preload"
                  href="../public/static/fonts/ProximaNova/Proxima-Nova-Bold.otf"
                  as="font"
                  crossOrigin=""
                />
                <title>{DEFAULT_TITLE}</title>
                <link
                  rel="shortcut icon"
                  href={
                    whiteLabelManager.shouldOverride
                      ? `//cdn.vidcloud.io/wl/${whiteLabelManager.domain}/resources/vc_favicon`
                      : '//cdn.vidcloud.io/resources/revolution/favicon.png'
                  }
                />
                {whiteLabelManager.shouldOverride
                && (
                  <style dangerouslySetInnerHTML={
                    { __html: whiteLabelManager.css }
                  }
                  />
                )}
                {/* Google Tag Manager */}
                {whiteLabelManager.domain === DOMAIN_VIDEOREMIX
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
                <script src={this.stores.common.vrviewPath} />
              </Head>
              {this.hasPermissions ? (
                <div>
                  <Header whiteLabelManager={whiteLabelManager} className={`theme-${whiteLabelManager.key}`} />
                  <div {...this.props} className={`main theme-${whiteLabelManager.key}`}>
                    <ModalContainer classNameWL={`theme-${whiteLabelManager.key}`} />
                    {children}
                    {this.stores.userStore.currentUser
                    && whiteLabelManager && whiteLabelManager.domain === DOMAIN_VIDEOREMIX
                      ? (
                        <HelpCrunch
                          userStore={this.stores.userStore}
                          applicationId={this.stores.common.helpCrunch.applicationId}
                          applicationSecret={this.stores.common.helpCrunch.applicationSecret}
                        />
                      ) : null}
                    {this.stores.userStore.currentUser
                    && whiteLabelManager && whiteLabelManager.domain === DOMAIN_VIDEOREMIX
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
                          domain={DOMAIN_VIDEOREMIX}
                        />
                      ) : null}
                  </div>
                </div>
              )
                : <UnauthorizedView />}
            </div>
          </DndProvider>
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
