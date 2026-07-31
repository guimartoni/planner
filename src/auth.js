import { PublicClientApplication } from "@azure/msal-browser";

/* O Client ID vem do registro do app no Azure AD (portal.azure.com).
   Fica salvo no navegador — assim o site publicado não precisa ser
   reconstruído quando o usuário fizer o registro. */
const CLIENT_ID_KEY = "planner-azure-client-id";

export const getClientId = () => localStorage.getItem(CLIENT_ID_KEY) || "";
export const setClientId = (id) => localStorage.setItem(CLIENT_ID_KEY, id.trim());

export const SCOPES = ["User.Read", "Files.ReadWrite", "Calendars.Read"];

let msal = null;

export async function initAuth() {
  const clientId = getClientId();
  if (!clientId) return { status: "sem-client-id" };
  msal = new PublicClientApplication({
    auth: {
      clientId,
      authority: "https://login.microsoftonline.com/common",
      redirectUri: window.location.origin + import.meta.env.BASE_URL,
    },
    cache: { cacheLocation: "localStorage" },
  });
  await msal.initialize();
  const result = await msal.handleRedirectPromise();
  if (result && result.account) msal.setActiveAccount(result.account);
  const accounts = msal.getAllAccounts();
  if (!msal.getActiveAccount() && accounts.length) msal.setActiveAccount(accounts[0]);
  const account = msal.getActiveAccount();
  return account ? { status: "logado", account } : { status: "deslogado" };
}

export function login() {
  return msal.loginRedirect({ scopes: SCOPES });
}

export function logout() {
  return msal.logoutRedirect();
}

export async function getToken() {
  const account = msal.getActiveAccount();
  if (!account) throw new Error("Nenhuma conta ativa");
  try {
    const r = await msal.acquireTokenSilent({ scopes: SCOPES, account });
    return r.accessToken;
  } catch (e) {
    await msal.acquireTokenRedirect({ scopes: SCOPES });
  }
}
