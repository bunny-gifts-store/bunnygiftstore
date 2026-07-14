import { createContext, useContext, useEffect, useMemo, useState } from 'react';

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

  useEffect(() => {
    if (user) sessionStorage.setItem('bunnyUser', JSON.stringify(user));
    else sessionStorage.removeItem('bunnyUser');
  }, [user]);

  const login = ({ token, user: u }) => {
    sessionStorage.setItem('bunnyUserToken', token);
    setUser(u);
  };

  const logout = () => {
    sessionStorage.removeItem('bunnyUserToken');
    setUser(null);
  };

  const value = useMemo(() => ({ user, login, logout }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
