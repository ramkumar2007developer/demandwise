/**
 * DemandWise 2.0 — Phase 4 Frontend Tests
 * api.ts: sanitizeErrorMessage + ApiError + fetch behavior
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ApiError, sanitizeErrorMessage } from '../services/api';

// ─── sanitizeErrorMessage ───────────────────────────────────────────────────

describe('sanitizeErrorMessage', () => {
  it('returns a safe message for empty input', () => {
    expect(sanitizeErrorMessage('')).toBe('An unexpected error occurred.');
  });

  it('passes through plain user-visible messages unchanged', () => {
    const msg = 'latitude: value is out of valid range';
    expect(sanitizeErrorMessage(msg)).toBe(msg);
  });

  it('redacts Python tracebacks', () => {
    const msg =
      'Traceback (most recent call last):\n  File "app/services/ml.py", line 42, in predict\nAttributeError: NoneType has no attribute "predict"';
    const result = sanitizeErrorMessage(msg);
    expect(result).toBe(
      'The server encountered an issue processing your request. Please try again.'
    );
  });

  it('redacts Groq/OpenAI-style API keys (gsk_ prefix)', () => {
    const msg = 'Invalid key gsk_AbcDefGhiJklMnopQrstUvwx123456 supplied to API';
    expect(sanitizeErrorMessage(msg)).toContain('[REDACTED_KEY]');
    expect(sanitizeErrorMessage(msg)).not.toContain('gsk_');
  });

  it('redacts sk- style API keys', () => {
    const msg = 'Authorization failed: sk-proj-AbcDefGhiJklMno1234567890 is not valid';
    expect(sanitizeErrorMessage(msg)).toContain('[REDACTED_KEY]');
    expect(sanitizeErrorMessage(msg)).not.toContain('sk-proj-');
  });

  it('redacts Windows filesystem paths', () => {
    const msg = 'FileNotFoundError: C:\\Users\\Hp\\models\\demand_model.pkl not found';
    expect(sanitizeErrorMessage(msg)).toContain('[system path]');
  });

  it('handles null input gracefully', () => {
    const result = sanitizeErrorMessage(null as any);
    expect(result).toBe('An unexpected error occurred.');
  });

  it('does not alter numeric coordinates in error messages', () => {
    const msg = 'Location (11.0168, 76.9558) is within Coimbatore bounds.';
    expect(sanitizeErrorMessage(msg)).toBe(msg);
  });
});

// ─── ApiError ───────────────────────────────────────────────────────────────

describe('ApiError', () => {
  it('constructs with sanitized message', () => {
    const err = new ApiError('Something went wrong', 422);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ApiError');
    expect(err.status).toBe(422);
    expect(err.message).toBe('Something went wrong');
  });

  it('sanitizes traceback in constructor', () => {
    const err = new ApiError(
      'Traceback (most recent call last):\n  File "app.py", line 1',
      500
    );
    expect(err.message).toBe(
      'The server encountered an issue processing your request. Please try again.'
    );
  });

  it('stores original status code', () => {
    const err = new ApiError('Not found', 404);
    expect(err.status).toBe(404);
  });

  it('stores optional detail', () => {
    const err = new ApiError('Bad request', 400, { field: 'latitude', issue: 'out of range' });
    expect(err.detail).toEqual({ field: 'latitude', issue: 'out of range' });
  });
});

// ─── api.getHealth — fetch mock ──────────────────────────────────────────────

describe('api.getHealth fetch behavior', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws ApiError when backend is unreachable (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const { api } = await import('../services/api');
    await expect(api.getHealth()).rejects.toThrow(ApiError);
  });

  it('throws ApiError with status 503 when server returns error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ detail: 'Service unavailable' }),
    }));

    const { api } = await import('../services/api');
    try {
      await api.getHealth();
      expect.fail('should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(503);
    }
  });

  it('returns parsed JSON on success', async () => {
    const mockResponse = { status: 'healthy', version: '2.0.0' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    }));

    const { api } = await import('../services/api');
    const result = await api.getHealth();
    expect(result.status).toBe('healthy');
    expect(result.version).toBe('2.0.0');
  });

  it('does not expose API keys in error message from server', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ detail: 'Traceback (most recent call last):\n  File "app.py", line 1\nKey: gsk_AbcDefGhiJklMnopQrstUvwx123456' }),
    }));

    const { api } = await import('../services/api');
    try {
      await api.getHealth();
    } catch (err: any) {
      // The error message must not contain raw API keys
      expect(err.message).not.toMatch(/gsk_/);
    }
  });
});

// ─── api.searchCompetitors client caching & AbortSignal ─────────────────────

describe('api.searchCompetitors client-side caching & cancellation', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    const { clearCompetitorCache } = await import('../services/api');
    clearCompetitorCache();
  });

  it('caches competitor results and returns is_cached=true on subsequent calls', async () => {
    const mockCompetitorResp = {
      provider: 'openstreetmap_overpass',
      service_type: 'place_search',
      retrieval_timestamp: new Date().toISOString(),
      search_center: { latitude: 11.0168, longitude: 76.9558 },
      search_radius_meters: 2000,
      business_type: 'cafe',
      total_found: 1,
      competitors: [
        {
          name: 'Coimbatore Kaapi',
          category: 'cafe',
          osm_id: 101,
          latitude: 11.0180,
          longitude: 76.9570,
          distance_km: 0.18,
        },
      ],
      status: 'success',
      note: null,
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockCompetitorResp,
    });
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await import('../services/api');

    // First call -> Hits network
    const firstCall = await api.searchCompetitors({
      business_type: 'cafe',
      latitude: 11.0168,
      longitude: 76.9558,
      radius_meters: 2000,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(firstCall.total_found).toBe(1);

    // Second call with same location -> Hits client cache (no network fetch!)
    const secondCall = await api.searchCompetitors({
      business_type: 'cafe',
      latitude: 11.0168,
      longitude: 76.9558,
      radius_meters: 2000,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1); // Still 1!
    expect(secondCall.is_cached).toBe(true);
    expect(secondCall.total_found).toBe(1);
  });

  it('reuses nearby cache within 150m and recalculates distances', async () => {
    const mockCompetitorResp = {
      provider: 'openstreetmap_overpass',
      service_type: 'place_search',
      retrieval_timestamp: new Date().toISOString(),
      search_center: { latitude: 11.0168, longitude: 76.9558 },
      search_radius_meters: 2000,
      business_type: 'cafe',
      total_found: 1,
      competitors: [
        {
          name: 'Filter Kaapi',
          category: 'cafe',
          osm_id: 102,
          latitude: 11.0180,
          longitude: 76.9570,
          distance_km: 0.18,
        },
      ],
      status: 'success',
      note: null,
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockCompetitorResp,
    });
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await import('../services/api');

    await api.searchCompetitors({
      business_type: 'cafe',
      latitude: 11.0168,
      longitude: 76.9558,
      radius_meters: 2000,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Minor shift (50 meters away, ~0.00045 deg)
    const nearby = await api.searchCompetitors({
      business_type: 'cafe',
      latitude: 11.01725,
      longitude: 76.95625,
      radius_meters: 2000,
    });
    // Must hit proximity cache without another fetch call
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(nearby.is_cached).toBe(true);
    expect(nearby.search_center.latitude).toBe(11.01725);
  });

  it('re-throws AbortError on cancellation without transforming to ApiError', async () => {
    const abortErr = new Error('The user aborted a request.');
    abortErr.name = 'AbortError';

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortErr));

    const { api } = await import('../services/api');
    const controller = new AbortController();
    controller.abort();

    await expect(
      api.searchCompetitors(
        { business_type: 'cafe', latitude: 11.01, longitude: 76.95 },
        controller.signal
      )
    ).rejects.toThrow('The user aborted a request.');
  });
});

