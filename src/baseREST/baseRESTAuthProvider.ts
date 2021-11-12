import { makeUrl } from "@j.u.p.iter/node-utils";
import to from "await-to-js";
import { CreateAuthProviderFn, OAuthClientName } from "../types";

export const LOCAL_STORAGE_KEY = "authProvider:accessToken";

const handleRequest = async requestCall => {
  const [error, result] = await to(requestCall);

  const data = (result && result.data.data) || null;

  return { error, data };
};

export const createBaseRESTAuthProvider: CreateAuthProviderFn = ({
  fetcher,
  host,
  protocol = "https",
  port,
  apiVersion = "v1"
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

  const signUp = async userData => {
    const url = makeUrl({
      host,
      port,
      protocol,
      path: getPath("sign-up")
    });

    const { data, error } = await handleRequest(
      fetcher.post(url, { body: userData }).request
    );

    if (error) {
      return { error };
    }

    const { user, accessToken } = data;

    localStorage.setItem(LOCAL_STORAGE_KEY, accessToken);

    return { data: user };
  };

  const signIn = async params => {
    let error;
    let data;

    if (params.oauthClientName) {
      const url = makeOAuthURL(params.oauthClientName);

      ({ error, data } = await handleRequest(
        fetcher.post(url, { body: { code: params.code } }).request
      ));
    } else {
      const url = makeUrl({
        host,
        port,
        protocol,
        path: getPath("sign-in")
      });

      ({ error, data } = await handleRequest(
        fetcher.post(url, { body: params.userData }).request
      ));
    }

    if (error) {
      return { error };
    }

    const { user, accessToken } = data;

    localStorage.setItem(LOCAL_STORAGE_KEY, accessToken);

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

  type GetRequestParams = () => { headers: { Authorization: string } };
  const getRequestParams: GetRequestParams = () => {
    const accessToken = getAccessToken();

    return {
      headers: { Authorization: `Bearer ${accessToken}` }
    };
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

    const { error, data } = await handleRequest(
      fetcher.get(url, getRequestParams()).request
    );

    if (error) {
      return { error };
    }

    const { user } = data;

    return { data: user };
  };

  const updateCurrentUser = async dataToUpdate => {
    const url = makeUrl({
      host,
      port,
      protocol,
      path: getPath("current-user")
    });

    const { error, data } = await handleRequest(
      fetcher.put(url, { body: dataToUpdate, ...getRequestParams() }).request
    );

    if (error) {
      return { error };
    }

    const { user } = data;

    return { data: user };
  };

  const askNewPassword = async ({ email }) => {
    const url = makeUrl({
      host,
      port,
      protocol,
      path: getPath("ask-new-password")
    });

    const { error } = await handleRequest(
      fetcher.post(url, { body: { email } }).request
    );

    if (error) {
      return { error };
    }
  };

  const resetPassword = async ({ token, password }) => {
    const url = makeUrl({
      host,
      port,
      protocol,
      path: getPath("reset-password")
    });

    const { error } = await handleRequest(
      fetcher.post(url, { body: { token, password } }).request
    );

    if (error) {
      return { error };
    }
  };

  return {
    signUp,
    signIn,
    signOut,
    isSignedIn,
    getCurrentUser,
    updateCurrentUser,
    getAccessToken,
    askNewPassword,
    resetPassword
  };
};
