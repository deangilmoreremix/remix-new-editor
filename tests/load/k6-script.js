/**
 * k6 HTTP load test for OpenMontage API.
 *
 * Target: 100 concurrent users, 10 req/s sustained.
 * Fails if p95 latency > 2s or error rate > 1%.
 *
 * Usage:
 *   k6 run tests/load/k6-script.js
 *
 * With environment overrides:
 *   k6 run -e HOST=http://localhost:8000 -e USERS=100 -e DURATION=5m tests/load/k6-script.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const HOST = __ENV.HOST || "http://localhost:8000";
const USERS = parseInt(__ENV.USERS || "100", 10);
const DURATION = __ENV.DURATION || "5m";
const RPS_TARGET = parseInt(__ENV.RPS || "10", 10);

const errorRate = new Rate("errors");
const p95Latency = new Trend("p95_latency");

export const options = {
  stages: [
    { duration: "1m", target: Math.floor(USERS * 0.2) },
    { duration: "2m", target: USERS },
    { duration: DURATION, target: USERS },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"],
    errors: ["rate<0.01"],
    http_req_failed: ["rate<0.01"],
  },
};

const PIPELINE_TYPES = [
  "animated-explainer",
  "cinematic",
  "animation",
  "screen-demo",
];

const TOPICS = [
  "machine learning basics",
  "climate change impact",
  "product launch teaser",
  "team onboarding guide",
];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function () {
  const params = {
    headers: {
      "Content-Type": "application/json",
    },
  };

  // Health check
  const healthRes = http.get(`${HOST}/health`, {
    ...params,
    tags: { name: "health" },
  });
  const healthOk = check(healthRes, {
    "health status is 200": (r) => r.status === 200,
    "health response time < 500ms": (r) => r.timings.duration < 500,
  });
  errorRate.add(!healthOk);
  p95Latency.add(healthRes.timings.duration);

  sleep(0.5);

  // Create production
  const payload = JSON.stringify({
    title: `k6 Load Test ${__VU}-${__ITER}`,
    pipeline_type: randomChoice(PIPELINE_TYPES),
    duration: [30, 60, 90, 120][Math.floor(Math.random() * 4)],
    tone: "test",
    topic: randomChoice(TOPICS),
  });

  const createRes = http.post(`${HOST}/api/productions`, payload, {
    ...params,
    tags: { name: "create_production" },
  });

  const createOk = check(createRes, {
    "create status is 201": (r) => r.status === 201,
    "create response time < 2s": (r) => r.timings.duration < 2000,
  });
  errorRate.add(!createOk);
  p95Latency.add(createRes.timings.duration);

  let productionId = null;
  if (createRes.status === 201) {
    try {
      const body = JSON.parse(createRes.body);
      productionId = body.id;
    } catch (e) {
      // ignore parse errors
    }
  }

  sleep(0.3);

  // Get production or list
  const getUrl = productionId
    ? `${HOST}/api/productions/${productionId}`
    : `${HOST}/api/productions`;
  const getRes = http.get(getUrl, {
    ...params,
    tags: { name: productionId ? "get_production" : "list_productions" },
  });

  const getOk = check(getRes, {
    "get status is 200": (r) => r.status === 200,
    "get response time < 1s": (r) => r.timings.duration < 1000,
  });
  errorRate.add(!getOk);
  p95Latency.add(getRes.timings.duration);

  sleep(1 / RPS_TARGET);
}
