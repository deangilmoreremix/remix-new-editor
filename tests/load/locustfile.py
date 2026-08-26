"""Locust load test for OpenMontage production endpoints.

Simulates concurrent users creating productions against the OpenMontage API.
Target: 100 concurrent users, 10 req/s sustained.

Usage:
    locust -f tests/load/locustfile.py \
        --host=http://localhost:8000 \
        --users 100 \
        --spawn-rate 10 \
        --run-time 5m \
        --headless \
        --html report.html
"""

from __future__ import annotations

import json
import random
import uuid
from typing import Optional

from locust import HttpUser, between, task


class OpenMontageUser(HttpUser):
    """Simulates a user interacting with the OpenMontage API."""

    wait_time = between(0.5, 2.0)

    def on_start(self) -> None:
        """Verify health endpoint before starting load."""
        self.client.get("/health", name="health_check")

    @task(5)
    def create_production(self) -> None:
        """Simulate creating a new production."""
        payload = {
            "title": f"Load Test Production {uuid.uuid4().hex[:8]}",
            "pipeline_type": random.choice([
                "animated-explainer",
                "cinematic",
                "animation",
                "screen-demo",
            ]),
            "duration": random.choice([30, 60, 90, 120]),
            "tone": random.choice(["professional", "casual", "educational"]),
            "topic": random.choice([
                "machine learning basics",
                "climate change impact",
                "product launch teaser",
                "team onboarding guide",
            ]),
        }

        with self.client.post(
            "/api/productions",
            json=payload,
            name="create_production",
            catch_response=True,
        ) as response:
            if response.status_code == 201:
                response.success()
                try:
                    data = response.json()
                    production_id = data.get("id")
                    if production_id:
                        self._production_id = production_id
                except (json.JSONDecodeError, AttributeError):
                    pass
            elif response.status_code == 429:
                response.failure("Rate limited (429)")
            elif response.status_code >= 500:
                response.failure(f"Server error ({response.status_code})")
            else:
                response.success()

    @task(3)
    def get_production(self) -> None:
        """Simulate fetching a production status."""
        production_id = getattr(self, "_production_id", None)
        if production_id:
            self.client.get(
                f"/api/productions/{production_id}",
                name="get_production",
            )
        else:
            self.client.get(
                "/api/productions",
                name="list_productions",
            )

    @task(2)
    def get_health(self) -> None:
        """Hit the health endpoint."""
        self.client.get("/health", name="health_check")

    @task(1)
    def get_tools(self) -> None:
        """Fetch available tools/capabilities."""
        self.client.get("/api/tools", name="get_tools")

    @task(1)
    def create_and_poll_production(self) -> None:
        """Create a production and poll for status."""
        payload = {
            "title": f"Poll Test {uuid.uuid4().hex[:8]}",
            "pipeline_type": "framework-smoke",
            "duration": 30,
            "tone": "test",
            "topic": "load test smoke",
        }

        with self.client.post(
            "/api/productions",
            json=payload,
            name="create_and_poll_create",
            catch_response=True,
        ) as response:
            if response.status_code != 201:
                response.failure(f"Create failed: {response.status_code}")
                return

            try:
                data = response.json()
                production_id = data.get("id")
            except (json.JSONDecodeError, AttributeError):
                response.failure("Invalid JSON in create response")
                return

            if not production_id:
                response.failure("No production ID in response")
                return

            response.success()

        if production_id:
            self.client.get(
                f"/api/productions/{production_id}",
                name="create_and_poll_status",
            )

    _production_id: Optional[str] = None
