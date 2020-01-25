import { makeUrl } from "@j.u.p.iter/node-utils";
import baseAxios from "axios";
import httpAdapter from "axios/lib/adapters/http";
import qs from "qs";

type UserData = any;

export interface AuthProvider {
  signUp: (data: {
    email: string;
    name: string;
    password: string;
  }) => Promise<UserData>;
  signIn: (data: { email: string; password: string }) => Promise<UserData>;
  signOut: () => void;
  isSignedIn: () => boolean;
  getCurrentUser: () => Promise<UserData>;
  getAccessToken: () => string;
  checkError: (
    response: any,
    redirectConfig: {
      401: string;
      403: string;
    }
  ) => void;
}

export type CreateAuthProviderFn = (params: {
  host: string;
  protocol?: string;
  apiVersion?: string;
  port?: number | null;
  redirectHelper?: (urlToRedirect: string) => void;
}) => AuthProvider;

export const LOCAL_STORAGE_KEY = "authProvider:accessToken";

export const createAuthProvider: CreateAuthProviderFn = ({
  host,
  port = null,
  protocol = "https",
  apiVersion = "v1",
  redirectHelper = () => {}
}) => {
  // We need to do like this because of this:
  // https://github.com/axios/axios/issues/1754#issuecomment-415963871
  const axios = baseAxios.create({ adapter: httpAdapter });

  const getPath = basePath => `api/${apiVersion}/${basePath}`;

  const signUp = async userData => {
    const url = makeUrl({
      host,
      port,
      protocol,
      path: getPath("sign-up")
    });

    const {
      data: {
        data: { user, accessToken }
      }
    } = await axios.post(url, userData);

    localStorage.setItem(LOCAL_STORAGE_KEY, accessToken);

    return user;
  };

  const signIn = async userData => {
    const url = makeUrl({
      host,
      port,
      protocol,
      path: getPath("sign-in")
    });

    const {
      data: {
        data: { user, accessToken }
      }
    } = await axios.post(url, userData);

    const { redirectTo } = qs.parse(window.location.search, {
      ignoreQueryPrefix: true
    });

    if (redirectTo) {
      console.log(window.location.href);
      console.log(redirectTo);
      redirectHelper(redirectTo);
    }

    localStorage.setItem(LOCAL_STORAGE_KEY, accessToken);

    return user;
  };

  const signOut = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  };

  const getAccessToken = () => {
    return localStorage.getItem(LOCAL_STORAGE_KEY);
  };

  const isSignedIn = () => {
    return Boolean(getAccessToken());
  };

  const getCurrentUser = async () => {
    if (!isSignedIn()) {
      return null;
    }

    const url = makeUrl({
      host,
      port,
      protocol,
      path: getPath("current-user")
    });

    const accessToken = getAccessToken();

    const {
      data: {
        data: { user }
      }
    } = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    return user;
  };

  const checkError = (
    response,
    { 401: urlToRedirectAfter401, 403: urlToRedirectAfter403 }
  ) => {
    const { status: responseStatus } = response;

    if (responseStatus === "401") {
      signOut();

      redirectHelper(
        `${urlToRedirectAfter401}?redirectTo=${window.location.href}`
      );
    }

    if (responseStatus === "403") {
      redirectHelper(urlToRedirectAfter403);
    }
  };

  return {
    signUp,
    signIn,
    signOut,
    isSignedIn,
    getCurrentUser,
    getAccessToken,
    checkError
  };
};
