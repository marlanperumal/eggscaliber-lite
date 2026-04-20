from unittest.mock import patch

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from src.auth import get_current_user
from src.config import settings


def _make_rsa_keypair():
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()
    public_pem = (
        private_key.public_key()
        .public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        .decode()
    )
    return private_pem, public_pem


def _make_token(private_pem: str, payload: dict) -> str:
    return jwt.encode(payload, private_pem, algorithm="RS256")


def test_dev_mode_returns_dev_user():
    with patch.object(settings, "auth_mode", "dev"):
        user = get_current_user(credentials=None)
    assert user.clerk_id == "dev_user"
    assert user.email == "dev@example.com"
    assert user.org_id is None


def test_missing_credentials_raises_401():
    with (
        patch.object(settings, "auth_mode", "production"),
        pytest.raises(HTTPException) as exc_info,
    ):
        get_current_user(credentials=None)
    assert exc_info.value.status_code == 401


def test_invalid_token_raises_401():
    from fastapi.security import HTTPAuthorizationCredentials

    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="not.a.real.token")
    with (
        patch.object(settings, "auth_mode", "production"),
        patch.object(settings, "clerk_jwt_key", "not-a-real-key"),
        pytest.raises(HTTPException) as exc_info,
    ):
        get_current_user(credentials=creds)
    assert exc_info.value.status_code == 401


def test_valid_token_returns_current_user():
    from fastapi.security import HTTPAuthorizationCredentials

    private_pem, public_pem = _make_rsa_keypair()
    token = _make_token(
        private_pem,
        {"sub": "user_test123", "email": "test@example.com", "org_id": "org_abc"},
    )
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    with (
        patch.object(settings, "auth_mode", "production"),
        patch.object(settings, "clerk_jwt_key", public_pem),
    ):
        user = get_current_user(credentials=creds)
    assert user.clerk_id == "user_test123"
    assert user.email == "test@example.com"
    assert user.org_id == "org_abc"


def test_valid_token_without_org_id():
    from fastapi.security import HTTPAuthorizationCredentials

    private_pem, public_pem = _make_rsa_keypair()
    token = _make_token(private_pem, {"sub": "user_noorg", "email": "noorg@example.com"})
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    with (
        patch.object(settings, "auth_mode", "production"),
        patch.object(settings, "clerk_jwt_key", public_pem),
    ):
        user = get_current_user(credentials=creds)
    assert user.org_id is None
