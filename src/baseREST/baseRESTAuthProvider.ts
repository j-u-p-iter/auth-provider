import { makeUrl } from "@j.u.p.iter/node-utils";
import axios from "axios";
import qs from "qs";

type UserData = any;

export interface AuthProvider {
  signUp: (
    data: {
      email: string;
      name: string;
      password: string;
    },
    pathToRedirect?: string
  ) => Promise<UserData>;
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

const handleRequest = async requestCall => {
  let response;

  try {
    response = await requestCall;
  } catch (err) {
    response = err.response;
  }

  const {
    data: { error, data }
  } = response;

  return { error, data };
};

export const createBaseRESTAuthProvider: CreateAuthProviderFn = ({
  host,
  port = null,
  protocol = "https",
  apiVersion = "v1",
  redirectHelper = () => {}
}) => {
  const getPath = basePath => `api/${apiVersion}/auth/${basePath}`;

  const signUp = async (userData, pathToRedirect) => {
    const url = makeUrl({
      host,
      port,
      protocol,
      path: getPath("sign-up")
    });

    const { data, error } = await handleRequest(axios.post(url, userData));

    if (error) {
      return { error };
    }

    const { user, accessToken } = data;

    localStorage.setItem(LOCAL_STORAGE_KEY, accessToken);

    if (pathToRedirect) {
      redirectHelper(pathToRedirect);
    }

    return { data: user };
  };

  const signIn = async userData => {
    const url = makeUrl({
      host,
      port,
      protocol,
      path: getPath("sign-in")
    });

    const { error, data } = await handleRequest(axios.post(url, userData));

    if (error) {
      return { error };
    }

    const { user, accessToken } = data;

    const { redirectTo } = qs.parse(window.location.search, {
      ignoreQueryPrefix: true
    });

    localStorage.setItem(LOCAL_STORAGE_KEY, accessToken);

    if (redirectTo) {
      redirectHelper(redirectTo);
    }

    return { data: user };
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

    const { error, data } = await handleRequest(
      axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
    );

    if (error) {
      return { error };
    }

    const { user } = data;

    return { data: user };
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
