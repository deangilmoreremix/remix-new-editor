// VideoAnalytics - Comprehensive analytics dashboard for video campaigns
import React, { useState, useEffect, useCallback } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import PropTypes from '../lib/PropTypes';
import { showError, showSuccess } from '../lib/services/alertService';

const VideoAnalytics = ({
  videos = [],
  campaigns = [],
  dateRange = 'last7days',
  onExportData
}) => {
  // Analytics state
  const [analytics, setAnalytics] = useState({
    totalViews: 0,
    uniqueViewers: 0,
    averageWatchTime: 0,
    completionRate: 0,
    clickThroughRate: 0,
    totalVideos: 0,
    totalCampaigns: 0,
    engagementScore: 0
  });

  // Filter state
  const [filters, setFilters] = useState({
    dateRange: dateRange,
    videoType: 'all',
    campaign: 'all'
  });

  // Top performing videos
  const [topVideos, setTopVideos] = useState([]);

  // Engagement timeline
  const [timeline, setTimeline] = useState([]);

  // Device breakdown
  const [devices, setDevices] = useState({
    desktop: 0,
    mobile: 0,
    tablet: 0
  });

  // Geographic data
  const [geography, setGeography] = useState([]);

  // Calculate analytics from data
  const calculateAnalytics = useCallback(() => {
    // Simulate analytics calculation (in real implementation, this would fetch from backend)
    const mockAnalytics = {
      totalViews: videos.reduce((sum, v) => sum + (v.views || Math.floor(Math.random() * 100)), 0),
      uniqueViewers: videos.reduce((sum, v) => sum + (v.uniqueViewers || Math.floor(Math.random() * 80)), 0),
      averageWatchTime: 45, // seconds
      completionRate: 72, // percent
      clickThroughRate: 15, // percent
      totalVideos: videos.length,
      totalCampaigns: campaigns.length,
      engagementScore: 85 // 0-100
    };

    setAnalytics(mockAnalytics);

    // Top videos
    const sortedVideos = [...videos]
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 5)
      .map((video, index) => ({
        rank: index + 1,
        name: video.name || `Video ${index + 1}`,
        views: video.views || Math.floor(Math.random() * 100),
        engagement: Math.floor(Math.random() * 100),
        completion: Math.floor(Math.random() * 100)
      }));

    setTopVideos(sortedVideos);

    // Timeline data (last 7 days)
    const timelineData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      timelineData.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        views: Math.floor(Math.random() * 50) + 10,
        engagement: Math.floor(Math.random() * 80) + 20
      });
    }
    setTimeline(timelineData);

    // Device breakdown
    setDevices({
      desktop: Math.floor(Math.random() * 50) + 30,
      mobile: Math.floor(Math.random() * 40) + 20,
      tablet: Math.floor(Math.random() * 20) + 5
    });

    // Geography
    setGeography([
      { country: 'United States', views: Math.floor(Math.random() * 100) + 50, percent: 45 },
      { country: 'United Kingdom', views: Math.floor(Math.random() * 50) + 20, percent: 20 },
      { country: 'Canada', views: Math.floor(Math.random() * 30) + 10, percent: 15 },
      { country: 'Germany', views: Math.floor(Math.random() * 20) + 5, percent: 10 },
      { country: 'Other', views: Math.floor(Math.random() * 30) + 10, percent: 10 }
    ]);

  }, [videos, campaigns]);

  // Load analytics on mount and when data changes
  useEffect(() => {
    calculateAnalytics();
  }, [calculateAnalytics]);

  // Export analytics data
  const exportData = useCallback(() => {
    const exportData = {
      analytics,
      topVideos,
      timeline,
      devices,
      geography,
      filters,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `video-analytics-${Date.now()}.json`;
    link.click();

    showSuccess('Analytics data exported!');

    if (onExportData) {
      onExportData(exportData);
    }
  }, [analytics, topVideos, timeline, devices, geography, filters, onExportData]);

  // Update filters
  const updateFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  return (
    <div className="video-analytics">
      <div className="analytics-header">
        <h2>Video Analytics</h2>
        <p>Track performance and engagement for your video campaigns</p>
      </div>

      {/* Filters */}
      <div className="analytics-filters">
        <div className="filter-group">
          <label>Date Range</label>
          <select
            value={filters.dateRange}
            onChange={(e) => updateFilter('dateRange', e.target.value)}
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7days">Last 7 Days</option>
            <option value="last30days">Last 30 Days</option>
            <option value="last90days">Last 90 Days</option>
            <option value="allTime">All Time</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Video Type</label>
          <select
            value={filters.videoType}
            onChange={(e) => updateFilter('videoType', e.target.value)}
          >
            <option value="all">All Videos</option>
            <option value="personalized">Personalized</option>
            <option value="standard">Standard</option>
          </select>
        </div>

        <button className="btn btn-secondary export-btn" onClick={exportData}>
          Export Data
        </button>
      </div>

      {/* Key Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-value">{analytics.totalViews.toLocaleString()}</div>
          <div className="metric-label">Total Views</div>
          <div className="metric-change positive">+12%</div>
        </div>

        <div className="metric-card">
          <div className="metric-value">{analytics.uniqueViewers.toLocaleString()}</div>
          <div className="metric-label">Unique Viewers</div>
          <div className="metric-change positive">+8%</div>
        </div>

        <div className="metric-card">
          <div className="metric-value">{analytics.averageWatchTime}s</div>
          <div className="metric-label">Avg Watch Time</div>
          <div className="metric-change positive">+5%</div>
        </div>

        <div className="metric-card">
          <div className="metric-value">{analytics.completionRate}%</div>
          <div className="metric-label">Completion Rate</div>
          <div className="metric-change positive">+3%</div>
        </div>

        <div className="metric-card">
          <div className="metric-value">{analytics.clickThroughRate}%</div>
          <div className="metric-label">Click-Through Rate</div>
          <div className="metric-change positive">+7%</div>
        </div>

        <div className="metric-card">
          <div className="metric-value">{analytics.engagementScore}</div>
          <div className="metric-label">Engagement Score</div>
          <div className="metric-change positive">+10%</div>
        </div>
      </div>

      {/* Timeline Chart */}
      <div className="timeline-section">
        <h3>Views Over Time</h3>
        <div className="timeline-chart">
          {timeline.map((day, index) => (
            <div key={index} className="chart-bar">
              <div
                className="bar views"
                style={{ height: `${(day.views / 60) * 100}%` }}
                title={`${day.date}: ${day.views} views`}
              />
              <div className="bar-label">{day.date}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Videos */}
      <div className="top-videos-section">
        <h3>Top Performing Videos</h3>
        <div className="videos-table">
          <div className="table-header">
            <div className="col rank">Rank</div>
            <div className="col name">Video Name</div>
            <div className="col views">Views</div>
            <div className="col engagement">Engagement</div>
            <div className="col completion">Completion</div>
          </div>
          {topVideos.map(video => (
            <div key={video.rank} className="table-row">
              <div className="col rank">#{video.rank}</div>
              <div className="col name">{video.name}</div>
              <div className="col views">{video.views}</div>
              <div className="col engagement">{video.engagement}%</div>
              <div className="col completion">{video.completion}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Device & Geography */}
      <div className="breakdown-section">
        <div className="device-breakdown">
          <h3>Device Breakdown</h3>
          <div className="device-chart">
            <div className="device-item">
              <div className="device-icon">🖥️</div>
              <div className="device-name">Desktop</div>
              <div className="device-percent">{devices.desktop}%</div>
              <div className="device-bar">
                <div className="bar-fill" style={{ width: `${devices.desktop}%` }} />
              </div>
            </div>
            <div className="device-item">
              <div className="device-icon">📱</div>
              <div className="device-name">Mobile</div>
              <div className="device-percent">{devices.mobile}%</div>
              <div className="device-bar">
                <div className="bar-fill" style={{ width: `${devices.mobile}%` }} />
              </div>
            </div>
            <div className="device-item">
              <div className="device-icon">📟</div>
              <div className="device-name">Tablet</div>
              <div className="device-percent">{devices.tablet}%</div>
              <div className="device-bar">
                <div className="bar-fill" style={{ width: `${devices.tablet}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="geography-breakdown">
          <h3>Geographic Distribution</h3>
          <div className="geography-list">
            {geography.map((geo, index) => (
              <div key={index} className="geo-item">
                <div className="geo-country">{geo.country}</div>
                <div className="geo-views">{geo.views} views</div>
                <div className="geo-percent">{geo.percent}%</div>
                <div className="geo-bar">
                  <div className="bar-fill" style={{ width: `${geo.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Engagement Insights */}
      <div className="insights-section">
        <h3>Engagement Insights</h3>
        <div className="insights-grid">
          <div className="insight-card">
            <div className="insight-icon">🎯</div>
            <div className="insight-title">Best Performing Day</div>
            <div className="insight-value">Wednesday</div>
            <div className="insight-description">Highest engagement on mid-week</div>
          </div>

          <div className="insight-card">
            <div className="insight-icon">⏰</div>
            <div className="insight-title">Optimal Video Length</div>
            <div className="insight-value">45-60 seconds</div>
            <div className="insight-description">Highest completion rates</div>
          </div>

          <div className="insight-card">
            <div className="insight-icon">🎬</div>
            <div className="insight-title">Personalization Impact</div>
            <div className="insight-value">+35%</div>
            <div className="insight-description">Higher engagement than generic</div>
          </div>

          <div className="insight-card">
            <div className="insight-icon">📧</div>
            <div className="insight-title">Email Open Rate</div>
            <div className="insight-value">68%</div>
            <div className="insight-description">2x industry average</div>
          </div>
        </div>
      </div>

      {/* Campaign Performance */}
      {campaigns.length > 0 && (
        <div className="campaigns-section">
          <h3>Campaign Performance</h3>
          <div className="campaigns-table">
            <div className="table-header">
              <div className="col name">Campaign</div>
              <div className="col videos">Videos</div>
              <div className="col views">Views</div>
              <div className="col engagement">Engagement</div>
              <div className="col status">Status</div>
            </div>
            {campaigns.map((campaign, index) => (
              <div key={index} className="table-row">
                <div className="col name">{campaign.name}</div>
                <div className="col videos">{campaign.videoCount || 0}</div>
                <div className="col views">{campaign.views || 0}</div>
                <div className="col engagement">{campaign.engagement || 0}%</div>
                <div className="col status">
                  <span className={classnames('status-badge', campaign.status)}>
                    {campaign.status || 'Active'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

VideoAnalytics.propTypes = {
  videos: PropTypes.array,
  campaigns: PropTypes.array,
  dateRange: PropTypes.string,
  onExportData: PropTypes.func
};

export default observer(VideoAnalytics);