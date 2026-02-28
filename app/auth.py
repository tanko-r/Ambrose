"""
Clerk JWT verification for Flask API endpoints.

Provides a singleton PyJWKClient that caches Clerk's JWKS (public keys)
and a verify_clerk_token() function used by the Blueprint before_request guard.

Environment variables:
  CLERK_FRONTEND_API_URL - Clerk Frontend API hostname (preferred for JWKS)
  CLERK_JWKS_URL         - Direct JWKS URL override (fallback)
"""

import os
import jwt
from jwt import PyJWKClient

# Clerk JWKS URL resolution:
# 1. If CLERK_FRONTEND_API_URL is set, use its .well-known/jwks.json (preferred)
# 2. Else if CLERK_JWKS_URL is set, use it directly
# 3. Else fall back to Clerk Backend API JWKS (works in dev)
_frontend_api = os.environ.get('CLERK_FRONTEND_API_URL', '').rstrip('/')
if _frontend_api:
    _CLERK_JWKS_URL = f"{_frontend_api}/.well-known/jwks.json"
else:
    _CLERK_JWKS_URL = os.environ.get('CLERK_JWKS_URL', 'https://api.clerk.com/v1/jwks')

# Singleton PyJWKClient — created once at module import, caches JWKS for 5 minutes
_jwks_client = PyJWKClient(
    _CLERK_JWKS_URL,
    cache_jwk_set=True,     # Cache the entire JWK Set response
    lifespan=300,            # Re-fetch after 5 minutes
    cache_keys=True,         # Also cache individual parsed keys by kid
    max_cached_keys=16,
)


def verify_clerk_token(token: str) -> dict:
    """
    Verify a Clerk session JWT.

    Returns the decoded payload dict if the token is valid.
    Raises ValueError with a user-safe message if invalid.
    """
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key,
            algorithms=['RS256'],
            options={
                'verify_exp': True,
                'verify_nbf': True,
            },
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError('Token expired')
    except jwt.InvalidTokenError as e:
        raise ValueError(f'Invalid token: {e}')
