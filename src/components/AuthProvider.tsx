"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, type ReactNode, useContext } from "react";
import type { User } from "@/lib/supabase";

interface AuthContextType {
	user: User | null;
	session: Session | null;
	loading: boolean;
	signIn: (
		email: string,
		password: string,
	) => Promise<{ success: boolean; error?: string }>;
	signUp: (
		email: string,
		password: string,
		name?: string,
	) => Promise<{ success: boolean; error?: string; message?: string }>;
	signOut: () => Promise<{ success: boolean; error?: string }>;
	resetPassword: (
		email: string,
	) => Promise<{ success: boolean; error?: string; message?: string }>;
	updateProfile: (updates: {
		name?: string;
		avatar?: string;
	}) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
};

interface AuthProviderProps {
	children: ReactNode;
}

// Local projects never require an application account. The Market build aliases
// this module to its independent NeoWoW web authentication provider.
const localAuth: AuthContextType = {
	user: null,
	session: null,
	loading: false,
	signIn: async () => ({
		success: false,
		error: "Use NeoWoW CLI in your terminal.",
	}),
	signUp: async () => ({ success: false, error: "Register at neowow.cn." }),
	resetPassword: async () => ({
		success: false,
		error: "Manage your account at neowow.cn.",
	}),
	updateProfile: async () => ({
		success: false,
		error: "Manage your account at neowow.cn.",
	}),
	signOut: async () => ({ success: true }),
};
export function AuthProvider({ children }: AuthProviderProps) {
	return (
		<AuthContext.Provider value={localAuth}>{children}</AuthContext.Provider>
	);
}
