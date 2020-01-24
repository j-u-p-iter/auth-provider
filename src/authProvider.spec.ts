import nock from "nock";
import { createAuthProvider } from ".";

describe("authProvider", () => {
  const signResponse = {
    data: { user: { id: 1 }, accessToken: "someAccessToken" }
  };

  const currentUserResponse = {
    data: { user: { id: 1, name: "some name", email: "some@email.com" } }
  };

  describe("with default params", () => {
    const host = "super-site.com";
    const baseUrl = `https://${host}`;
    const getPath = subPath => `/api/v1/${subPath}`;

    let authProvider;

    beforeAll(() => {
      authProvider = createAuthProvider({
        host
      });
    });

    beforeEach(() => {
      localStorage.clear();
    });

    describe("signUp", () => {
      beforeAll(() => {
        nock(baseUrl)
          .post(getPath("sign-up"))
          .reply(200, signResponse);
      });

      it("sends request, returns correct result, and save token in localStorage", async () => {
        expect(authProvider.getAccessToken()).toBe(null);

        const user = await authProvider.signUp({
          email: "some@email.com",
          name: "someName",
          password: 12345
        });

        expect(user).toEqual(signResponse.data.user);
        expect(authProvider.getAccessToken()).toBe(
          signResponse.data.accessToken
        );
      });
    });

    describe("signIn", () => {
      beforeAll(() => {
        nock(baseUrl)
          .post(getPath("sign-in"))
          .reply(200, signResponse);
      });

      it("sends request, returns correct result and saves accessToken in localStorage", async () => {
        expect(authProvider.getAccessToken()).toBe(null);

        const user = await authProvider.signIn({
          email: "some@email.com",
          password: 12345
        });

        expect(user).toEqual(signResponse.data.user);
        expect(authProvider.getAccessToken()).toBe(
          signResponse.data.accessToken
        );
      });
    });

    describe("signOut", () => {
      beforeAll(() => {
        nock(baseUrl)
          .post(getPath("sign-in"))
          .reply(200, signResponse);
      });

      it("removes access token from localStorage", async () => {
        await authProvider.signIn({
          email: "some@email.com",
          password: 12345
        });

        expect(authProvider.getAccessToken()).toBe(
          signResponse.data.accessToken
        );

        authProvider.signOut();

        expect(authProvider.getAccessToken()).toBe(null);
      });
    });

    describe("isSignedIn", () => {
      beforeAll(() => {
        nock(baseUrl)
          .post(getPath("sign-in"))
          .reply(200, signResponse);
      });

      it("checks authentication properly", async () => {
        await authProvider.signIn({
          email: "some@email.com",
          password: 12345
        });

        expect(authProvider.isSignedIn()).toBe(true);

        authProvider.signOut();

        expect(authProvider.isSignedIn()).toBe(false);
      });
    });

    describe("getAccessToken", () => {
      beforeAll(() => {
        nock(baseUrl)
          .post(getPath("sign-in"))
          .reply(200, signResponse);
      });

      it("returns correct access token", async () => {
        expect(authProvider.getAccessToken()).toBe(null);

        await authProvider.signIn({
          email: "some@email.com",
          password: 12345
        });

        expect(authProvider.getAccessToken()).toBe(
          signResponse.data.accessToken
        );
      });
    });

    describe("getCurrentUser", () => {
      describe("when user is not signed in", () => {
        it("resolves to null", async () => {
          expect(authProvider.isSignedIn()).toBe(false);

          const user = await authProvider.getCurrentUser();

          expect(user).toBe(null);
        });
      });

      describe("when user is signed in", () => {
        beforeAll(() => {
          nock(baseUrl)
            .post(getPath("sign-in"))
            .reply(200, signResponse);

          nock(baseUrl, {
            reqheaders: {
              Authorization: `Bearer ${signResponse.data.accessToken}`
            }
          })
            .get(getPath("current-user"))
            .reply(200, currentUserResponse);
        });

        it("resolves to correct user data", async () => {
          await authProvider.signIn({
            email: "some@email.com",
            password: 12345
          });

          const user = await authProvider.getCurrentUser();

          expect(user).toEqual(currentUserResponse.data.user);
        });
      });
    });

    describe("checkError", () => {
      let authProviderWithRedirectHelper;
      const redirectHelper = jest.fn();

      beforeEach(() => {
        redirectHelper.mockClear();

        authProviderWithRedirectHelper = createAuthProvider({
          host,
          redirectHelper
        });
      });

      describe("in case of 401 response", () => {
        let urlToRedirectAfter401;

        beforeAll(() => {
          urlToRedirectAfter401 = "urlToRedirectAfter401";

          nock(baseUrl)
            .post(getPath("sign-in"))
            .reply(200, signResponse);
        });

        it("logouts and redirects to correct url", async () => {
          await authProviderWithRedirectHelper.signIn({
            email: "some@email.com",
            password: 12345
          });

          expect(authProvider.isSignedIn()).toBe(true);

          authProviderWithRedirectHelper.checkError(
            { status: "401" },
            { 401: urlToRedirectAfter401 }
          );

          expect(authProvider.isSignedIn()).toBe(false);
          expect(redirectHelper).toHaveBeenCalledTimes(1);
          expect(redirectHelper).toHaveBeenCalledWith(urlToRedirectAfter401);
        });
      });

      describe("in case of 403 response", () => {
        let urlToRedirectAfter403;

        beforeAll(() => {
          urlToRedirectAfter403 = "urlToRedirectAfter403";

          nock(baseUrl)
            .post(getPath("sign-in"))
            .reply(200, signResponse);
        });

        it("does not logout and redirects to correct url", async () => {
          await authProviderWithRedirectHelper.signIn({
            email: "some@email.com",
            password: 12345
          });

          expect(authProvider.isSignedIn()).toBe(true);

          authProviderWithRedirectHelper.checkError(
            { status: "403" },
            { 403: urlToRedirectAfter403 }
          );

          expect(authProvider.isSignedIn()).toBe(true);
          expect(redirectHelper).toHaveBeenCalledTimes(1);
          expect(redirectHelper).toHaveBeenCalledWith(urlToRedirectAfter403);
        });
      });
    });
  });

  describe("with custom params", () => {
    let authProvider;

    beforeAll(() => {
      authProvider = createAuthProvider({
        host: "localhost",
        port: 5000,
        protocol: "http",
        apiVersion: "v2"
      });

      nock("http://localhost:5000")
        .post("/api/v2/sign-in")
        .reply(200, signResponse);
    });

    it("sends requests to correct url", async () => {
      await authProvider.signIn({
        email: "some@email.com",
        password: 12345
      });

      expect(authProvider.isSignedIn()).toBe(true);
    });

    it("does not throw error without predefined redirectHelper", async () => {
      await authProvider.checkError({ status: "401" }, { 401: "some url" });
    });
  });
});
