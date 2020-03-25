import { makeUrl } from "@j.u.p.iter/node-utils";
import axios from "axios";
import HTTPStatus from "http-status";
import qs from "qs";

interface UserData {
  [key: string]: any;
}

export enum OAuthClientName {
  Google = "google",
  GitHub = "github",
  Apple = "apple"
}

export interface SignInParams {
  oauthClientName?: OAuthClientName;
  code?: string;
  userData?: { email: string; password: string };
}

export interface Response {
  data?: UserData;
  error?: string;
}

export interface AuthProvider {
  signUp: (
    data: {
      email: string;
      name: string;
      password: string;
    },
    pathToRedirect?: string
  ) => Promise<Response>;
  signIn: (data: SignInParams) => Promise<Response>;
  signOut: () => void;
  isSignedIn: () => boolean;
  getCurrentUser: () => Promise<Response>;
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
  type MakeOAuthURL = (oauthClientName: OAuthClientName) => string;
  const makeOAuthURL: MakeOAuthURL = oauthClientName => {
    const path = getOAuthPath(`${oauthClientName}/sign-in`);

    return makeUrl({
      host,
      port,
      protocol,
      path
    });
  };

  type GetPath = (basePath: string) => string;
  const getPath: GetPath = basePath => `api/${apiVersion}/auth/${basePath}`;
  const getOAuthPath: GetPath = basePath =>
    `api/${apiVersion}/oauth/${basePath}`;

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

  const signIn = async params => {
    let error;
    let data;

    if (params.oauthClientName) {
      const url = makeOAuthURL(params.oauthClientName);

      ({ error, data } = await handleRequest(
        axios.post(url, { code: params.code })
      ));
    } else {
      const url = makeUrl({
        host,
        port,
        protocol,
        path: getPath("sign-in")
      });

      ({ error, data } = await handleRequest(axios.post(url, params.userData)));
    }

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
      return { data: null, error: null };
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

    if (responseStatus === HTTPStatus.UNAUTHORIZED) {
      signOut();

      redirectHelper(
        `${urlToRedirectAfter401}?redirectTo=${window.location.href}`
      );
    }

    if (responseStatus === HTTPStatus.FORBIDDEN) {
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
