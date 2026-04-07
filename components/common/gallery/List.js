import { Component } from '../../../base/Component.js';
import { getStore } from '../../../stores/base/Store.js';
import Content from '../list/Content.js';
import { showError } from '../../../lib/services/alertService';
import { ACTION_TYPES } from '../../../lib/constants/reducers/listReducer';

export class List extends Component {
  constructor(props = {}) {
    super(props);
    this.baseStore = getStore('baseStore');

    this.state = {
      list: props.list,
      dispatchList: props.dispatchList,
      className: props.className,
      contentClassName: props.contentClassName,
      withoutParent: props.withoutParent || false,
      isTable: props.isTable || false,
    };

    this.getItems = this.getItems.bind(this);
  }

  async componentDidMount() {
    const { list } = this.state;
    if (list.init) {
      await this.getItems();
    }
  }

  async getItems() {
    const { list, dispatchList } = this.state;
    const { getList } = this.baseStore;

    if ((list.hasMoreData && !list.isLoading) || (list.isLoading && list.page === 1)) {
      dispatchList({ type: ACTION_TYPES.SET_LOADING, value: true });
      let results;
      try {
        if (list.provider) {
          results = await list.provider.getList({ ...list.provider, ...list });
        } else {
          results = await getList({
            ...list,
          });
        }
        dispatchList({ type: ACTION_TYPES.ADD_ITEMS, value: results });
      } catch (e) {
        showError(e.message);
        dispatchList({ type: ACTION_TYPES.SET_HAS_MORE, value: false });
      } finally {
        dispatchList({ type: ACTION_TYPES.SET_LOADING, value: false });
      }
    }
  }

  render() {
    const { list, className, contentClassName, withoutParent, isTable } = this.state;

    const itemElement = (props) => {
      // Assuming list.content is a component
      const ContentComp = list.content;
      return new ContentComp(props);
    };

    const content = new Content({
      items: list.items,
      element: itemElement,
      uploadNewItems: this.getItems,
      isLoading: list.isLoading,
      hasMore: list.hasMoreData,
      className: contentClassName,
      activeItem: list.activeItem,
      withoutParent,
      query: list.query,
      isTable,
    });

    if (withoutParent) {
      return content.render();
    } else {
      const div = document.createElement('div');
      div.className = className;
      div.appendChild(content.render());
      return div;
    }
  }
}
