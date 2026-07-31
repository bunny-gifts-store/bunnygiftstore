import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  // Persist the customer session in sessionStorage (not localStorage) so a
  // returning user is asked for their mobile number every time they open the
  // site fresh, while staying logged in across in-session page refreshes.
  const [user, setUser] = useState(() => {
    // Drop any legacy localStorage session so previously auto-logged-in users
    // are re-prompted for their mobile number.
    localStorage.removeItem('bunnyUser');
    localStorage.removeItem('bunnyUserToken');
    try { return JSON.parse(sessionStorage.getItem('bunnyUser') || 'null'); }
    catch { return null; }
  });

  // Set the moment a customer registers or logs in, so the storefront can play
  // the welcome celebration once before revealing the home page. Deliberately
  // NOT persisted: it must fire on a real sign-in, not on an in-session refresh.
  const [welcome, setWelcome] = useState(null); // { username, returning } | null

  useEffect(() => {
    if (user) sessionStorage.setItem('bunnyUser', JSON.stringify(user));
    else sessionStorage.removeItem('bunnyUser');
  }, [user]);

  // `returning` distinguishes a login (Welcome Back) from a registration
  // (Welcome), which only the calling screen knows.
  const login = useCallback(({ token, user: u }, { returning = true } = {}) => {
    sessionStorage.setItem('bunnyUserToken', token);
    setUser(u);
    setWelcome({ username: u?.username || '', returning });
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('bunnyUserToken');
    setUser(null);
    setWelcome(null);
  }, []);

  const dismissWelcome = useCallback(() => setWelcome(null), []);

  const value = useMemo(
    () => ({ user, welcome, login, logout, dismissWelcome }),
    [user, welcome, login, logout, dismissWelcome]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
