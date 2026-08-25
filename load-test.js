import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const videoGenerationRate = new Rate('video_generation_success');
const videoGenerationDuration = new Trend('video_generation_duration');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 10 },  // Ramp up to 10 users
    { duration: '3m', target: 10 },  // Stay at 10 users
    { duration: '1m', target: 50 },  // Ramp up to 50 users
    { duration: '3m', target: 50 },  // Stay at 50 users
    { duration: '1m', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'], // 95% of requests should be below 5s
    http_req_failed: ['rate<0.1'],     // Error rate should be below 10%
    video_generation_success: ['rate>0.95'], // 95% success rate for video generation
    video_generation_duration: ['p(95)<30000'], // 95% of generations under 30s
  },
};

// Base URL for the application
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test data
const testContacts = [
  { email: 'john@example.com', firstName: 'John', lastName: 'Doe', company: 'Acme Inc' },
  { email: 'jane@example.com', firstName: 'Jane', lastName: 'Smith', company: 'TechCorp' },
  { email: 'bob@example.com', firstName: 'Bob', lastName: 'Johnson', company: 'StartupXYZ' },
  { email: 'alice@example.com', firstName: 'Alice', lastName: 'Brown', company: 'InnovateLabs' },
  { email: 'charlie@example.com', firstName: 'Charlie', lastName: 'Wilson', company: 'FutureTech' },
];

const testScripts = [
  'Hi {{firstName}}, welcome to {{company}}! This is a personalized video message.',
  'Hello {{firstName}} from {{company}}. Thank you for your interest in our services.',
  '{{firstName}}, we at {{company}} are excited to share this exclusive content with you.',
];

export default function () {
  // Simulate user journey for video personalization

  // 1. Load the main page
  const mainPageResponse = http.get(`${BASE_URL}/personalize`);
  check(mainPageResponse, {
    'main page loads': (r) => r.status === 200,
    'contains personalization hub': (r) => r.body.includes('VideoPersonalizationHub'),
  });

  sleep(1);

  // 2. Simulate contact import (mock API call)
  const contactsPayload = {
    contacts: testContacts.slice(0, Math.floor(Math.random() * 3) + 1), // 1-3 random contacts
  };

  const importResponse = http.post(
    `${BASE_URL}/api/contacts/import`,
    JSON.stringify(contactsPayload),
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  check(importResponse, {
    'contact import succeeds': (r) => r.status === 200 || r.status === 201,
  });

  sleep(2);

  // 3. Simulate video generation request
  const selectedContacts = testContacts.slice(0, 2); // Use first 2 contacts
  const selectedScript = testScripts[Math.floor(Math.random() * testScripts.length)];

  const generationPayload = {
    contacts: selectedContacts,
    script: selectedScript,
    videoUrl: '/api/placeholder-video',
    thumbnail: '/api/placeholder-thumbnail.jpg',
    campaignId: `campaign_${__VU}_${Date.now()}`, // Unique per virtual user
  };

  const startTime = new Date().getTime();

  const generationResponse = http.post(
    `${BASE_URL}/api/videos/generate`,
    JSON.stringify(generationPayload),
    {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: '60s', // Allow up to 60 seconds for generation
    }
  );

  const endTime = new Date().getTime();
  const duration = endTime - startTime;

  // Track custom metrics
  videoGenerationRate.add(generationResponse.status === 200);
  videoGenerationDuration.add(duration);

  check(generationResponse, {
    'video generation request succeeds': (r) => r.status === 200 || r.status === 202,
    'response contains video data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.videos && Array.isArray(body.videos);
      } catch (e) {
        return false;
      }
    },
    'generation completes within time limit': () => duration < 60000, // 60 seconds
  });

  sleep(3);

  // 4. Test landing page generation
  const landingPagePayload = {
    video: {
      url: '/api/generated-video.mp4',
      thumbnail: '/api/generated-thumbnail.jpg',
    },
    contact: selectedContacts[0],
    template: 'sales-introduction',
    campaignId: generationPayload.campaignId,
  };

  const landingResponse = http.post(
    `${BASE_URL}/api/landing-pages/create`,
    JSON.stringify(landingPagePayload),
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  check(landingResponse, {
    'landing page creation succeeds': (r) => r.status === 200 || r.status === 201,
    'returns shareable URL': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.shareUrl && body.shareUrl.includes('/v/');
      } catch (e) {
        return false;
      }
    },
  });

  sleep(2);

  // 5. Test landing page access (if created)
  if (landingResponse.status === 200) {
    try {
      const landingData = JSON.parse(landingResponse.body);
      const landingPageUrl = landingData.shareUrl;

      const pageResponse = http.get(`${BASE_URL}${landingPageUrl}`);
      check(pageResponse, {
        'landing page loads': (r) => r.status === 200,
        'contains video element': (r) => r.body.includes('<video') || r.body.includes('video'),
      });
    } catch (e) {
      // Skip if response parsing fails
    }
  }

  // Random sleep between 1-5 seconds to simulate user think time
  sleep(Math.random() * 4 + 1);
}

// Setup function (runs before the test starts)
export function setup() {
  console.log('Starting load test for video personalization platform');

  // Pre-warm the application
  const warmupResponse = http.get(`${BASE_URL}/personalize`);
  if (warmupResponse.status !== 200) {
    console.error('Application warmup failed');
  }

  return { timestamp: new Date().toISOString() };
}

// Teardown function (runs after the test completes)
export function teardown(data) {
  console.log(`Load test completed. Started at: ${data.timestamp}`);
}

// Handle summary (runs after all tests complete)
export function handleSummary(data) {
  const summary = {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'load-test-results.json': JSON.stringify(data, null, 2),
    'performance-report.html': htmlReport(data),
  };

  return summary;
}

function textSummary(data, options) {
  return `
📊 Load Test Summary
====================

Test Duration: ${data.metrics.iteration_duration.values.avg}ms avg iteration
Total Requests: ${data.metrics.http_reqs.values.count}
Failed Requests: ${data.metrics.http_req_failed.values.rate * 100}%

📈 HTTP Metrics:
- Avg Response Time: ${Math.round(data.metrics.http_req_duration.values.avg)}ms
- 95th Percentile: ${Math.round(data.metrics.http_req_duration.values['p(95)']}ms
- 99th Percentile: ${Math.round(data.metrics.http_req_duration.values['p(99)']}ms

🎬 Video Generation Metrics:
- Success Rate: ${(data.metrics.video_generation_success?.values.rate * 100 || 0).toFixed(1)}%
- Avg Generation Time: ${Math.round(data.metrics.video_generation_duration?.values.avg || 0)}ms
- 95th Percentile: ${Math.round(data.metrics.video_generation_duration?.values['p(95)'] || 0)}ms

🔥 Performance Thresholds:
${data.metrics.http_req_duration.thresholds['p(95)<5000'] ? '✅' : '❌'} 95% of requests < 5s
${data.metrics.http_req_failed.thresholds['rate<0.1'] ? '✅' : '❌'} Error rate < 10%
${data.metrics.video_generation_success?.thresholds['rate>0.95'] ? '✅' : '❌'} Generation success > 95%
${data.metrics.video_generation_duration?.thresholds['p(95)<30000'] ? '✅' : '❌'} Generation time < 30s

Recommendations:
${data.metrics.http_req_duration.values['p(95)'] > 5000 ? '- Consider optimizing API response times\n' : ''}
${data.metrics.http_req_failed.values.rate > 0.1 ? '- Investigate error causes\n' : ''}
${(data.metrics.video_generation_success?.values.rate || 1) < 0.95 ? '- Improve video generation reliability\n' : ''}
${(data.metrics.video_generation_duration?.values['p(95)'] || 0) > 30000 ? '- Optimize video generation performance\n' : ''}
`;
}

function htmlReport(data) {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Load Test Report - Video Personalization Platform</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .metric { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; }
        .success { color: #28a745; }
        .error { color: #dc3545; }
        h1, h2 { color: #333; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>🎬 Video Personalization Platform - Load Test Report</h1>

    <div class="metric">
        <h2>Test Overview</h2>
        <p><strong>Duration:</strong> ${Math.round(data.metrics.iteration_duration.values.avg)}ms avg iteration</p>
        <p><strong>Total Requests:</strong> ${data.metrics.http_reqs.values.count}</p>
        <p><strong>Error Rate:</strong> ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%</p>
    </div>

    <div class="metric">
        <h2>HTTP Performance</h2>
        <table>
            <tr><th>Metric</th><th>Value</th></tr>
            <tr><td>Average Response Time</td><td>${Math.round(data.metrics.http_req_duration.values.avg)}ms</td></tr>
            <tr><td>95th Percentile</td><td>${Math.round(data.metrics.http_req_duration.values['p(95)'])}ms</td></tr>
            <tr><td>99th Percentile</td><td>${Math.round(data.metrics.http_req_duration.values['p(99)'])}ms</td></tr>
        </table>
    </div>

    <div class="metric">
        <h2>Video Generation Performance</h2>
        <table>
            <tr><th>Metric</th><th>Value</th></tr>
            <tr><td>Success Rate</td><td>${(data.metrics.video_generation_success?.values.rate * 100 || 0).toFixed(1)}%</td></tr>
            <tr><td>Average Generation Time</td><td>${Math.round(data.metrics.video_generation_duration?.values.avg || 0)}ms</td></tr>
            <tr><td>95th Percentile</td><td>${Math.round(data.metrics.video_generation_duration?.values['p(95)'] || 0)}ms</td></tr>
        </table>
    </div>

    <div class="metric">
        <h2>Threshold Results</h2>
        <p class="${data.metrics.http_req_duration.thresholds['p(95)<5000'] ? 'success' : 'error'}">
            ✅ 95% of requests < 5s: ${data.metrics.http_req_duration.thresholds['p(95)<5000'] ? 'PASSED' : 'FAILED'}
        </p>
        <p class="${data.metrics.http_req_failed.thresholds['rate<0.1'] ? 'success' : 'error'}">
            ✅ Error rate < 10%: ${data.metrics.http_req_failed.thresholds['rate<0.1'] ? 'PASSED' : 'FAILED'}
        </p>
    </div>
</body>
</html>
`;
}