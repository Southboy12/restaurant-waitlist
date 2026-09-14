import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  setAuthToken,
  clearAuthToken,
  isTokenValid,
  getActiveParties,
  getHistory,
  addParty,
  notifyParty,
  seatParty,
  removeParty,
} from "./index";

function mockFetchOnce(payload: unknown, ok = true, status = 200) {
  const mock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(payload),
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  clearAuthToken();
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearAuthToken();
});

describe("token management", () => {
  it("is invalid without a token", () => {
    expect(isTokenValid()).toBe(false);
  });

  it("is valid after setting a token with future expiry", () => {
    setAuthToken("abc", 60_000);
    expect(isTokenValid()).toBe(true);
  });

  it("is invalid after clearing", () => {
    setAuthToken("abc", 60_000);
    clearAuthToken();
    expect(isTokenValid()).toBe(false);
  });
});

describe("API client", () => {
  const loginPayload = { access_token: "token-123", token_type: "bearer", expires_in: 60 };

  function stubLoginThen(payload: unknown, ok = true, status = 200) {
    const fetchMock = vi.fn();
    // First call: auto-login
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(loginPayload),
    });
    // Second call: the actual API response
    fetchMock.mockResolvedValueOnce({
      ok,
      status,
      json: () => Promise.resolve(payload),
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("auto-logins then fetches active parties", async () => {
    const parties = [{ id: "p1", name: "Adeyemi" }];
    const fetchMock = stubLoginThen(parties);

    const result = await getActiveParties();

    expect(result).toEqual(parties);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/login");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/parties/active");
    // Bearer token attached on the second call
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer token-123");
  });

  it("fetches history", async () => {
    const history = [{ id: "h1", resolution: "seated" }];
    stubLoginThen(history);

    expect(await getHistory()).toEqual(history);
  });

  it("adds a party via POST", async () => {
    const created = { id: "p9", name: "Test" };
    const fetchMock = stubLoginThen(created);

    const result = await addParty({ name: "Test", size: "2", phone: "123" });

    expect(result).toEqual(created);
    expect(fetchMock.mock.calls[1][1].method).toBe("POST");
  });

  it("throws a friendly error when add fails", async () => {
    stubLoginThen({ error: "Name is required" }, false, 400);

    await expect(addParty({ name: "", size: "2", phone: "123" })).rejects.toThrow(
      "Name is required",
    );
  });

  it("notifies a party", async () => {
    const payload = { party: { id: "p1" }, message: "sent" };
    stubLoginThen(payload);

    expect(await notifyParty("p1")).toEqual(payload);
  });

  it("throws not-found error when notify targets a missing party", async () => {
    stubLoginThen({}, false, 404);

    await expect(notifyParty("missing")).rejects.toThrow("Party not found in active list");
  });

  it("seats a party", async () => {
    const payload = { id: "p1", resolution: "seated" };
    stubLoginThen(payload);

    expect(await seatParty("p1")).toEqual(payload);
  });

  it("removes a party via DELETE", async () => {
    const fetchMock = stubLoginThen(null);

    await removeParty("p1");

    expect(fetchMock.mock.calls[1][1].method).toBe("DELETE");
  });

  it("throws when the login itself fails", async () => {
    mockFetchOnce({}, false, 401);

    await expect(getActiveParties()).rejects.toThrow("Authentication failed");
  });

  it("reuses a valid token without re-logging in", async () => {
    setAuthToken("cached-token", 60_000);
    const fetchMock = mockFetchOnce([{ id: "p1" }]);

    await getActiveParties();

    // Only one fetch (no login round-trip)
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer cached-token");
  });
});
