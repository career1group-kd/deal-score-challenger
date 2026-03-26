"""
HubSpot API v3 async client with rate limiting.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any, Dict, List, Optional

import httpx

from config import get_settings

BASE_URL = "https://api.hubapi.com"
RATE_LIMIT_CALLS = 95  # stay under 100/10s
RATE_LIMIT_WINDOW = 10.0


class HubSpotClient:
    def __init__(self, api_key: str | None = None):
        settings = get_settings()
        self.api_key = api_key or settings.HUBSPOT_API_KEY
        self._call_times: list[float] = []
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=BASE_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                timeout=30.0,
            )
        return self._client

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def _rate_limit(self):
        """Simple sliding-window rate limiter."""
        now = time.monotonic()
        self._call_times = [t for t in self._call_times if now - t < RATE_LIMIT_WINDOW]
        if len(self._call_times) >= RATE_LIMIT_CALLS:
            sleep_for = RATE_LIMIT_WINDOW - (now - self._call_times[0])
            if sleep_for > 0:
                await asyncio.sleep(sleep_for)
        self._call_times.append(time.monotonic())

    async def _request(self, method: str, path: str, **kwargs) -> Dict[str, Any]:
        await self._rate_limit()
        client = await self._get_client()
        resp = await client.request(method, path, **kwargs)
        resp.raise_for_status()
        return resp.json()

    # ----- Deal endpoints -----

    async def get_deals(
        self,
        properties: List[str] | None = None,
        limit: int = 100,
        after: str | None = None,
    ) -> Dict[str, Any]:
        params: Dict[str, Any] = {"limit": min(limit, 100)}
        if properties:
            params["properties"] = ",".join(properties)
        if after:
            params["after"] = after
        return await self._request("GET", "/crm/v3/objects/deals", params=params)

    async def get_deal(self, deal_id: str, properties: List[str] | None = None) -> Dict[str, Any]:
        params = {}
        if properties:
            params["properties"] = ",".join(properties)
        return await self._request("GET", f"/crm/v3/objects/deals/{deal_id}", params=params)

    async def search_deals(self, filters: List[Dict], properties: List[str] | None = None,
                           limit: int = 100, after: int = 0) -> Dict[str, Any]:
        body: Dict[str, Any] = {
            "filterGroups": [{"filters": filters}],
            "limit": limit,
            "after": after,
        }
        if properties:
            body["properties"] = properties
        return await self._request("POST", "/crm/v3/objects/deals/search", json=body)

    async def get_deal_associations(self, deal_id: str, to_object: str = "contacts") -> Dict[str, Any]:
        return await self._request(
            "GET", f"/crm/v3/objects/deals/{deal_id}/associations/{to_object}"
        )

    # ----- Contact endpoints (for lead score) -----

    async def get_contact(self, contact_id: str, properties: List[str] | None = None) -> Dict[str, Any]:
        params = {}
        if properties:
            params["properties"] = ",".join(properties)
        return await self._request("GET", f"/crm/v3/objects/contacts/{contact_id}", params=params)

    async def get_all_deals(self, properties: List[str] | None = None):
        """Async generator that yields deals page by page (memory-efficient)."""
        after: str | None = None
        while True:
            data = await self.get_deals(properties=properties, limit=100, after=after)
            results = data.get("results", [])
            for deal in results:
                yield deal
            paging = data.get("paging", {})
            next_page = paging.get("next", {})
            after = next_page.get("after")
            if not after:
                break
