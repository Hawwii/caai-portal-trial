import { createContext, useContext } from 'react';
import { User } from '../_lib/types';

export const UserContext = createContext<User | undefined>(undefined);

export const useUserContext = () => {
  const user = useContext(UserContext);
  if (user === undefined) {
    throw new Error("useUserContext must be used within UserContextProvider");
  }

  return user;
};