import React, { useState, useEffect, useReducer, useMemo } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';
import moment from 'moment';

import List from './common/gallery/List';
import SearchInput from './form/SearchInput';
import { LibrarySpinner } from './media/Loader';

import useUserStore from './hooks/useUserStore';
import useModalStore from './hooks/useModalStore';

import { ACTION_TYPES } from '../lib/constants/reducers/listReducer';
import { CANCELLATION_MODAL, DETAILS_MODAL } from '../lib/constants/modals';

import {
  initialState as listInitialState,
  reducer as listReducer,
} from '../lib/utils/reducers/listReducer';
import { showError } from '../lib/services/alertService';

import backChevronIcon from '../public/static/svgImages/billing/back-chevron.svg';
import nextChevronIcon from '../public/static/svgImages/billing/next-chevron.svg';

const Billing = observer(() => {
  const { hasPermissions, getActiveSubscription } = useUserStore();
  const { openModal } = useModalStore();

  const [paymentsList, dispatchPayments] = useReducer(listReducer, listInitialState);

  const [planPage, setPlanPage] = useState(1);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchActiveSubscriptions();
    fetchPayments();
  }, []);

  useEffect(() => {
    if (planPage < 1) {
      setPlanPage(subscriptions.length);
    } else if (planPage > subscriptions.length) {
      setPlanPage(1);
    }
  }, [planPage]);

  const onSearchSubscription = (query) => {
    dispatchPayments({
      type: ACTION_TYPES.SET_QUERY,
      value: query,
    });
  };

  const fetchActiveSubscriptions = async () => {
    try {
      setLoading(true);
      const data = await getActiveSubscription();
      if (data) {
        setSubscriptions(data);
        setLoading(false);
      }
    } catch (e) {
      setLoading(false);
      showError(e);
    }
  };

  const fetchPayments = () => dispatchPayments({
    type: ACTION_TYPES.SET_INITIAL,
    value: {
      path: '/api/payments/me',
      content: ({ item }) => billingTable(item),
      perPage: 20,
      orderBy: { createdAt: -1 },
    },
  });

  const onCancelPlan = (id) => {
    openModal(CANCELLATION_MODAL, { id, requestHasBeenSend: () => fetchActiveSubscriptions() });
  };

  const onGetDetails = (details) => {
    openModal(DETAILS_MODAL, { details });
  };

  const billingTable = (item) => (
    <tr key={item._id}>
      <td>{moment(item.createdAt).format('MMMM Do YYYY')}</td>
      <td>{item.productName}</td>
      <td>{`${item.amount}$`}</td>
      <td>{item.paymentPlatform}</td>
      <td>{item.transactionType}</td>
      <td>
        <button onClick={() => onGetDetails(item)}>Details</button>
      </td>
    </tr>
  );

  const activeSubscription = useMemo(() => (subscription) => (
    planPage >= 1 && planPage <= subscriptions.length && (
      <>
        <div className="billing-plan-box__header">
          <span>Plan</span>
          {subscription.nextBillingDate && (
            <button
              disabled={subscription.hasCancelRequest}
              onClick={() => onCancelPlan(subscription._id)}
            >
              {subscription.hasCancelRequest ? 'Your request has been sent' : 'Cancel'}
            </button>
          )}
        </div>
        <div className="billing-plan-box__data">
          <div className="billing-plan-box__data-field">
            <span>Subscription</span>
            <p>{subscription.name}</p>
            <div className="billing-plan-box__data-field-taxes" />
          </div>
          <div className="billing-plan-box__data-field">
            <span>Next Billing Date</span>
            <p>
              {subscription.nextBillingDate
                ? moment(subscription.nextBillingDate).format('MMMM Do YYYY')
                : 'One Time Subscription'}
            </p>
            <div className="billing-plan-box__data-field-taxes" />
          </div>
          <div className="billing-plan-box__data-field">
            <span>Amount</span>
            <p>{`$${subscription.amount}`}</p>
            <p className="billing-plan-box__data-field-taxes">* taxes may apply</p>
          </div>
        </div>
      </>
    )
  ), [subscriptions, planPage]);

  return (
    <div className={classnames('user-panel auto-height', { 'background-dark-theme': hasPermissions })}>
      <div className="billing-plan-box">
        {loading && <LibrarySpinner />}
        {subscriptions && subscriptions.length ? (
          <>
            <div className="billing-plan-box__chevrons">
              <SVGInline
                svg={backChevronIcon}
                className={classnames('billing-plan-box__chevrons-icon')}
                onClick={() => setPlanPage(planPage - 1)}
              />
              <span>{`${planPage} of ${subscriptions.length}`}</span>
              <SVGInline
                svg={nextChevronIcon}
                className={classnames('billing-plan-box__chevrons-icon')}
                onClick={() => setPlanPage(planPage + 1)}
              />
            </div>
            {activeSubscription(subscriptions[planPage - 1])}
          </>
        ) : <p className="billing-plan-box__nothing-text">You have no active subscriptions</p>}
      </div>
      <div className="billing-history-box">
        <div className="billing-history-box__header">
          <span>Billing history</span>
          <div className="billing-history-box__header-search">
            <SearchInput
              className="billing-history-box__header-search__input"
              svgClassName="billing-history-box__header-search__svg"
              onSearch={onSearchSubscription}
              placeholder=""
            />
          </div>
        </div>
        <div className="billing-history-box__table">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Product Name</th>
                <th>Amount</th>
                <th>Payment Via</th>
                <th>Status</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              <List isTable withoutParent list={paymentsList} dispatchList={dispatchPayments} />
            </tbody>
          </table>
        </div>
      </div>
      <div className="library__gradient" />
    </div>
  );
});

export default Billing;
