"""Tests for utils module."""
import pytest
from balancer.utils import parse_money_gbp, parse_float, clean_name


def test_parse_money_gbp_simple():
    """Test parsing simple GBP amount."""
    assert parse_money_gbp("1000") == 1000.0
    assert parse_money_gbp("1000.50") == 1000.50


def test_parse_money_gbp_with_currency_symbol():
    """Test parsing GBP amount with £ symbol."""
    assert parse_money_gbp("£1000") == 1000.0
    assert parse_money_gbp("£1,000.50") == 1000.50


def test_parse_money_gbp_with_commas():
    """Test parsing GBP amount with thousands separators."""
    assert parse_money_gbp("1,000") == 1000.0
    assert parse_money_gbp("10,000.50") == 10000.50


def test_parse_money_gbp_empty():
    """Test parsing empty or dash values."""
    assert parse_money_gbp("") == 0.0
    assert parse_money_gbp("-") == 0.0
    assert parse_money_gbp(None) == 0.0


def test_parse_money_gbp_with_text():
    """Test parsing GBP amount with extra text."""
    assert parse_money_gbp("£1,000.50 GBP") == 1000.50
    assert parse_money_gbp("Price: £2,500") == 2500.0


def test_parse_float_simple():
    """Test parsing simple float."""
    assert parse_float("1000") == 1000.0
    assert parse_float("1000.50") == 1000.50


def test_parse_float_with_commas():
    """Test parsing float with thousands separators."""
    assert parse_float("1,000") == 1000.0
    assert parse_float("10,000.50") == 10000.50


def test_parse_float_empty():
    """Test parsing empty or dash values."""
    assert parse_float("") == 0.0
    assert parse_float("-") == 0.0
    assert parse_float(None) == 0.0


def test_parse_float_negative():
    """Test parsing negative values."""
    assert parse_float("-1000") == -1000.0
    assert parse_float("-1,000.50") == -1000.50


def test_clean_name():
    """Test cleaning asset names."""
    assert clean_name("Bitcoin") == "Bitcoin"
    assert clean_name("Bitcoin*") == "Bitcoin"
    assert clean_name("*Ethereum*") == "Ethereum"
    assert clean_name("  Token  ") == "Token"
    assert clean_name("") == ""
    assert clean_name(None) == ""

