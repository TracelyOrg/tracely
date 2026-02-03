from __future__ import annotations


def test_health_returns_ok(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body == {"data": {"status": "ok"}, "meta": {}}


def test_health_envelope_format(client):
    response = client.get("/health")
    body = response.json()
    assert "data" in body
    assert "meta" in body
    assert isinstance(body["meta"], dict)
