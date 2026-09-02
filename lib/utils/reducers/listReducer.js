import { ACTION_TYPES } from '../../constants/reducers/listReducer';

export const initialState = {
  items: [],
  isLoading: true,
  page: 1,
  perPage: 12,
  hasMoreData: true,
  activeItem: null,
  content: null,
  filter: {},
  params: {},
  orderBy: {},
  query: '',
  path: '',
  init: false,
  provider: null,
};

export const reducer = (state, action) => {
  if (!action) {
    return state;
  }
  switch (action.type) {
    case ACTION_TYPES.ADD_ITEMS: {
      if (!action.value) {
        return state;
      }
      const hasMoreData = action.value.length === state.perPage;
      const page = state.page + 1;
      if (!state.items.length) {
        return { ...state, items: [...action.value], hasMoreData, page };
      }
      return { ...state, items: [...state.items, ...action.value], hasMoreData, page };
    }
    case 'INCREASE_PAGE': {
      state.page += 1;
      return state;
    }
    case ACTION_TYPES.SET_LOADING: {
      return { ...state, isLoading: action.value };
    }
    case ACTION_TYPES.SET_ACTIVE_ITEM: {
      if (typeof action.value !== 'object' && action.value !== 'archived') {
        const currentItem = state.items.find(
          (item) => item.title === action.value || item.name === action.value);
        return { ...state, activeItem: currentItem };
      } else {
        return { ...state, activeItem: action.value };
      }
    }
    case ACTION_TYPES.TOGGLE_ACTIVE_ITEM: {
      const activeId = state.activeItem?._id || state.activeItem;
      const newId = action.value && (action.value?._id || action.value);
      if (activeId && newId && activeId === newId) {
        action.value = null;
      }
      return { ...state, activeItem: action.value };
    }
    case ACTION_TYPES.SET_QUERY: {
      return { ...state, query: action.value, hasMoreData: true, items: [], page: 1 };
    }
    case ACTION_TYPES.SET_FILTER: {
      return { ...state, filter: action.value, hasMoreData: true, items: [], page: 1 };
    }
    case ACTION_TYPES.UPDATE_FILTER: {
      const { key, v: value, isRemoving } = action.value;
      const filter = { ...state.filter };
      const valueIsExist = value ?? false;
      if ((filter[key] && !valueIsExist) || isRemoving) {
        delete filter[key];
      } else {
        filter[key] = value;
      }
      return { ...state, filter, hasMoreData: true, items: [], page: 1 };
    }
    case 'SET_SOME_OPTIONS': {
      action.value.forEach((newProp) => {
        if (newProp.key === 'items') {
          state.items = [state.items, ...action.value];
        } else {
          state[newProp.key] = newProp.value;
        }
      });
      return state;
    }
    case ACTION_TYPES.SET_HAS_MORE: {
      state.hasMoreData = action.value;
      return state;
    }
    case ACTION_TYPES.UPDATE_ITEM: {
      const updatedItems = state.items.map((item) => {
        if (item._id === action.value._id) {
          item = action.value;
        }
        return item;
      });
      return { ...state, items: updatedItems };
    }
    case ACTION_TYPES.ADD_ITEM: {
      return { ...state, items: [action.value, ...state.items] };
    }
    case ACTION_TYPES.SET_INITIAL: {
      const filter = action.value.filter ? { ...action.value.filter } : { ...state.filter };
      const orderBy = action.value.orderBy ? { ...action.value.orderBy } : { ...state.orderBy };
      const params = action.value.params ? { ...action.value.params } : { ...state.params };
      const provider = action.value?.provider ? action.value.provider : state.provider;
      const query = action.value?.query ? action.value.query : state.query;
      const activeItem = action.value?.activeItem ? action.value.activeItem : state.activeItem;
      return {
        ...initialState,
        provider,
        content: action.value.content,
        path: action.value.path,
        perPage: action.value.perPage || state.perPage,
        filter,
        orderBy,
        params,
        query,
        activeItem,
        init: true,
      };
    }
    case 'SET_SOURCE': {
      return { ...state, path: action.value };
    }
    default:
      return state;
  }
};
