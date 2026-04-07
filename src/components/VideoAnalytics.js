import Component from './base/Component.js';
import { createElementFromHTML } from '../utils/jsx.js';

export default class VideoAnalytics extends Component {
  constructor(options = {}) {
    super(options);
    this.videos = options.videos || [];
    this.campaigns = options.campaigns || [];
    this.dateRange = options.dateRange || 'last7days';
    this.onExportData = options.onExportData || (() => {});

    this.analytics = {
      totalViews: 0,
      uniqueViewers: 0,
      averageWatchTime: 0,
      completionRate: 0,
      clickThroughRate: 0,
      totalVideos: this.videos.length,
      totalCampaigns: this.campaigns.length,
      engagementScore: 0
    };

    this.filters = {
      dateRange: this.dateRange,
      videoType: 'all',
      campaign: 'all'
    };

    this.topVideos = [];
    this.timeline = [];
    this.devices = { desktop: 0, mobile: 0, tablet: 0 };
    this.geography = [];
  }

  handleExport = () => {
    this.onExportData({
      analytics: this.analytics,
      topVideos: this.topVideos,
      timeline: this.timeline,
      devices: this.devices,
      geography: this.geography
    });
  };

  handleFilterChange = (filterType, value) => {
    this.filters[filterType] = value;
    // In a real implementation, this would recalculate analytics based on filters
    this.update();
  };

  render() {
    const metrics = [
      { label: 'Total Views', value: this.analytics.totalViews.toLocaleString(), icon: '👁️' },
      { label: 'Unique Viewers', value: this.analytics.uniqueViewers.toLocaleString(), icon: '👤' },
      { label: 'Avg Watch Time', value: `${this.analytics.averageWatchTime}s`, icon: '⏱️' },
      { label: 'Completion Rate', value: `${this.analytics.completionRate}%`, icon: '✅' },
      { label: 'CTR', value: `${this.analytics.clickThroughRate}%`, icon: '👆' },
      { label: 'Videos', value: this.analytics.totalVideos, icon: '🎬' },
      { label: 'Campaigns', value: this.analytics.totalCampaigns, icon: '📊' },
      { label: 'Engagement', value: this.analytics.engagementScore, icon: '💯' }
    ];

    const metricsHtml = metrics.map(metric => `
      <div class="metric-card">
        <div class="metric-icon">${metric.icon}</div>
        <div class="metric-value">${metric.value}</div>
        <div class="metric-label">${metric.label}</div>
      </div>
    `).join('');

    const topVideosHtml = this.topVideos.slice(0, 5).map(video => `
      <div class="top-video-item">
        <div class="video-rank">#${video.rank}</div>
        <div class="video-info">
          <div class="video-title">${video.title}</div>
          <div class="video-stats">${video.views} views • ${video.watchTime}s avg</div>
        </div>
      </div>
    `).join('');

    const html = `
      <div class="video-analytics">
        <div class="analytics-header">
          <h2>Video Analytics Dashboard</h2>
          <div class="analytics-controls">
            <select onchange="this.handleFilterChange('dateRange', this.value)">
              <option value="last7days" ${this.filters.dateRange === 'last7days' ? 'selected' : ''}>Last 7 days</option>
              <option value="last30days" ${this.filters.dateRange === 'last30days' ? 'selected' : ''}>Last 30 days</option>
              <option value="last90days" ${this.filters.dateRange === 'last90days' ? 'selected' : ''}>Last 90 days</option>
            </select>
            <button onclick="this.handleExport()">Export Data</button>
          </div>
        </div>

        <div class="metrics-grid">
          ${metricsHtml}
        </div>

        ${this.topVideos.length > 0 ? `
          <div class="top-videos-section">
            <h3>Top Performing Videos</h3>
            <div class="top-videos-list">
              ${topVideosHtml}
            </div>
          </div>
        ` : ''}

        <div class="analytics-placeholder">
          <p>Analytics data will be calculated from video performance metrics.</p>
          <p>This includes views, engagement, completion rates, and geographic data.</p>
        </div>
      </div>
    `;

    return createElementFromHTML(html);
  }

  update() {
    // Update when data changes
    if (this.element) {
      // This would trigger a re-render in a real implementation
    }
  }

  mount(element) {
    super.mount(element);
    this.element.handleExport = this.handleExport.bind(this);
    this.element.handleFilterChange = this.handleFilterChange.bind(this);
  }

  // Methods to update analytics data
  setAnalyticsData(data) {
    this.analytics = { ...this.analytics, ...data };
    this.update();
  }

  setTopVideos(videos) {
    this.topVideos = videos;
    this.update();
  }

  setTimelineData(timeline) {
    this.timeline = timeline;
    this.update();
  }

  setDeviceData(devices) {
    this.devices = devices;
    this.update();
  }

  setGeographyData(geography) {
    this.geography = geography;
    this.update();
  }
}