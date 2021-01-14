import { ACTION_TYPES } from '../../constants/reducers/listReducer';

export const initialState = {
  items: [],
  isLoading: true,
  page: 1,
  perPage: 12,
  hasMoreData: true,
  content: null,
  filter: {},
  orderBy: {},
  query: '',
  path: '',
  init: false,
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
    case 'SET_QUERY': {
      return { ...initialState, content: state.content, path: state.path, query: action.value };
    }
    case 'SET_FILTER': {
      state.filter = action.value;
      return state;
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
    case ACTION_TYPES.SET_INITIAL: {
      return {
        ...initialState,
        content: action.value.content,
        path: action.value.path,
        perPage: action.value.perPage || state.perPage,
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
