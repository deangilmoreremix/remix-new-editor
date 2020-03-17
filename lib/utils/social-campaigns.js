import { MIN_FANS_PAGE } from '../constants/campaigns/constants';

export const isEnoughFans = (page) => (page ? page.fanCount > MIN_FANS_PAGE : false);
