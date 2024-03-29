import { fetchData } from "@j.u.p.iter/fetch-data";
import nock from "nock";
import fetch, { Request } from "node-fetch";

import {
  createBaseRESTAuthProvider as createAuthProvider,
  OAuthClientName
} from "../.";

describe("authProvider", () => {
  globalThis.fetch = fetch as any;
  globalThis.Request = Request as any;

  const setupQueryString = queryString => {
    window.history.pushState({}, "", queryString ? `?${queryString}` : null);
  };

  const resetQueryString = () => {
    window.history.pushState({}, "", "/");
  };

  const signResponse = {
    data: { user: { id: 1 }, accessToken: "someAccessToken" }
  };

  const errorResponse = {
    error: "some error message"
  };

  const currentUserResponse = {
    data: { user: { id: 1, name: "some name", email: "some@email.com" } }
  };

  describe("with default params", () => {
    const host = "super-site.com";
    const baseUrl = `https://${host}`;
    const getPath = subPath => `/api/v1/auth/${subPath}`;
    const getOAuthPath = subPath => `/api/v1/oauth/${subPath}`;

    let authProvider;

    beforeAll(() => {
      authProvider = createAuthProvider({
        fetcher: fetchData,
        host
      });
    });

    beforeEach(() => {
      localStorage.clear();
    });

    describe("signUp", () => {
      describe("when request fails with error", () => {
        beforeEach(() => {
          nock(baseUrl)
            .post(getPath("sign-up"))
            .reply(400, errorResponse);
        });

        it("handles error properly", async () => {
          expect(authProvider.getAccessToken()).toBe(null);

          const { error } = await authProvider.signUp({
            email: "some@email.com",
            name: "someName",
            password: 12345
          });

          expect(authProvider.getAccessToken()).toBe(null);

          expect(error.code).toBe(400);
          expect((await error.response.json()).error).toEqual(
            errorResponse.error
          );
        });
      });

      describe("when request resolves successfully", () => {
        beforeEach(() => {
          nock(baseUrl)
            .post(getPath("sign-up"))
            .reply(200, signResponse);
        });

        describe("with path to redirect", () => {
          it("sends request, returns correct result, and save token in localStorage", async () => {
            expect(authProvider.getAccessToken()).toBe(null);

            const { data: user } = await authProvider.signUp(
              {
                email: "some@email.com",
                name: "someName",
                password: 12345
              },
              "/home/page"
            );

            expect(user).toEqual(signResponse.data.user);
            expect(authProvider.getAccessToken()).toBe(
              signResponse.data.accessToken
            );
          });
        });

        describe("without path to redirect", () => {
          it("sends request, returns correct result, and save token in localStorage", async () => {
            expect(authProvider.getAccessToken()).toBe(null);

            const { data: user } = await authProvider.signUp({
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
      });
    });

    describe("signIn", () => {
      describe("without oauth client", () => {
        describe("when request fails with error", () => {
          beforeEach(() => {
            nock(baseUrl)
              .post(getPath("sign-in"))
              .reply(400, errorResponse);
          });

          it("handles error properly", async () => {
            expect(authProvider.getAccessToken()).toBe(null);

            const { error } = await authProvider.signIn({
              userData: {
                email: "some@email.com",
                password: 12345
              }
            });

            expect(authProvider.getAccessToken()).toBe(null);

            expect(error.code).toBe(400);
            expect((await error.response.json()).error).toEqual(
              errorResponse.error
            );
          });
        });

        describe("when request resolves successfully", () => {
          let redirectToPath;

          beforeEach(() => {
            redirectToPath = `${host}/admin`;

            nock(baseUrl)
              .post(getPath("sign-in"))
              .reply(200, signResponse);

            setupQueryString(`redirectTo=${redirectToPath}`);
          });

          afterAll(() => {
            resetQueryString();
          });

          it("sends request, returns correct result and saves accessToken in localStorage", async () => {
            expect(authProvider.getAccessToken()).toBe(null);

            const { data: user } = await authProvider.signIn({
              userData: {
                email: "some@email.com",
                password: 12345
              }
            });

            expect(user).toEqual(signResponse.data.user);
            expect(authProvider.getAccessToken()).toBe(
              signResponse.data.accessToken
            );
          });
        });
      });

      describe("with oauth client", () => {
        const CODE = "some-code";

        describe("when request fails with error", () => {
          beforeEach(() => {
            nock(baseUrl)
              .post(getOAuthPath("google/sign-in"), { code: CODE })
              .reply(400, errorResponse);
          });

          it("handles error properly", async () => {
            expect(authProvider.getAccessToken()).toBe(null);

            const { error } = await authProvider.signIn({
              code: CODE,
              oauthClientName: OAuthClientName.Google
            });

            expect(authProvider.getAccessToken()).toBe(null);

            expect(error.code).toBe(400);
            expect((await error.response.json()).error).toEqual(
              errorResponse.error
            );
          });
        });

        describe("when request resolves successfully", () => {
          beforeEach(() => {
            nock(baseUrl)
              .post(getOAuthPath("google/sign-in"), {
                code: CODE
              })
              .reply(200, signResponse);
          });

          it("sends request, returns correct result and saves accessToken in localStorage", async () => {
            expect(authProvider.getAccessToken()).toBe(null);

            const { data: user } = await authProvider.signIn({
              code: CODE,
              oauthClientName: OAuthClientName.Google
            });

            expect(user).toEqual(signResponse.data.user);
            expect(authProvider.getAccessToken()).toBe(
              signResponse.data.accessToken
            );
          });
        });
      });
    });

    describe("signOut", () => {
      beforeEach(() => {
        nock(baseUrl)
          .post(getPath("sign-in"))
          .reply(200, signResponse);
      });

      it("removes access token from localStorage", async () => {
        await authProvider.signIn({
          userData: {
            email: "some@email.com",
            password: 12345
          }
        });

        expect(authProvider.getAccessToken()).toBe(
          signResponse.data.accessToken
        );

        authProvider.signOut();

        expect(authProvider.getAccessToken()).toBe(null);
      });
    });

    describe("isSignedIn", () => {
      beforeEach(() => {
        nock(baseUrl)
          .post(getPath("sign-in"))
          .reply(200, signResponse);
      });

      it("checks authentication properly", async () => {
        await authProvider.signIn({
          userData: {
            email: "some@email.com",
            password: 12345
          }
        });

        expect(authProvider.isSignedIn()).toBe(true);

        authProvider.signOut();

        expect(authProvider.isSignedIn()).toBe(false);
      });
    });

    describe("getAccessToken", () => {
      beforeEach(() => {
        nock(baseUrl)
          .post(getPath("sign-in"))
          .reply(200, signResponse);
      });

      it("returns correct access token", async () => {
        expect(authProvider.getAccessToken()).toBe(null);

        await authProvider.signIn({
          userData: {
            email: "some@email.com",
            password: 12345
          }
        });

        expect(authProvider.getAccessToken()).toBe(
          signResponse.data.accessToken
        );
      });
    });

    describe("updateCurrentUser", () => {
      describe("when request fails with error", () => {
        beforeEach(() => {
          nock(baseUrl)
            .post(getPath("sign-in"))
            .reply(200, signResponse);

          nock(baseUrl, {
            reqheaders: {
              Authorization: `Bearer ${signResponse.data.accessToken}`
            }
          })
            .put(getPath("current-user"))
            .reply(400, errorResponse);
        });

        it("handles error properly", async () => {
          await authProvider.signIn({
            userData: {
              email: "some@email.com",
              password: 12345
            }
          });

          const { error } = await authProvider.updateCurrentUser(
            currentUserResponse.data.user
          );

          expect(error.code).toBe(400);
          expect((await error.response.json()).error).toEqual(
            errorResponse.error
          );
        });
      });

      describe("when request resolves successfully", () => {
        describe("when user is signed in", () => {
          beforeEach(() => {
            nock(baseUrl)
              .post(getPath("sign-in"))
              .reply(200, signResponse);

            nock(baseUrl, {
              reqheaders: {
                Authorization: `Bearer ${signResponse.data.accessToken}`
              }
            })
              .put(getPath("current-user"))
              .reply(200, currentUserResponse);
          });

          it("resolves to correct user data", async () => {
            await authProvider.signIn({
              userData: {
                email: "some@email.com",
                password: 12345
              }
            });

            const { data: user } = await authProvider.updateCurrentUser(
              currentUserResponse.data.user
            );

            expect(user).toEqual(currentUserResponse.data.user);
          });
        });
      });
    });

    describe("askNewPassword", () => {
      describe("when request fails with error", () => {
        beforeEach(() => {
          nock(baseUrl)
            .post(getPath("ask-new-password"))
            .reply(404, errorResponse);
        });

        it("handles error properly", async () => {
          const { error } = await authProvider.askNewPassword({
            email: "some@email.com"
          });

          expect(error.code).toBe(404);
          expect((await error.response.json()).error).toEqual(
            errorResponse.error
          );
        });
      });

      describe("when request resolves successfully", () => {
        beforeEach(() => {
          nock(baseUrl)
            .post(getPath("ask-new-password"))
            .reply(200, {});
        });

        it("does not return error", async () => {
          const response = await authProvider.askNewPassword({
            email: "some@email.com"
          });

          expect(response).not.toBeDefined();
        });
      });
    });

    describe("resetPassword", () => {
      describe("when request fails with error", () => {
        beforeEach(() => {
          nock(baseUrl)
            .post(getPath("reset-password"))
            .reply(404, errorResponse);
        });

        it("handles error properly", async () => {
          const { error } = await authProvider.resetPassword({
            token: "someSuperSecretToken",
            password: "newPassword"
          });

          expect(error.code).toBe(404);
          expect((await error.response.json()).error).toEqual(
            errorResponse.error
          );
        });
      });

      describe("when request resolves successfully", () => {
        beforeEach(() => {
          nock(baseUrl)
            .post(getPath("reset-password"))
            .reply(200, {});
        });

        it("does not return error", async () => {
          const response = await authProvider.resetPassword({
            token: "someSuperSecretToken",
            password: "newPassword"
          });

          expect(response).not.toBeDefined();
        });
      });
    });

    describe("getCurrentUser", () => {
      describe("when request fails with error", () => {
        beforeEach(() => {
          nock(baseUrl)
            .post(getPath("sign-in"))
            .reply(200, signResponse);

          nock(baseUrl, {
            reqheaders: {
              Authorization: `Bearer ${signResponse.data.accessToken}`
            }
          })
            .get(getPath("current-user"))
            .reply(400, errorResponse);
        });

        it("handles error properly", async () => {
          await authProvider.signIn({
            userData: {
              email: "some@email.com",
              password: 12345
            }
          });

          const { error } = await authProvider.getCurrentUser();

          expect(error.code).toBe(400);
          expect((await error.response.json()).error).toEqual(
            errorResponse.error
          );
        });
      });

      describe("when request resolves successfully", () => {
        describe("when user is not signed in", () => {
          it("resolves to null", async () => {
            expect(authProvider.isSignedIn()).toBe(false);

            const { data: user } = await authProvider.getCurrentUser();

            expect(user).toBe(null);
          });
        });

        describe("when user is signed in", () => {
          beforeEach(() => {
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
              userData: {
                email: "some@email.com",
                password: 12345
              }
            });

            const { data: user } = await authProvider.getCurrentUser();

            expect(user).toEqual(currentUserResponse.data.user);
          });
        });
      });
    });
  });

  describe("with custom params", () => {
    let authProvider;

    beforeEach(() => {
      authProvider = createAuthProvider({
        fetcher: fetchData,
        host: "localhost",
        port: 5000,
        protocol: "http",
        apiVersion: "v2"
      });

      nock("http://localhost:5000")
        .post("/api/v2/auth/sign-in")
        .reply(200, signResponse);
    });

    it("sends requests to correct url", async () => {
      await authProvider.signIn({
        userData: {
          email: "some@email.com",
          password: 12345
        }
      });

      expect(authProvider.isSignedIn()).toBe(true);
    });
  });
});
