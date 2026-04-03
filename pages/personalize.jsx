// Personalizer Page - Standalone page for video personalization platform
import React from 'react';
import Head from 'next/head';

import VideoPersonalizationHub from '../components/VideoPersonalizationHub';

const VideoPersonalizationPage = () => {
  return (
    <>
      <Head>
        <title>Personalizer - Create Personalized Videos at Scale</title>
        <meta
          name="description"
          content="Generate personalized videos for your contacts using CSV data and token replacement"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="video-personalization-page">
        <VideoPersonalizationHub />
      </div>

      <style jsx global>{`
        /* Video Personalization Hub Styles */
        .video-personalization-hub {
          display: flex;
          height: 100vh;
          background: #f8f9fa;
        }

        .hub-sidebar {
          width: 280px;
          background: white;
          border-right: 1px solid #e9ecef;
          padding: 24px;
          display: flex;
          flex-direction: column;
        }

        .sidebar-header {
          margin-bottom: 32px;
        }

        .hub-title {
          font-size: 20px;
          font-weight: 600;
          color: #212529;
          margin: 0 0 8px 0;
        }

        .hub-subtitle {
          font-size: 14px;
          color: #6c757d;
          margin: 0;
        }

        .sidebar-navigation {
          flex: 1;
        }

        .nav-item {
          display: flex;
          align-items: center;
          width: 100%;
          padding: 12px 16px;
          margin-bottom: 4px;
          border: none;
          background: transparent;
          border-radius: 8px;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .nav-item:hover {
          background: #f8f9fa;
        }

        .nav-item.active {
          background: #007bff;
          color: white;
        }

        .nav-item.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .nav-icon {
          width: 20px;
          height: 20px;
          margin-right: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
        }

        .nav-label {
          flex: 1;
          font-size: 14px;
        }

        .nav-badge {
          background: #dc3545;
          color: white;
          border-radius: 12px;
          padding: 2px 8px;
          font-size: 12px;
          font-weight: 500;
        }

        .sidebar-status {
          margin-top: auto;
          padding-top: 24px;
          border-top: 1px solid #e9ecef;
        }

        .status-item {
          display: flex;
          align-items: center;
          margin-bottom: 8px;
          font-size: 14px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #6c757d;
          margin-right: 12px;
        }

        .status-dot.complete {
          background: #28a745;
        }

        .hub-content {
          flex: 1;
          overflow: auto;
          padding: 24px;
        }

        .tab-content {
          max-width: 1200px;
          margin: 0 auto;
        }

        /* Contacts Section */
        .contacts-section .section-header {
          margin-bottom: 32px;
        }

        .section-title {
          font-size: 24px;
          font-weight: 600;
          color: #212529;
          margin: 0 0 8px 0;
        }

        .section-subtitle {
          font-size: 16px;
          color: #6c757d;
          margin: 0;
        }

        .empty-state {
          text-align: center;
          padding: 64px 24px;
        }

        .empty-content h3 {
          font-size: 20px;
          color: #212529;
          margin: 0 0 16px 0;
        }

        .empty-content p {
          font-size: 16px;
          color: #6c757d;
          margin: 0 0 24px 0;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }

        .stat-card {
          background: white;
          padding: 24px;
          border-radius: 8px;
          border: 1px solid #e9ecef;
          text-align: center;
        }

        .stat-number {
          font-size: 32px;
          font-weight: 600;
          color: #007bff;
          margin-bottom: 8px;
        }

        .stat-label {
          font-size: 14px;
          color: #6c757d;
        }

        .contacts-preview h4 {
          font-size: 18px;
          font-weight: 600;
          color: #212529;
          margin: 0 0 16px 0;
        }

        .contacts-table {
          background: white;
          border-radius: 8px;
          border: 1px solid #e9ecef;
          overflow: hidden;
        }

        .table-header,
        .table-row {
          display: grid;
          grid-template-columns: 2fr 3fr 2fr;
          gap: 16px;
          padding: 12px 24px;
        }

        .table-header {
          background: #f8f9fa;
          font-weight: 600;
          color: #495057;
          font-size: 14px;
        }

        .table-row {
          border-bottom: 1px solid #e9ecef;
        }

        .table-row:last-child {
          border-bottom: none;
        }

        .contacts-actions {
          margin-top: 24px;
          text-align: center;
        }

        /* Requirements Notice */
        .requirements-notice {
          background: white;
          padding: 32px;
          border-radius: 8px;
          border: 1px solid #e9ecef;
          text-align: center;
        }

        .requirements-notice h3 {
          font-size: 20px;
          color: #212529;
          margin: 0 0 16px 0;
        }

        .requirements-notice p {
          font-size: 16px;
          color: #6c757d;
          margin: 0 0 24px 0;
        }

        .requirements-notice ul {
          text-align: left;
          margin: 0 0 24px 0;
          padding-left: 24px;
        }

        .requirements-notice li {
          margin-bottom: 8px;
          color: #495057;
        }

        .requirements-actions {
          display: flex;
          gap: 16px;
          justify-content: center;
        }

        /* Button Styles */
        .primary-btn,
        .secondary-btn {
          padding: 12px 24px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }

        .primary-btn {
          background: #007bff;
          color: white;
        }

        .primary-btn:hover {
          background: #0056b3;
        }

        .secondary-btn {
          background: #f8f9fa;
          color: #495057;
          border: 1px solid #dee2e6;
        }

        .secondary-btn:hover {
          background: #e9ecef;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .video-personalization-hub {
            flex-direction: column;
            height: auto;
          }

          .hub-sidebar {
            width: 100%;
            border-right: none;
            border-bottom: 1px solid #e9ecef;
          }

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .table-header,
          .table-row {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .requirements-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </>
  );
};

export default VideoPersonalizationPage;