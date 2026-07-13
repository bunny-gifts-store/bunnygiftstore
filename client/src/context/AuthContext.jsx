import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bunnyUser') || 'null'); }
    catch { return null; }
  });

  useEffect(() => {
    if (user) localStorage.setItem('bunnyUser', JSON.stringify(user));
    else localStorage.removeItem('bunnyUser');
  }, [user]);

  const login = ({ token, user: u }) => {
    localStorage.setItem('bunnyUserToken', token);
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem('bunnyUserToken');
    setUser(null);
  };

  const value = useMemo(() => ({ user, login, logout }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
