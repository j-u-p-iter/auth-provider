import { makeUrl } from "@j.u.p.iter/node-utils";
import axios from "axios";
import qs from "qs";

type UserData = any;

export interface AuthProvider {
  // it's responsibility of getCurrentUser method to bring user info
  signUp: (data: {
    email: string;
    name: string;
    password: string;
  }) => Promise<void>;
  signIn: (data: { email: string; password: string }) => Promise<void>;
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

export const createBaseRESTAuthProvider: CreateAuthProviderFn = ({
  host,
  port = null,
  protocol = "https",
  apiVersion = "v1",
  redirectHelper = () => {}
}) => {
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
        data: { accessToken }
      }
    } = await axios.post(url, userData);

    const { redirectTo } = qs.parse(window.location.search, {
      ignoreQueryPrefix: true
    });

    localStorage.setItem(LOCAL_STORAGE_KEY, accessToken);

    if (redirectTo) {
      redirectHelper(redirectTo);
    }
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
