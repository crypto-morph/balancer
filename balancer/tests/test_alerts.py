"""Tests for alerts module."""
import pytest
import json
from pathlib import Path
from balancer.alerts import log_alert
from balancer.config import LOG_PATH


def test_log_alert(tmp_path, monkeypatch):
    """Test logging an alert to JSONL file."""
    log_file = tmp_path / "alerts.jsonl"
    # Patch before importing
    import balancer.config
    monkeypatch.setattr(balancer.config, "LOG_PATH", str(log_file))
    # Re-import alerts to pick up the new LOG_PATH
    import importlib
    import balancer.alerts
    importlib.reload(balancer.alerts)
    log = balancer.alerts.log_alert
    
    log("test_alert", "Test message", {"key": "value"}, "info")
    
    assert log_file.exists()
    lines = log_file.read_text().strip().split("\n")
    assert len(lines) == 1
    
    entry = json.loads(lines[0])
    assert entry["type"] == "test_alert"
    assert entry["message"] == "Test message"
    assert entry["payload"] == {"key": "value"}
    assert entry["severity"] == "info"
    assert "at" in entry


def test_log_alert_multiple(tmp_path, monkeypatch):
    """Test logging multiple alerts."""
    log_file = tmp_path / "alerts.jsonl"
    import balancer.config
    monkeypatch.setattr(balancer.config, "LOG_PATH", str(log_file))
    import importlib
    import balancer.alerts
    importlib.reload(balancer.alerts)
    log = balancer.alerts.log_alert
    
    log("alert1", "Message 1")
    log("alert2", "Message 2")
    
    lines = log_file.read_text().strip().split("\n")
    assert len(lines) == 2
    
    entry1 = json.loads(lines[0])
    assert entry1["type"] == "alert1"
    
    entry2 = json.loads(lines[1])
    assert entry2["type"] == "alert2"


def test_log_alert_no_payload(tmp_path, monkeypatch):
    """Test logging alert without payload."""
    log_file = tmp_path / "alerts.jsonl"
    import balancer.config
    monkeypatch.setattr(balancer.config, "LOG_PATH", str(log_file))
    import importlib
    import balancer.alerts
    importlib.reload(balancer.alerts)
    log = balancer.alerts.log_alert
    
    log("test", "Message")
    
    entry = json.loads(log_file.read_text().strip())
    assert entry["payload"] == {}


def test_log_alert_creates_directory(tmp_path, monkeypatch):
    """Test that log_alert creates parent directory if needed."""
    log_file = tmp_path / "subdir" / "alerts.jsonl"
    import balancer.config
    monkeypatch.setattr(balancer.config, "LOG_PATH", str(log_file))
    import importlib
    import balancer.alerts
    importlib.reload(balancer.alerts)
    log = balancer.alerts.log_alert
    
    log("test", "Message")
    
    assert log_file.exists()
    assert log_file.parent.exists()

